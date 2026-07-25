// Portable signed audit package — tamper, binding, replay, key and signature
// matrix. Every case must fail CLOSED with a named reason from the closed
// failure vocabulary. A golden package is created once via the real CLI, then
// copied and mutated per test. Manifest mutations are re-signed with the
// (public, repo-committed) FIXTURE RELEASE KEY where the test models an
// attacker who holds the fixture key — the binding/derivation checks must
// still catch the substitution.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateKeyPairSync, createPublicKey } from "node:crypto";
import { signManifest, sha256Hex } from "../verify/verify-manifest.mjs";
import { FIXTURE_RELEASE_PRIVATE_PEM } from "../verify/fixture-release-key.mjs";
import { createSession, sealSession } from "../packages/attest-core/index.js";
import { buildAttestation, SIGNATURE_MODES } from "../packages/attest-core/attestation.js";
import { MEMBER_PATHS, computePackageId, verifyPackageDir, FAILURE_CODES } from "../lib/portable-audit-package.mjs";

const ROOT = process.cwd();
const CLI = join(ROOT, "bin", "shadow-audit-package.mjs");
const BARE_ENV = { PATH: process.env.PATH };
const run = (args) => spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: BARE_ENV });
const dir = () => mkdtempSync(join(tmpdir(), "shadow-audit-pkg-verify-"));

// golden package, created once through the real CLI
const GOLDEN = join(dir(), "golden");
{
  const r = run(["create", "--fixture", "banking", "--output-dir", GOLDEN]);
  assert.equal(r.status, 0, r.stderr);
}

const copyPkg = () => { const d = join(dir(), "pkg"); cpSync(GOLDEN, d, { recursive: true }); return d; };
const readManifest = (pkg) => JSON.parse(readFileSync(join(pkg, "manifest.json"), "utf8"));
const writeRaw = (pkg, rel, s) => writeFileSync(join(pkg, rel), s, "utf8");

// mutate the unsigned manifest, then re-sign with the fixture key (attacker-with-fixture-key model)
function mutateAndResign(pkg, mutate) {
  const m = readManifest(pkg);
  delete m.signature;
  mutate(m);
  writeRaw(pkg, "manifest.json", JSON.stringify(signManifest(m, FIXTURE_RELEASE_PRIVATE_PEM), null, 2) + "\n");
}
// recompute per-member size/hash + package_id from what is on disk
function rehash(pkg, m) {
  for (const a of m.assets) {
    const b = readFileSync(join(pkg, a.path));
    a.byte_size = b.length;
    a.sha256 = sha256Hex(b);
  }
  m.package_id = computePackageId(m.assets);
}

function expectFailure(pkg, ...codes) {
  const r = run(["verify", "--package", pkg, "--json"]);
  assert.equal(r.status, 1, `expected verification failure, got status ${r.status}: ${r.stdout}${r.stderr}`);
  const res = JSON.parse(r.stdout);
  assert.equal(res.ok, false);
  assert.equal(res.verdict, "FAILED");
  for (const f of res.failures) assert.ok(FAILURE_CODES.includes(f.code), `code outside closed vocabulary: ${f.code}`);
  for (const c of codes) {
    assert.ok(res.failures.some((f) => f.code === c),
      `expected failure ${c}, got: ${JSON.stringify(res.failures)}`);
  }
  return res;
}

// a second, valid, differently-keyed evidence bundle from ANOTHER session
function otherSessionBundle(sessionId = "other-session-0001") {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const s = createSession({
    agent: { name: "substitute-agent", version: "1" },
    environmentFingerprint: { os: "test", node_version: "test" },
    keyId: "substitute-1",
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
    sessionId,
    startedAtUtc: "2026-07-22T00:00:00.000Z",
  });
  const bundle = sealSession(s, { endedAtUtc: "2026-07-22T00:00:01.000Z" });
  return { bundle, publicPem: publicKey.export({ type: "spki", format: "pem" }) };
}

// ---------------------------------------------------------------------------
// B · binding and replay resistance
// ---------------------------------------------------------------------------

test("changed case_id without re-signing → MANIFEST_SIGNATURE_FAILED (the binding is signed)", () => {
  const pkg = copyPkg();
  const m = readManifest(pkg);
  m.case_id = "case-9999-X-0001";
  writeRaw(pkg, "manifest.json", JSON.stringify(m, null, 2) + "\n");
  expectFailure(pkg, "MANIFEST_SIGNATURE_FAILED");
});

