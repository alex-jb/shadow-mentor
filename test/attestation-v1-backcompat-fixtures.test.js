// Backward-compat fixtures for aex-attestation/v1 (§7).
// These pinned v1 proofs (HMAC head / HMAC with a binding / chained / Ed25519) MUST keep verifying
// unchanged forever. v1 signing bytes are frozen — the ambiguity fix is the SEPARATE v2 wire version, not
// a v1 rewrite. This suite also proves a v1 proof is NOT silently accepted as v2 (no cross-version relabel).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicKey } from "node:crypto";
import { buildAttestation, verifyAttestation, ATTESTATION_VERSION } from "../packages/attest-core/attestation.js";
import { computeAttestationHash } from "../packages/attest-core/attestation-chain.js";
import { verifyAttestationV2, verifyAttestationAny } from "../packages/attest-core/attestation-v2.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(readFileSync(join(__dirname, "..", "packages", "attest-core", "golden", "v1-backcompat-fixtures.json"), "utf8"));
const { request: req, response: res, secret } = fx;

test("pinned v1 HMAC head still verifies + signature is byte-stable", () => {
  assert.equal(fx.hmac_head.version, "aex-attestation/v1");
  assert.equal(verifyAttestation(fx.hmac_head, req, res, { secret }).ok, true);
  // re-signing the SAME inputs reproduces the pinned signature (bytes unchanged)
  const resigned = buildAttestation({ request: req, response: res, mode: "hmac-sha256", secret, modelId: fx.hmac_head.model_id, completedAtUtc: fx.hmac_head.completed_at_utc, keyId: fx.hmac_head.key_id });
  assert.equal(resigned.signature, fx.hmac_head.signature, "v1 HMAC bytes drifted — FORBIDDEN");
});

test("pinned v1 HMAC-with-binding still verifies", () => {
  assert.equal(fx.hmac_bound.dictionary_hash, "d".repeat(64));
  assert.equal(verifyAttestation(fx.hmac_bound, req, res, { secret }).ok, true);
});

test("pinned v1 chained attestation verifies and its previous_hash is stable", () => {
  assert.equal(computeAttestationHash(fx.hmac_head), fx.hmac_chained.previous_hash_input);
  assert.equal(fx.hmac_chained.attestation.previous_hash, fx.hmac_chained.previous_hash_input);
  assert.equal(verifyAttestation(fx.hmac_chained.attestation, req, res, { secret }).ok, true);
});

test("pinned v1 Ed25519 attestation still verifies against its public key", () => {
  const publicKey = createPublicKey(fx.ed25519.public_key_pem);
  assert.equal(verifyAttestation(fx.ed25519.attestation, req, res, { publicKey }).ok, true);
});

test("NO SILENT v1→v2 RELABEL: the v2 verifier rejects a v1 proof outright", () => {
  const r = verifyAttestationV2(fx.hmac_head, { secret });
  assert.equal(r.ok, false);
  assert.match(r.reason, /not a v2 attestation/);
});

test("the dispatcher routes each pinned v1 proof to the v1 verifier and passes", () => {
  assert.equal(ATTESTATION_VERSION, "aex-attestation/v1");
  for (const a of [fx.hmac_head, fx.hmac_bound, fx.hmac_chained.attestation]) {
    assert.equal(verifyAttestationAny(a, { secret }, req, res).ok, true);
  }
});

test("a tampered pinned v1 proof fails (fixtures are real signatures, not rubber stamps)", () => {
  const tampered = { ...fx.hmac_head, signature: "0".repeat(fx.hmac_head.signature.length) };
  assert.equal(verifyAttestation(tampered, req, res, { secret }).ok, false);
});
