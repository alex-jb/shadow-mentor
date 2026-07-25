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
//       [--evidence <bundle.json> --evidence-public-key <key.pem>]
//       [--attestation <attestation.json>] [--built-at <iso8601>]
//       [--build-commit <sha>] [--allow-identity-ref] [--force] [--json]
//   shadow-audit-package verify --package <dir> [--public-key <key.pem>] [--json]
//
//   create   Assemble a package from the shipped canonical fixture narrative
//            plus an EXISTING sealed shadow-evidence/v1 bundle (never re-run,
//            never re-sealed). Defaults in fixture mode: the committed
//            reference bundle docs/reference/banking-decision.bundle.json and
//            its public key. The manifest is signed with the FIXTURE RELEASE
//            KEY (key_provenance=fixture) — demo-labeled, never production.
//   verify   Independently verify a package directory: manifest signature,
//            two-way completeness, member hashes, case↔session bindings,
//            internal evidence verification, derived-view re-derivation.
//
// Exit codes:
//   create: 0 ok · 2 usage · 3 input/I-O error · 4 assembled package failed
//           self-verification (nothing is written)
//   verify: 0 verified · 1 package verification failed · 2 usage · 3 I/O error
//
// Guarantees: offline (no network, no credentials); deterministic bytes for
// the same inputs (built_at defaults to the fixture timestamp, never wall
// clock); atomic temp-directory + rename (a failed run leaves no partial
// package); private keys are never written, printed, or packaged.
// A valid package signature proves tamper-evidence only — never analytical
// or business correctness.
import { readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { BANKING_NARRATIVE } from "../apps/shadow-lens/fixtures/banking-narrative.mjs";
import { FIXTURE_RELEASE_PRIVATE_PEM, FIXTURE_RELEASE_PUBLIC_PEM, FIXTURE_RELEASE_LABEL } from "../verify/fixture-release-key.mjs";
import { assemblePackage, verifyPackageDir, PACKAGE_VERSION, BOUNDARY_STATEMENT } from "../lib/portable-audit-package.mjs";

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
  return readFileSync(fileURLToPath(import.meta.url), "utf8")
    .split("\n").slice(2, 40).join("\n").replace(/^\/\/ ?/gm, "") + "\n";
}

function parseCreateArgs(rest) {
  const o = { fixture: null, outputDir: null, evidence: null, evidencePublicKey: null, attestation: null, builtAt: null, buildCommit: null, allowIdentityRef: false, force: false, json: false };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "-h" || a === "--help") return { help: true };
    else if (a === "--fixture") o.fixture = rest[++i];
    else if (a === "--output-dir") o.outputDir = rest[++i];
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

  const outDir = resolve(args.outputDir);
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
    }) + "\n");
  } else {
    process.stdout.write(
      `wrote ${outDir}  (${m.manifest_version}, ${m.assets.length} members, case ${m.case_id}, session ${m.bindings.evidence_session_id})\n` +
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

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "-h" || cmd === "--help") { process.stdout.write(readHelp()); process.exit(cmd ? 0 : 2); }
  if (cmd === "create") return cmdCreate(rest);
  if (cmd === "verify") return cmdVerify(rest);
  die(2, `shadow-audit-package: unknown command "${cmd}" (supported: create, verify)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