test("case_id substituted AND re-signed → BINDING_MISMATCH against the presentation member", () => {
  const pkg = copyPkg();
  mutateAndResign(pkg, (m) => { m.case_id = "case-9999-X-0001"; m.bindings.case_id = "case-9999-X-0001"; });
  expectFailure(pkg, "BINDING_MISMATCH");
});

test("evidence_session_id substituted AND re-signed → BINDING_MISMATCH against the evidence header", () => {
  const pkg = copyPkg();
  mutateAndResign(pkg, (m) => { m.bindings.evidence_session_id = "some-other-session"; });
  expectFailure(pkg, "BINDING_MISMATCH");
});

test("bindings.case_id diverging from case_id (re-signed) → BINDING_MISMATCH", () => {
  const pkg = copyPkg();
  mutateAndResign(pkg, (m) => { m.bindings.case_id = "case-other"; });
  expectFailure(pkg, "BINDING_MISMATCH");
});

test("evidence bundle replayed from another session without re-signing → TAMPERED", () => {
  const pkg = copyPkg();
  const { bundle } = otherSessionBundle();
  writeRaw(pkg, MEMBER_PATHS.evidence, JSON.stringify(bundle, null, 2) + "\n");
  expectFailure(pkg, "TAMPERED");
});

test("evidence bundle replayed from another session, re-hashed + re-signed → BINDING_MISMATCH (session binding holds)", () => {
  const pkg = copyPkg();
  const { bundle, publicPem } = otherSessionBundle();
  writeRaw(pkg, MEMBER_PATHS.evidence, JSON.stringify(bundle, null, 2) + "\n");
  writeRaw(pkg, MEMBER_PATHS.evidenceKey, publicPem);
  mutateAndResign(pkg, (m) => {
    rehash(pkg, m);
    m.signing.evidence_public_key_fingerprint_sha256 = sha256Hex(
      // full-length fingerprint of the substituted key so only the SESSION binding is left to catch it
      generatePublicDer(publicPem));
    // bindings.evidence_session_id deliberately NOT updated — that is the replay
  });
  expectFailure(pkg, "BINDING_MISMATCH");
});

function generatePublicDer(pem) { return createPublicKey(pem).export({ type: "spki", format: "der" }); }

test("package_id substitution (re-signed) → BINDING_MISMATCH (content-derived id must re-derive)", () => {
  const pkg = copyPkg();
  mutateAndResign(pkg, (m) => { m.package_id = "0".repeat(64); });
  expectFailure(pkg, "BINDING_MISMATCH");
});

test("member schema-version substitution (re-signed) → UNSUPPORTED, never best-effort", () => {
  const pkg = copyPkg();
  mutateAndResign(pkg, (m) => {
    m.assets.find((a) => a.role === "presentation").schema_version = "shadow-flow-export/2.0";
  });
  expectFailure(pkg, "UNSUPPORTED");
});

test("manifest_version substitution → UNSUPPORTED", () => {
  const pkg = copyPkg();
  mutateAndResign(pkg, (m) => { m.manifest_version = "shadow-portable-audit-package/9.9"; });
  expectFailure(pkg, "UNSUPPORTED");
});

test("producer-version substitution without re-signing → MANIFEST_SIGNATURE_FAILED (producer identity is signed)", () => {
  const pkg = copyPkg();
  const m = readManifest(pkg);
  m.producer.version = "0.0.0-forged";
  writeRaw(pkg, "manifest.json", JSON.stringify(m, null, 2) + "\n");
  expectFailure(pkg, "MANIFEST_SIGNATURE_FAILED");
});

// ---------------------------------------------------------------------------
// C · member tampering
// ---------------------------------------------------------------------------

test("changed presentation member (still schema-valid JSON) → TAMPERED", () => {
  const pkg = copyPkg();
  const p = JSON.parse(readFileSync(join(pkg, MEMBER_PATHS.presentation), "utf8"));
  p.rows[0].recommendation = "APPROVE"; // the whole point: a plausible business flip
  writeRaw(pkg, MEMBER_PATHS.presentation, JSON.stringify(p, null, 2) + "\n");
  expectFailure(pkg, "TAMPERED");
});

