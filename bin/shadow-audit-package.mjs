#!/usr/bin/env node
// bin/shadow-audit-package.mjs
//
// Portable signed audit package CLI — FIXTURE MODE ONLY.
// Composes existing Shadow producers into one independently verifiable
// shadow-portable-audit-package/1.0 directory, and verifies such a directory.
// Implements the committed discovery decision
// SEPARATE_PORTABLE_PACKAGE_CLI_RECOMMENDED (docs/portable-audit-package/).
//
// Usage:
//   shadow-audit-package create --fixture banking --output-dir <dir>
//       [--supersedes <prior-package-dir>]
//       [--evidence <bundle.json> --evidence-public-key <key.pem>]
//       [--attestation <attestation.json>] [--built-at <iso8601>]
//       [--build-commit <sha>] [--allow-identity-ref] [--force] [--json]
//   shadow-audit-package verify --package <dir> [--public-key <key.pem>] [--json]
//   shadow-audit-package verify-chain --package <dir> [--package <dir> ...]
//       [--public-key <key.pem>] [--json]
//
//   create   Assemble a package from the shipped canonical fixture narrative
//            plus an EXISTING sealed shadow-evidence/v1 bundle (never re-run,
//            never re-sealed). Defaults in fixture mode: the committed
//            reference bundle docs/reference/banking-decision.bundle.json and
//            its public key. The manifest is signed with the FIXTURE RELEASE
//            KEY (key_provenance=fixture) — demo-labeled, never production.
//            With --supersedes the result is a NEW immutable
//            shadow-portable-audit-package/1.1 whose signed manifest binds the
//            prior package by content identity (package_id + manifest sha256 +
//            case + evidence session). The prior package is verified first and
//            NEVER modified; without --supersedes an unchanged 1.0 is produced.
//   verify   Independently verify a package directory: manifest signature,
//            two-way completeness, member hashes, case↔session bindings,
//            internal evidence verification, derived-view re-derivation.
//   verify-chain
//            Verify a SUPPLIED SET of packages as a supersession chain: each
//            package independently first, then every signed predecessor link
//            (id + manifest hash + same-case + session relation), duplicates,
//            self-references, cycles, forks, broken chains, and the LOCALLY
//            OBSERVED chain head. A valid chain head is never a claim of
//            global latest — only the head of the packages you supplied.
//
// Exit codes:
//   create:       0 ok · 2 usage · 3 input/I-O error · 4 assembled package
//                 failed self-verification (nothing is written)
//   verify:       0 verified · 1 package verification failed · 2 usage · 3 I/O error
//   verify-chain: 0 chain valid · 1 chain verification failed · 2 usage · 3 I/O error
//
// Guarantees: offline (no network, no credentials); deterministic bytes for
// the same inputs (built_at defaults to the fixture timestamp, never wall
// clock); atomic temp-directory + rename (a failed run leaves no partial
// package); private keys are never written, printed, or packaged.
// A valid package signature proves tamper-evidence only — never analytical
// or business correctness. A valid supersession chain never invalidates or
// erases the predecessor and never proves business correctness.
import { readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { BANKING_NARRATIVE } from "../apps/shadow-lens/fixtures/banking-narrative.mjs";
import { FIXTURE_RELEASE_PRIVATE_PEM, FIXTURE_RELEASE_PUBLIC_PEM, FIXTURE_RELEASE_LABEL } from "../verify/fixture-release-key.mjs";
import { assemblePackage, verifyPackageDir, MEMBER_PATHS, SUPPORTED_PACKAGE_VERSIONS, BOUNDARY_STATEMENT } from "../lib/portable-audit-package.mjs";
import { verifyPackageChain, CHAIN_BOUNDARY_STATEMENT } from "../lib/portable-audit-package-chain.mjs";
import { sha256Hex } from "../verify/verify-manifest.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Closed allowlist: only fixtures whose narrative + evidence pair is committed and test-pinned.
const FIXTURES = {
  banking: {
    narrative: BANKING_NARRATIVE,
    evidence: join(REPO_ROOT, "docs", "reference", "banking-decision.bundle.json"),
    evidencePublicKey: join(REPO_ROOT, "docs", "reference", "banking-decision.public.pem"),
  },
};

function die(code, msg) { process.stderr.write(msg + "\n"); process.exit(code); }

function readHelp() {
  // the full header comment block (everything after the shebang + filename line,
  // up to the first non-comment line) is the help text
  const lines = readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n");
  const out = [];
  for (let i = 2; i < lines.length && lines[i].startsWith("//"); i++) out.push(lines[i]);
  return out.join("\n").replace(/^\/\/ ?/gm, "") + "\n";
}

function parseCreateArgs(rest) {
  const o = { fixture: null, outputDir: null, supersedes: null, evidence: null, evidencePublicKey: null, attestation: null, builtAt: null, buildCommit: null, allowIdentityRef: false, force: false, json: false };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "-h" || a === "--help") return { help: true };
    else if (a === "--fixture") o.fixture = rest[++i];
    else if (a === "--output-dir") o.outputDir = rest[++i];
    else if (a === "--supersedes") o.supersedes = rest[++i];
    else if (a === "--evidence") o.evidence = rest[++i];
    else if (a === "--evidence-public-key") o.evidencePublicKey = rest[++i];
    else if (a === "--attestation") o.attestation = rest[++i];
    else if (a === "--built-at") o.builtAt = rest[++i];
    else if (a === "--build-commit") o.buildCommit = rest[++i];
    else if (a === "--allow-identity-ref") o.allowIdentityRef = true;
    else if (a === "--force") o.force = true;
    else if (a === "--json") o.json = true;
    else die(2, `shadow-audit-package: unknown argument: ${a}`);
  }
  return o;
}

