// §3 / §9 — the production insecure-default-secret guard must fire on EVERY public HMAC signing path,
// and MUST NOT fire on safe paths (explicit secret, ed25519, dev/test, Ed25519 batch/session). No public
// production path may silently reach the dev default secret. v1 verification support is unchanged.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { buildAttestation } from "../packages/attest-core/attestation.js";
import { buildAttestationV2, signAttestation, DEV_DEFAULT_SECRET } from "../packages/attest-core/attestation-v2.js";
import { batchSignAttestations } from "../packages/attest-core/attestation-batch.js";
import { createSession, sealSession } from "../packages/attest-core/session.js";

// Set NODE_ENV=production only for the duration of fn, then restore (test-runner isolates this file's
// process, and tests within a file run serially, so this is safe).
function inProd(fn) {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try { return fn(); } finally { if (prev === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prev; }
}
const isInsecure = (e) => e && e.code === "ERR_INSECURE_DEFAULT_SECRET";

const H = "a".repeat(64);
const v1Args = { request: { x: 1 }, response: { y: 2 }, mode: "hmac-sha256", modelId: "m", completedAtUtc: "2026-01-01T00:00:00Z", keyId: "k" };
const v2Args = { requestCommitment: H, outputCommitment: "b".repeat(64), modelId: "m", completedAtUtc: "2026-01-01T00:00:00Z", keyId: "k", mode: "hmac-sha256" };

// ── every public production HMAC path is REJECTED with the insecure default ──
test("V1 buildAttestation (the API's path) rejects the default secret in production", () => {
  inProd(() => {
    assert.throws(() => buildAttestation({ ...v1Args }), isInsecure);                    // no secret → default
    assert.throws(() => buildAttestation({ ...v1Args, secret: DEV_DEFAULT_SECRET }), isInsecure); // explicit default
  });
});

test("V2 buildAttestationV2 + signAttestation reject the default secret in production", () => {
  inProd(() => {
    assert.throws(() => buildAttestationV2({ ...v2Args }), isInsecure);
    assert.throws(() => buildAttestationV2({ ...v2Args, secret: DEV_DEFAULT_SECRET }), isInsecure);
    assert.throws(() => signAttestation({ ...v2Args }), isInsecure);
  });
});

// ── safe paths still work in production ──
test("an EXPLICIT real secret signs in production on BOTH wire versions", () => {
  inProd(() => {
    assert.match(buildAttestation({ ...v1Args, secret: "real-prod-secret" }).version, /v1/);
    assert.equal(buildAttestationV2({ ...v2Args, secret: "real-prod-secret" }).version, "aex-attestation/v2");
  });
});

test("an explicit secret produces IDENTICAL v1 bytes regardless of env (guard never alters valid bytes)", () => {
  const prodSig = inProd(() => buildAttestation({ ...v1Args, secret: "S" }).signature);
  const devSig = buildAttestation({ ...v1Args, secret: "S" }).signature;
  assert.equal(prodSig, devSig, "guard must not change bytes for a valid secret");
});

test("ed25519 signs in production on both wire versions (no shared secret to guard)", () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  inProd(() => {
    assert.match(buildAttestation({ ...v1Args, mode: "ed25519", privateKey }).version, /v1/);
    assert.equal(buildAttestationV2({ ...v2Args, mode: "ed25519", privateKey }).version, "aex-attestation/v2");
  });
});

test("Ed25519 batch + session signing work in production (no HMAC secret path exists)", () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  inProd(() => {
    const a1 = buildAttestation({ ...v1Args, mode: "ed25519", privateKey });
    const batch = batchSignAttestations([a1], { privateKey, keyId: "k", batchId: "b1" });
    assert.ok(batch.batch_signature, "batch Ed25519 signing should succeed in prod");
    const s = createSession({ agent: { name: "t", version: "1" }, models: [{ model_id: "m", provider: "p" }], environmentFingerprint: { os: "test", node_version: process.version }, keyId: "k", privateKey });
    assert.ok(sealSession(s).batch_root, "session Ed25519 sealing should succeed in prod");
  });
});

test("session signing has NO hmac path that could reach the default secret", () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  assert.throws(
    () => createSession({ agent: { name: "t", version: "1" }, models: [], environmentFingerprint: { os: "test", node_version: process.version }, keyId: "k", privateKey, signingAlgorithm: "hmac-sha256" }),
    /not yet implemented/,
    "if an HMAC session path is ever added it must also carry the guard — this pins that it does not exist yet",
  );
});

// ── dev/test default still works (fixtures) + error hygiene ──
test("dev/test env keeps the default secret working (fixtures unaffected)", () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  try {
    assert.match(buildAttestation({ ...v1Args }).version, /v1/);
    assert.equal(buildAttestationV2({ ...v2Args }).signature.length, 64);
  } finally { if (prev === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prev; }
});

test("the v1 insecure-secret error carries the code and never echoes the secret value", () => {
  inProd(() => {
    try { buildAttestation({ ...v1Args, secret: DEV_DEFAULT_SECRET }); assert.fail("should throw"); }
    catch (e) { assert.equal(e.code, "ERR_INSECURE_DEFAULT_SECRET"); assert.equal(e.message.includes(DEV_DEFAULT_SECRET), false); }
  });
});
