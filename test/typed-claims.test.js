// test/typed-claims.test.js
// v1.5.37 contract tests for typed-claim envelope + attestation binding.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import {
  CLAIM_TYPE,
  AUDIT_EXPECTATION,
  buildTypedClaimEnvelope,
  claimTypeCommitment,
  classifyClaimType,
} from "../lib/typed-claims.js";
import {
  buildAttestation, verifyAttestation, SIGNATURE_MODES,
} from "../lib/attestation.js";


test("CLAIM_TYPE has 4 entries per Pramana taxonomy", () => {
  assert.equal(Object.values(CLAIM_TYPE).length, 4);
  assert.equal(CLAIM_TYPE.PERCEPTION, "perception");
  assert.equal(CLAIM_TYPE.INFERENCE, "inference");
  assert.equal(CLAIM_TYPE.ANALOGY, "analogy");
  assert.equal(CLAIM_TYPE.TESTIMONY, "testimony");
});


test("AUDIT_EXPECTATION covers every claim type + names a replay class", () => {
  for (const ct of Object.values(CLAIM_TYPE)) {
    assert.ok(AUDIT_EXPECTATION[ct], `expectation for ${ct}`);
    assert.ok(AUDIT_EXPECTATION[ct].class, `class named for ${ct}`);
    assert.ok(AUDIT_EXPECTATION[ct].what_to_verify.length > 0);
    assert.ok(Array.isArray(AUDIT_EXPECTATION[ct].additional_hashes_required));
  }
});


test("INFERENCE requires sampling_seed_commitment", () => {
  const req = AUDIT_EXPECTATION[CLAIM_TYPE.INFERENCE].additional_hashes_required;
  assert.ok(req.includes("sampling_seed_commitment_sha256"));
});


test("ANALOGY requires citation_registry", () => {
  const req = AUDIT_EXPECTATION[CLAIM_TYPE.ANALOGY].additional_hashes_required;
  assert.ok(req.includes("citation_registry_sha256"));
});


test("PERCEPTION requires no additional hashes (deterministic replay is enough)", () => {
  const req = AUDIT_EXPECTATION[CLAIM_TYPE.PERCEPTION].additional_hashes_required;
  assert.equal(req.length, 0);
});


test("buildTypedClaimEnvelope throws on unknown claim type", () => {
  assert.throws(() => buildTypedClaimEnvelope("nonsense"),
    /unknown claim_type/);
});


test("buildTypedClaimEnvelope: returns hash + expectation + anchor", () => {
  const env = buildTypedClaimEnvelope(CLAIM_TYPE.INFERENCE);
  assert.equal(env.claim_type, "inference");
  assert.equal(env.audit_expectation_class, "seed-commitment-replay");
  assert.equal(env.anchor, "arXiv:2605.20312");
  assert.equal(env.envelope_hash_sha256.length, 64);
  assert.match(env.envelope_hash_sha256, /^[0-9a-f]{64}$/);
});


test("claimTypeCommitment: 4 distinct hex values", () => {
  const hashes = new Set(
    Object.values(CLAIM_TYPE).map(claimTypeCommitment),
  );
  assert.equal(hashes.size, 4, "each claim type must produce distinct hash");
});


test("claimTypeCommitment: deterministic per class", () => {
  const a = claimTypeCommitment(CLAIM_TYPE.PERCEPTION);
  const b = claimTypeCommitment(CLAIM_TYPE.PERCEPTION);
  assert.equal(a, b);
});


test("classifyClaimType: LBO + loan + verdict → PERCEPTION", () => {
  const ct = classifyClaimType({
    scenario: "lbo", loan: { fico: 720 }, verdict: "escalate",
  });
  assert.equal(ct, CLAIM_TYPE.PERCEPTION);
});


test("classifyClaimType: refuse_to_serve → TESTIMONY", () => {
  const ct = classifyClaimType({
    scenario: "lbo", loan: { fico: 720 }, verdict: "refuse_to_serve",
  });
  assert.equal(ct, CLAIM_TYPE.TESTIMONY);
});


test("classifyClaimType: no loan → INFERENCE", () => {
  const ct = classifyClaimType({ scenario: "compliance" });
  assert.equal(ct, CLAIM_TYPE.INFERENCE);
});


test("BINDING: attestation signs over claim_type_sha256 (HMAC)", () => {
  const hash = claimTypeCommitment(CLAIM_TYPE.INFERENCE);
  const request = { loan: { fico: 720 } };
  const response = { verdict: "escalate" };
  const att = buildAttestation({
    request, response,
    modelId: "claude-sonnet-4-6",
    secret: "test-secret",
    claimTypeSha256: hash,
  });
  assert.equal(att.claim_type_sha256, hash);
  const v = verifyAttestation(att, request, response, "test-secret");
  assert.equal(v.ok, true);
});


test("TAMPER DETECTION: reclassifying claim_type breaks Ed25519 verify", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const originalHash = claimTypeCommitment(CLAIM_TYPE.INFERENCE);
  const tamperedHash = claimTypeCommitment(CLAIM_TYPE.PERCEPTION); // silent downgrade
  const request = { loan: { fico: 720 } };
  const response = { verdict: "escalate" };
  const att = buildAttestation({
    request, response,
    modelId: "claude-sonnet-4-6",
    mode: SIGNATURE_MODES.ED25519,
    privateKey,
    claimTypeSha256: originalHash,
  });
  att.claim_type_sha256 = tamperedHash;
  const v = verifyAttestation(att, request, response, { publicKey });
  assert.equal(v.ok, false);
});


test("BACK-COMPAT: attestation without claim_type field verifies unchanged", () => {
  const request = { loan: { fico: 720 } };
  const response = { verdict: "approve" };
  const att = buildAttestation({
    request, response,
    modelId: "claude-sonnet-4-6",
    secret: "test-secret",
    // no claimTypeSha256
  });
  assert.equal(att.claim_type_sha256, undefined);
  const v = verifyAttestation(att, request, response, "test-secret");
  assert.equal(v.ok, true);
});


test("BINDING: attestation signs over claim_type_sha256 (Ed25519)", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const hash = claimTypeCommitment(CLAIM_TYPE.TESTIMONY);
  const request = { loan: { fico: 720, aml_flags: ["OFAC_SDN_MATCH"] } };
  const response = { verdict: "refuse_to_serve" };
  const att = buildAttestation({
    request, response,
    modelId: "claude-sonnet-4-6",
    mode: SIGNATURE_MODES.ED25519,
    privateKey,
    claimTypeSha256: hash,
  });
  const v = verifyAttestation(att, request, response, { publicKey });
  assert.equal(v.ok, true);
});


test("PROCUREMENT: envelope surfaces additional_hashes_required for auditor", () => {
  // Bank counsel opening the envelope for an inference-class claim
  // should immediately see they need to verify the seed commitment too.
  const env = buildTypedClaimEnvelope(CLAIM_TYPE.INFERENCE);
  assert.ok(env.additional_hashes_required.includes("sampling_seed_commitment_sha256"));
  assert.match(env.audit_expectation_summary, /seed|temperature|model_id/i);
});