test("changed evidence event → TAMPERED; re-hashed + re-signed → EVIDENCE_VERIFICATION_FAILED (defense in depth)", () => {
  const pkg = copyPkg();
  const b = JSON.parse(readFileSync(join(pkg, MEMBER_PATHS.evidence), "utf8"));
  b.events[1].actor = "attacker";
  writeRaw(pkg, MEMBER_PATHS.evidence, JSON.stringify(b, null, 2) + "\n");
  expectFailure(pkg, "TAMPERED");

  // second layer: attacker also fixes hashes + re-signs the manifest — the
  // independent bundle verification still fails on the hash chain
  const pkg2 = copyPkg();
  writeRaw(pkg2, MEMBER_PATHS.evidence, JSON.stringify(b, null, 2) + "\n");
  mutateAndResign(pkg2, (m) => rehash(pkg2, m));
  const res = expectFailure(pkg2, "EVIDENCE_VERIFICATION_FAILED");
  assert.match(JSON.stringify(res.failures), /prev_hash_mismatch|batch_root_mismatch/);
});

test("removed member → INCOMPLETE (no partial acceptance)", () => {
  const pkg = copyPkg();
  rmSync(join(pkg, MEMBER_PATHS.provenance));
  expectFailure(pkg, "INCOMPLETE");
});

test("renamed member → INCOMPLETE + UNEXPECTED_MEMBER (path binding breaks both ways)", () => {
  const pkg = copyPkg();
  const bytes = readFileSync(join(pkg, MEMBER_PATHS.provenance));
  rmSync(join(pkg, MEMBER_PATHS.provenance));
  writeFileSync(join(pkg, "provenance/renamed.json"), bytes);
  expectFailure(pkg, "INCOMPLETE", "UNEXPECTED_MEMBER");
});

test("duplicated member declaration (re-signed) → PATH_UNSAFE", () => {
  const pkg = copyPkg();
  mutateAndResign(pkg, (m) => { m.assets.push({ ...m.assets[0] }); });
  expectFailure(pkg, "PATH_UNSAFE");
});

test("case-colliding member declaration (re-signed) → PATH_UNSAFE (deterministic across filesystems)", () => {
  const pkg = copyPkg();
  mutateAndResign(pkg, (m) => {
    const a = m.assets.find((x) => x.role === "provenance");
    m.assets.push({ ...a, path: "Provenance/runtime-manifest.json" });
  });
  expectFailure(pkg, "PATH_UNSAFE");
});

test("duplicate unique role (re-signed) → MANIFEST_MALFORMED", () => {
  const pkg = copyPkg();
  const bytes = readFileSync(join(pkg, MEMBER_PATHS.provenance));
  writeFileSync(join(pkg, "provenance/extra.json"), bytes);
  mutateAndResign(pkg, (m) => {
    const a = m.assets.find((x) => x.role === "provenance");
    m.assets.push({ ...a, path: "provenance/extra.json" });
  });
  expectFailure(pkg, "MANIFEST_MALFORMED");
});

test("extra undeclared file → UNEXPECTED_MEMBER (two-way completeness)", () => {
  const pkg = copyPkg();
  writeFileSync(join(pkg, "padding.txt"), "innocuous-looking extra file");
  expectFailure(pkg, "UNEXPECTED_MEMBER");
});

test("modified declared byte_size (re-signed) → TAMPERED", () => {
  const pkg = copyPkg();
  mutateAndResign(pkg, (m) => { m.assets.find((a) => a.role === "presentation").byte_size += 1; });
  expectFailure(pkg, "TAMPERED");
});

test("modified declared sha256 (re-signed) → TAMPERED", () => {
  const pkg = copyPkg();
  mutateAndResign(pkg, (m) => { m.assets.find((a) => a.role === "evidence").sha256 = "f".repeat(64); });
  expectFailure(pkg, "TAMPERED");
});

test("unknown member role (re-signed) → UNSUPPORTED", () => {
  const pkg = copyPkg();
  mutateAndResign(pkg, (m) => { m.assets.find((a) => a.role === "provenance").role = "business-first-failure"; });
  expectFailure(pkg, "UNSUPPORTED");
});

test("falsified shipped verification-result (re-hashed + re-signed) → VERIFIER_DISAGREEMENT", () => {
  const pkg = copyPkg();
  const v = JSON.parse(readFileSync(join(pkg, MEMBER_PATHS.verification), "utf8"));
  v.result.trust_level = "LOG_ANCHORED"; // claim a stronger posture than reality
  writeRaw(pkg, MEMBER_PATHS.verification, JSON.stringify(v, null, 2) + "\n");
  mutateAndResign(pkg, (m) => rehash(pkg, m));
  expectFailure(pkg, "VERIFIER_DISAGREEMENT");
});