function parseVerifyArgs(rest) {
  const o = { packageDir: null, publicKey: null, json: false };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "-h" || a === "--help") return { help: true };
    else if (a === "--package") o.packageDir = rest[++i];
    else if (a === "--public-key") o.publicKey = rest[++i];
    else if (a === "--json") o.json = true;
    else die(2, `shadow-audit-package: unknown argument: ${a}`);
  }
  return o;
}

function detectBuildCommit() {
  // fixed executable name, no shell, offline; provenance precedent = the
  // acceptance package's MANIFEST.json build_commit (git rev-parse HEAD)
  const r = spawnSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" });
  if (r.status === 0 && typeof r.stdout === "string" && /^[0-9a-f]{40}\s*$/.test(r.stdout)) return r.stdout.trim();
  return "unknown";
}

function readInput(path, what) {
  try { return readFileSync(path); }
  catch (e) { die(3, `shadow-audit-package: cannot read ${what}: ${e.message}`); }
}

function cmdCreate(rest) {
  const args = parseCreateArgs(rest);
  if (args.help) { process.stdout.write(readHelp()); process.exit(0); }
  if (!args.fixture) die(2, "shadow-audit-package create: --fixture <name> is required (supported: " + Object.keys(FIXTURES).join(", ") + ")");
  if (!args.outputDir) die(2, "shadow-audit-package create: --output-dir <dir> is required (explicit, never implied)");
  const fixture = FIXTURES[args.fixture];
  if (!fixture) die(2, `shadow-audit-package: unknown fixture "${args.fixture}" (supported: ${Object.keys(FIXTURES).join(", ")})`);
  if ((args.evidence && !args.evidencePublicKey) || (!args.evidence && args.evidencePublicKey))
    die(2, "shadow-audit-package create: --evidence and --evidence-public-key must be given together");

  const evidencePath = args.evidence ?? fixture.evidence;
  const evidenceKeyPath = args.evidencePublicKey ?? fixture.evidencePublicKey;
  const evidenceBytes = readInput(evidencePath, "--evidence bundle");
  const evidencePublicKeyPem = readInput(evidenceKeyPath, "--evidence-public-key").toString("utf8");
  const attestationBytes = args.attestation ? readInput(args.attestation, "--attestation") : null;

  // --supersedes: bind the NEW package to an EXISTING one. The predecessor is
  // verified first and read only — never mutated, re-signed, or rewritten.
  let supersedes = null;
  let predecessorDir = null;
  if (args.supersedes) {
    predecessorDir = resolve(args.supersedes);
    if (!existsSync(predecessorDir)) die(3, `shadow-audit-package: --supersedes package directory not found: ${predecessorDir}`);
    let prior;
    try { prior = verifyPackageDir(predecessorDir); }
    catch (e) { die(3, `shadow-audit-package: cannot read the --supersedes package: ${e.message}`); }
    if (!prior.ok) {
      die(3, `shadow-audit-package: PREDECESSOR_INVALID — refusing to supersede a package that does not verify:\n  - ${prior.failures.map((f) => `${f.code}: ${f.detail}`).join("\n  - ")}`);
    }
    if (!SUPPORTED_PACKAGE_VERSIONS.includes(prior.manifest_version)) {
      die(3, `shadow-audit-package: UNSUPPORTED_TRANSITION — cannot supersede a ${prior.manifest_version} package`);
    }
    const priorManifestBytes = readInput(join(predecessorDir, MEMBER_PATHS.manifest), "--supersedes manifest");
    supersedes = {
      predecessorPackageId: prior.package_id,
      predecessorManifestSha256: sha256Hex(priorManifestBytes),
      predecessorManifestVersion: prior.manifest_version,
      predecessorCaseId: prior.case_id,
      predecessorEvidenceSessionId: prior.evidence_session_id ?? null,
    };
  }

  const outDir = resolve(args.outputDir);
  if (predecessorDir && outDir === predecessorDir)
    die(3, "shadow-audit-package: --output-dir must not be the --supersedes package — the predecessor is immutable and is never overwritten (not even with --force)");
  if (existsSync(outDir) && !args.force)
    die(3, `shadow-audit-package: ${outDir} already exists. Refusing to overwrite (pass --force to replace it).`);

  let producerVersion = "unknown";
  try { producerVersion = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")).version ?? "unknown"; } catch { /* keep "unknown" */ }

  let assembled;
  try {
    assembled = assemblePackage({
      narrative: fixture.narrative,
      source: `fixture:${args.fixture}`,
      evidenceBytes,
      evidencePublicKeyPem,
      attestationBytes,
      // deterministic: fixture timestamp by default, never wall clock
      builtAt: args.builtAt ?? fixture.narrative.fixture_timestamp,
      buildCommit: args.buildCommit ?? detectBuildCommit(),
      producerVersion,
      packagePrivateKeyPem: FIXTURE_RELEASE_PRIVATE_PEM,
      packagePublicKeyPem: FIXTURE_RELEASE_PUBLIC_PEM,
      keyProvenance: "fixture",
      keyLabel: FIXTURE_RELEASE_LABEL,
      allowIdentityRef: args.allowIdentityRef,
      supersedes,
    });
  } catch (e) {
    die(e.code === "SELF_VALIDATION" ? 4 : 3, `shadow-audit-package: ${e.message}`);
  }

  // atomic: write everything into a temp sibling, self-verify, then rename
  const tmpDir = `${outDir}.tmp-${process.pid}`;
  try {
    mkdirSync(tmpDir, { recursive: true });
    for (const [rel, bytes] of assembled.files) {
      const abs = join(tmpDir, rel);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, bytes);
    }
    const self = verifyPackageDir(tmpDir);
    if (!self.ok) {
      rmSync(tmpDir, { recursive: true, force: true });
      die(4, `shadow-audit-package: assembled package failed self-verification — nothing written:\n  - ${self.failures.map((f) => `${f.code}: ${f.detail}`).join("\n  - ")}`);
    }
    if (predecessorDir) {
      // successor: the NEW link must verify before anything is written. The
      // predecessor's own ancestors are not required here (requireCompleteChain:
      // false) — only the link being created is self-checked.
      const chain = verifyPackageChain([predecessorDir, tmpDir], { requireCompleteChain: false });
      if (!chain.ok) {
        rmSync(tmpDir, { recursive: true, force: true });
        die(4, `shadow-audit-package: assembled successor failed chain self-verification — nothing written:\n  - ${chain.chain_failures.map((f) => `${f.code}: ${f.detail}`).join("\n  - ")}`);
      }
    }
    if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true }); // only reachable with --force
    renameSync(tmpDir, outDir);
  } catch (e) {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
    if (typeof e?.status === "number") throw e; // process.exit already in flight
    die(3, `shadow-audit-package: cannot write package: ${e.message}`);
  }

  const m = assembled.manifest;
  if (args.json) {
    process.stdout.write(JSON.stringify({
      ok: true, manifest_version: m.manifest_version, package_id: m.package_id,
      case_id: m.case_id, evidence_session_id: m.bindings.evidence_session_id,
      key_provenance: m.signing.key_provenance, member_count: m.assets.length,
      output_dir: outDir,
      ...(m.supersedes ? { supersedes: m.supersedes } : {}),
    }) + "\n");
  } else {
    process.stdout.write(
      `wrote ${outDir}  (${m.manifest_version}, ${m.assets.length} members, case ${m.case_id}, session ${m.bindings.evidence_session_id})\n` +
      (m.supersedes ? `supersedes package ${m.supersedes.predecessor_package_id.slice(0, 16)}… (${m.supersedes.predecessor_manifest_version}) — the predecessor remains valid, unchanged evidence\n` : "") +
      `signed with ${m.signing.key_label} (key_provenance=${m.signing.key_provenance}) — fixture keys are never production keys\n` +
      `${BOUNDARY_STATEMENT}\n`);
  }
}

