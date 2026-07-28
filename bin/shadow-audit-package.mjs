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
//   shadow-audit-package decide --predecessor <prior-package-dir>
//       --intent <decision-intent.json> --output-dir <new-package-dir>
//       [--built-at <iso8601>] [--build-commit <sha>] [--force] [--json]
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
//            When 1.2 decision packages are supplied, the DECISION LIFECYCLE
//            (a separate derived business axis) is reported alongside:
//            review / override / approval / rejection states derived from the
//            signed decision members ONLY — never from import order or time.
//   decide   Record a signed HUMAN decision (HUMAN_REVIEW_COMPLETED,
//            DECISION_OVERRIDDEN, APPROVAL_GRANTED, DECISION_REJECTED) as a
//            NEW immutable shadow-portable-audit-package/1.2 successor.
//            The predecessor is verified first and NEVER modified — an
//            override never erases the original Council conclusion. The
//            unsigned intent file (shadow-decision-intent/1) is an operator
//            REQUEST: Core validates it strictly, derives every binding from
//            the verified predecessor, generates the signed decision member
//            (shadow-decision-amendment/1) and signs with the FIXTURE
//            RELEASE KEY. Fixture decisions carry FIXTURE_DECISION_ONLY,
//            DECISION_IDENTITY_DECLARED_NOT_VERIFIED and
//            DECISION_AUTHORITY_UNVERIFIED inside the signed bytes: actor
//            identity is operator-declared, authority is NOT verified, and
//            separation-of-duties is a declared policy, never an
//            organizational enforcement claim.
//
// Exit codes:
//   create:       0 ok · 2 usage · 3 input/I-O error · 4 assembled package
//                 failed self-verification (nothing is written)
//   verify:       0 verified · 1 package verification failed · 2 usage · 3 I/O error
//   verify-chain: 0 chain valid · 1 chain verification failed · 2 usage · 3 I/O error
//   decide:       0 ok · 2 usage · 3 input/I-O error · 4 assembled package
//                 failed self-verification (nothing is written)
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
import { assembleDecisionPackage, verifyDecisionChain } from "../lib/decision-package.mjs";
import { DECISION_BOUNDARY_STATEMENT, LIFECYCLE_QUALIFIER } from "../lib/decision-amendment.mjs";
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

  // decision-aware wrapper: for sets WITHOUT 1.2 packages the result is
  // byte-identical to the plain chain result (1.0/1.1 behavior unchanged)
  let dec;
  try { dec = verifyDecisionChain(dirs, { publicKeyPem }); }
  catch (e) { die(e.code === "USAGE" ? 2 : 3, `shadow-audit-package: ${e.message}`); }
  const res = dec.chain;
  const hasDecisions = dec.decisions.length > 0;
  const overallOk = hasDecisions ? dec.ok : res.ok;

  if (args.json) {
    const out = hasDecisions
      ? { ...res, ok: overallOk, decisions: dec.decisions, decision_failures: dec.decision_failures, decision_lifecycle: dec.lifecycle }
      : res;
    process.stdout.write(JSON.stringify(out) + "\n");
  } else if (overallOk) {
    const head = res.packages.find((p) => p.package_id === res.local_head);
    process.stdout.write(
      `✓ supersession chain verified  (${res.packages.length} package${res.packages.length === 1 ? "" : "s"}, case ${head?.case_id})\n` +
      `order (root → head): ${res.order.map((id) => id.slice(0, 16) + "…").join(" → ")}\n` +
      `local head: ${res.local_head.slice(0, 16)}… — head of the SUPPLIED chain only, never a claim of globally latest\n` +
      `every predecessor remains a valid, unchanged, independently verifiable package\n` +
      (hasDecisions
        ? `decision lifecycle (${LIFECYCLE_QUALIFIER}): ${dec.lifecycle.state} — effective disposition: ${dec.lifecycle.effective_disposition ?? "(original council output)"}\n` +
          `fixture decisions only: actor identity operator-declared, authority NOT verified, separation-of-duties NOT organizationally enforced\n`
        : "") +
      `${CHAIN_BOUNDARY_STATEMENT}\n`);
  } else {
    const failLines = [
      ...res.chain_failures.map((f) => `  - ${f.code}: ${f.detail}`),
      ...(hasDecisions ? dec.decision_failures.map((f) => `  - ${f.code}: ${f.detail}`) : []),
      ...(hasDecisions ? dec.lifecycle.failures.map((f) => `  - ${f.code}: ${f.detail}`) : []),
    ];
    process.stdout.write(`✗ supersession chain verification FAILED\n` + failLines.join("\n") + "\n");
  }
  process.exit(overallOk ? 0 : 1);
}

function parseDecideArgs(rest) {
  const o = { predecessor: null, intent: null, outputDir: null, builtAt: null, buildCommit: null, force: false, json: false };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "-h" || a === "--help") return { help: true };
    else if (a === "--predecessor") o.predecessor = rest[++i];
    else if (a === "--intent") o.intent = rest[++i];
    else if (a === "--output-dir") o.outputDir = rest[++i];
    else if (a === "--built-at") o.builtAt = rest[++i];
    else if (a === "--build-commit") o.buildCommit = rest[++i];
    else if (a === "--force") o.force = true;
    else if (a === "--json") o.json = true;
    else die(2, `shadow-audit-package: unknown argument: ${a}`);
  }
  return o;
}