test("unknown capability claim (re-signed) → UNSUPPORTED; missing mandatory honesty token → MANIFEST_MALFORMED", () => {
  const pkg = copyPkg();
  mutateAndResign(pkg, (m) => { m.capability_boundary.push("DEVICE_VALIDATED"); });
  expectFailure(pkg, "UNSUPPORTED");

  const pkg2 = copyPkg();
  mutateAndResign(pkg2, (m) => {
    m.capability_boundary = m.capability_boundary.filter((t) => t !== "SIGNATURE_IS_NOT_ANALYTICAL_CORRECTNESS");
  });
  expectFailure(pkg2, "MANIFEST_MALFORMED");
});

// ---------------------------------------------------------------------------
// D · key and signature
// ---------------------------------------------------------------------------

test("wrong public key → KEY_FINGERPRINT_MISMATCH + MANIFEST_SIGNATURE_FAILED", () => {
  const pkg = copyPkg();
  const { publicKey } = generateKeyPairSync("ed25519");
  const other = join(dir(), "other.pem");
  writeFileSync(other, publicKey.export({ type: "spki", format: "pem" }));
  const r = run(["verify", "--package", pkg, "--public-key", other, "--json"]);
  assert.equal(r.status, 1);
  const res = JSON.parse(r.stdout);
  assert.ok(res.failures.some((f) => f.code === "KEY_FINGERPRINT_MISMATCH"), JSON.stringify(res.failures));
  assert.ok(res.failures.some((f) => f.code === "MANIFEST_SIGNATURE_FAILED"), JSON.stringify(res.failures));
});

test("malformed public key → UNVERIFIABLE", () => {
  const pkg = copyPkg();
  const bad = join(dir(), "bad.pem");
  writeFileSync(bad, "not a pem at all");
  const r = run(["verify", "--package", pkg, "--public-key", bad, "--json"]);
  assert.equal(r.status, 1);
  assert.ok(JSON.parse(r.stdout).failures.some((f) => f.code === "UNVERIFIABLE"));
});

test("tampered embedded package key member → KEY_FINGERPRINT_MISMATCH (hash-bound and fingerprint-bound)", () => {
  const pkg = copyPkg();
  const { publicKey } = generateKeyPairSync("ed25519");
  writeRaw(pkg, MEMBER_PATHS.packageKey, publicKey.export({ type: "spki", format: "pem" }));
  expectFailure(pkg, "KEY_FINGERPRINT_MISMATCH");
});

test("changed signature → MANIFEST_SIGNATURE_FAILED; missing signature → MANIFEST_SIGNATURE_MISSING", () => {
  const pkg = copyPkg();
  const m = readManifest(pkg);
  m.signature = Buffer.from("garbage-signature-bytes-000000000000000000000000000000000000000000000000").toString("base64");
  writeRaw(pkg, "manifest.json", JSON.stringify(m, null, 2) + "\n");
  expectFailure(pkg, "MANIFEST_SIGNATURE_FAILED");

  const pkg2 = copyPkg();
  const m2 = readManifest(pkg2);
  delete m2.signature;
  writeRaw(pkg2, "manifest.json", JSON.stringify(m2, null, 2) + "\n");
  expectFailure(pkg2, "MANIFEST_SIGNATURE_MISSING");
});

test("unsupported signing profile (re-signed) → UNSUPPORTED; HMAC profile → NOT_PORTABLE", () => {
  const pkg = copyPkg();
  mutateAndResign(pkg, (m) => { m.signing.profile = "rsa-pss"; });
  expectFailure(pkg, "UNSUPPORTED");

  const pkg2 = copyPkg();
  mutateAndResign(pkg2, (m) => { m.signing.profile = "hmac-sha256"; });
  expectFailure(pkg2, "NOT_PORTABLE");
});

// ---------------------------------------------------------------------------
// E · path safety at verification time
// ---------------------------------------------------------------------------