function cmdVerify(rest) {
  const args = parseVerifyArgs(rest);
  if (args.help) { process.stdout.write(readHelp()); process.exit(0); }
  if (!args.packageDir) die(2, "shadow-audit-package verify: --package <dir> is required");
  const dir = resolve(args.packageDir);
  if (!existsSync(dir)) die(3, `shadow-audit-package: package directory not found: ${dir}`);
  const publicKeyPem = args.publicKey ? readInput(args.publicKey, "--public-key").toString("utf8") : null;

  let res;
  try { res = verifyPackageDir(dir, { publicKeyPem }); }
  catch (e) { die(3, `shadow-audit-package: ${e.message}`); }

  if (args.json) {
    process.stdout.write(JSON.stringify(res) + "\n");
  } else if (res.ok) {
    process.stdout.write(
      `✓ package verified  (${res.manifest_version}, package ${res.package_id.slice(0, 16)}…, case ${res.case_id}, session ${res.evidence_session_id})\n` +
      `verdict: ${res.verdict} — key_provenance=${res.key_provenance}${res.key_provenance === "fixture" ? " (demo-labeled fixture key, NOT production)" : ""}\n` +
      `${BOUNDARY_STATEMENT}\n`);
  } else {
    process.stdout.write(`✗ package verification FAILED\n` + res.failures.map((f) => `  - ${f.code}: ${f.detail}`).join("\n") + "\n");
  }
  process.exit(res.ok ? 0 : 1);
}