function cmdDecide(rest) {
  const args = parseDecideArgs(rest);
  if (args.help) { process.stdout.write(readHelp()); process.exit(0); }
  if (!args.predecessor) die(2, "shadow-audit-package decide: --predecessor <prior-package-dir> is required");
  if (!args.intent) die(2, "shadow-audit-package decide: --intent <decision-intent.json> is required");
  if (!args.outputDir) die(2, "shadow-audit-package decide: --output-dir <dir> is required (explicit, never implied)");

  const predecessorDir = resolve(args.predecessor);
  if (!existsSync(predecessorDir)) die(3, `shadow-audit-package: --predecessor package directory not found: ${predecessorDir}`);
  const outDir = resolve(args.outputDir);
  if (outDir === predecessorDir)
    die(3, "shadow-audit-package: --output-dir must not be the --predecessor package — the predecessor is immutable and is never overwritten (not even with --force)");
  if (existsSync(outDir) && !args.force)
    die(3, `shadow-audit-package: ${outDir} already exists. Refusing to overwrite (pass --force to replace it).`);

  let intent;
  try { intent = JSON.parse(readInput(resolve(args.intent), "--intent decision intent").toString("utf8")); }
  catch (e) { die(3, `shadow-audit-package: --intent is not valid JSON: ${e.message}`); }

  let producerVersion = "unknown";
  try { producerVersion = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")).version ?? "unknown"; } catch { /* keep "unknown" */ }

  let assembled;
  try {
    assembled = assembleDecisionPackage({
      predecessorDir,
      intent,
      // deterministic: the intent's own decided_at_utc by default, never wall clock
      builtAt: args.builtAt ?? intent?.decided_at_utc ?? null,
      buildCommit: args.buildCommit ?? detectBuildCommit(),
      producerVersion,
      packagePrivateKeyPem: FIXTURE_RELEASE_PRIVATE_PEM,
      packagePublicKeyPem: FIXTURE_RELEASE_PUBLIC_PEM,
      keyLabel: FIXTURE_RELEASE_LABEL,
    });
  } catch (e) {
    die(e.code === "SELF_VALIDATION" ? 4 : 3, `shadow-audit-package: ${e.message}`);
  }

  // atomic: write everything into a temp sibling, self-verify (package + chain +
  // lifecycle), then rename; a failed run leaves no partial package
  const tmpDir = `${outDir}.tmp-${process.pid}`;
  let selfChain;
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
      die(4, `shadow-audit-package: assembled decision package failed self-verification — nothing written:\n  - ${self.failures.map((f) => `${f.code}: ${f.detail}`).join("\n  - ")}`);
    }
    selfChain = verifyDecisionChain([predecessorDir, tmpDir], { requireCompleteChain: false });
    if (!selfChain.ok) {
      rmSync(tmpDir, { recursive: true, force: true });
      const fails = [...selfChain.chain.chain_failures, ...selfChain.decision_failures, ...selfChain.lifecycle.failures];
      die(4, `shadow-audit-package: assembled decision successor failed chain/lifecycle self-verification — nothing written:\n  - ${fails.map((f) => `${f.code}: ${f.detail}`).join("\n  - ")}`);
    }
    if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true }); // only reachable with --force
    renameSync(tmpDir, outDir);
  } catch (e) {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
    if (typeof e?.status === "number") throw e; // process.exit already in flight
    die(3, `shadow-audit-package: cannot write package: ${e.message}`);
  }

  const m = assembled.manifest;
  const d = assembled.decisionMember;
  if (args.json) {
    process.stdout.write(JSON.stringify({
      ok: true, manifest_version: m.manifest_version, package_id: m.package_id,
      case_id: m.case_id, evidence_session_id: m.bindings.evidence_session_id,
      key_provenance: m.signing.key_provenance, member_count: m.assets.length,
      output_dir: outDir,
      supersedes: m.supersedes,
      decision: {
        decision_id: d.decision_id, decision_type: d.decision_type,
        actor_id: d.actor.actor_id, actor_role: d.actor.role,
        identity_class: d.actor.identity_class,
        target_type: d.target.type, target_object_id: d.target.object_id,
        status_tokens: d.status_tokens,
      },
      lifecycle: { state: selfChain.lifecycle.state, effective_disposition: selfChain.lifecycle.effective_disposition, qualifier: selfChain.lifecycle.qualifier },
    }) + "\n");
  } else {
    process.stdout.write(
      `wrote ${outDir}  (${m.manifest_version}, ${m.assets.length} members, case ${m.case_id})\n` +
      `decision: ${d.decision_type} by ${d.actor.actor_id} (${d.actor.role}, operator-declared fixture identity — NOT authenticated)\n` +
      `supersedes package ${m.supersedes.predecessor_package_id.slice(0, 16)}… — the predecessor and the original Council conclusion remain valid, unchanged, independently verifiable\n` +
      `lifecycle (${selfChain.lifecycle.qualifier}): ${selfChain.lifecycle.state} — effective disposition: ${selfChain.lifecycle.effective_disposition ?? "(original council output)"}\n` +
      `signed with ${m.signing.key_label} (key_provenance=fixture) — the package signer is NOT the decision actor\n` +
      `${DECISION_BOUNDARY_STATEMENT}\n`);
  }
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "-h" || cmd === "--help") { process.stdout.write(readHelp()); process.exit(cmd ? 0 : 2); }
  if (cmd === "create") return cmdCreate(rest);
  if (cmd === "verify") return cmdVerify(rest);
  if (cmd === "verify-chain") return cmdVerifyChain(rest);
  if (cmd === "decide") return cmdDecide(rest);
  die(2, `shadow-audit-package: unknown command "${cmd}" (supported: create, verify, verify-chain, decide)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