test("traversal and absolute member paths (re-signed) → PATH_UNSAFE", () => {
  const pkg = copyPkg();
  mutateAndResign(pkg, (m) => { m.assets.find((a) => a.role === "provenance").path = "../escape.json"; });
  expectFailure(pkg, "PATH_UNSAFE");

  const pkg2 = copyPkg();
  mutateAndResign(pkg2, (m) => { m.assets.find((a) => a.role === "provenance").path = "/etc/passwd"; });
  expectFailure(pkg2, "PATH_UNSAFE");
});

test("symlink inside the package → PATH_UNSAFE (symlinks are never members)", () => {
  const pkg = copyPkg();
  symlinkSync("/etc/hosts", join(pkg, "keys", "escape.pem"));
  expectFailure(pkg, "PATH_UNSAFE");
});

// ---------------------------------------------------------------------------
// attestation member (optional) — inclusion, tamper, replay, portability
// ---------------------------------------------------------------------------

function makeAttestation(overrides = {}) {
  const { privateKey } = generateKeyPairSync("ed25519");
  return buildAttestation({
    request: { case: "fixture-request" },
    response: { verdict: "fixture-response" },
    modelId: "council-v1",
    completedAtUtc: "2026-07-22T00:00:00.000Z",
    mode: SIGNATURE_MODES.ED25519,
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
    keyId: "attestation-fixture-1",
    ...overrides,
  });
}

test("optional attestation member: included, declared, hash-bound; package verifies", () => {
  const parent = dir();
  const attPath = join(parent, "attestation.json");
  writeFileSync(attPath, JSON.stringify(makeAttestation(), null, 2) + "\n");
  const out = join(parent, "pkg");
  const r = run(["create", "--fixture", "banking", "--output-dir", out, "--attestation", attPath]);
  assert.equal(r.status, 0, r.stderr);
  const m = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
  assert.ok(m.assets.some((a) => a.role === "attestation" && a.path === MEMBER_PATHS.attestation));
  assert.equal(run(["verify", "--package", out]).status, 0);

  // tampered attestation → TAMPERED
  const t1 = join(parent, "t1"); cpSync(out, t1, { recursive: true });
  const att = JSON.parse(readFileSync(join(t1, MEMBER_PATHS.attestation), "utf8"));
  att.model_id = "swapped-model";
  writeFileSync(join(t1, MEMBER_PATHS.attestation), JSON.stringify(att, null, 2) + "\n");
  const rv = spawnSync(process.execPath, [CLI, "verify", "--package", t1, "--json"], { encoding: "utf8", env: BARE_ENV });
  assert.equal(rv.status, 1);
  assert.ok(JSON.parse(rv.stdout).failures.some((f) => f.code === "TAMPERED"));

  // attestation replayed from elsewhere (valid envelope, different content) → TAMPERED
  const t2 = join(parent, "t2"); cpSync(out, t2, { recursive: true });
  writeFileSync(join(t2, MEMBER_PATHS.attestation), JSON.stringify(makeAttestation({ modelId: "other-model" }), null, 2) + "\n");
  const rv2 = spawnSync(process.execPath, [CLI, "verify", "--package", t2, "--json"], { encoding: "utf8", env: BARE_ENV });
  assert.equal(rv2.status, 1);
  assert.ok(JSON.parse(rv2.stdout).failures.some((f) => f.code === "TAMPERED"));
});

test("HMAC-mode attestation is rejected at create time as NOT_PORTABLE", () => {
  const parent = dir();
  const att = buildAttestation({
    request: { q: 1 }, response: { a: 2 }, modelId: "m",
    completedAtUtc: "2026-07-22T00:00:00.000Z", mode: SIGNATURE_MODES.HMAC, secret: "dev-secret",
  });
  const attPath = join(parent, "hmac-att.json");
  writeFileSync(attPath, JSON.stringify(att), "utf8");
  const r = run(["create", "--fixture", "banking", "--output-dir", join(parent, "pkg"), "--attestation", attPath]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /NOT_PORTABLE/);
});

// ---------------------------------------------------------------------------
// module-level API sanity (importable, closed vocabulary)
// ---------------------------------------------------------------------------

test("verifyPackageDir is importable and returns the same verdict as the CLI", () => {
  const res = verifyPackageDir(GOLDEN);
  assert.equal(res.ok, true);
  assert.equal(res.verdict, "VERIFIED_FIXTURE_KEY");
  assert.equal(res.case_id, "case-2026-Q3-0042");
  assert.equal(res.evidence_session_id, "reference-banking-decision-2026-001");
  assert.match(res.boundary, /tamper-evidence only/);
});