function parseVerifyChainArgs(rest) {
  const o = { packageDirs: [], publicKey: null, json: false };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "-h" || a === "--help") return { help: true };
    else if (a === "--package") o.packageDirs.push(rest[++i]);
    else if (a === "--public-key") o.publicKey = rest[++i];
    else if (a === "--json") o.json = true;
    else die(2, `shadow-audit-package: unknown argument: ${a}`);
  }
  return o;
}

function cmdVerifyChain(rest) {
  const args = parseVerifyChainArgs(rest);
  if (args.help) { process.stdout.write(readHelp()); process.exit(0); }
  if (!args.packageDirs.length) die(2, "shadow-audit-package verify-chain: at least one --package <dir> is required");
  if (args.packageDirs.some((d) => typeof d !== "string" || !d)) die(2, "shadow-audit-package verify-chain: --package needs a directory argument");
  const dirs = args.packageDirs.map((d) => resolve(d));
  for (const d of dirs) if (!existsSync(d)) die(3, `shadow-audit-package: package directory not found: ${d}`);
  const publicKeyPem = args.publicKey ? readInput(args.publicKey, "--public-key").toString("utf8") : null;

  let res;
  try { res = verifyPackageChain(dirs, { publicKeyPem }); }
  catch (e) { die(e.code === "USAGE" ? 2 : 3, `shadow-audit-package: ${e.message}`); }

  if (args.json) {
    process.stdout.write(JSON.stringify(res) + "\n");
  } else if (res.ok) {
    const head = res.packages.find((p) => p.package_id === res.local_head);
    process.stdout.write(
      `✓ supersession chain verified  (${res.packages.length} package${res.packages.length === 1 ? "" : "s"}, case ${head?.case_id})\n` +
      `order (root → head): ${res.order.map((id) => id.slice(0, 16) + "…").join(" → ")}\n` +
      `local head: ${res.local_head.slice(0, 16)}… — head of the SUPPLIED chain only, never a claim of globally latest\n` +
      `every predecessor remains a valid, unchanged, independently verifiable package\n` +
      `${CHAIN_BOUNDARY_STATEMENT}\n`);
  } else {
    process.stdout.write(`✗ supersession chain verification FAILED\n` +
      res.chain_failures.map((f) => `  - ${f.code}: ${f.detail}`).join("\n") + "\n");
  }
  process.exit(res.ok ? 0 : 1);
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "-h" || cmd === "--help") { process.stdout.write(readHelp()); process.exit(cmd ? 0 : 2); }
  if (cmd === "create") return cmdCreate(rest);
  if (cmd === "verify") return cmdVerify(rest);
  if (cmd === "verify-chain") return cmdVerifyChain(rest);
  die(2, `shadow-audit-package: unknown command "${cmd}" (supported: create, verify, verify-chain)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
