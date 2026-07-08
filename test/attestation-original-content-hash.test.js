// test/attestation-original-content-hash.test.js
// ──────────────────────────────────────────────────────────────────
// v1.5.20 Pattern C original_content_hash scaffold tests.
// Same conditional append-only pattern as v1.5.8 dictionary_hash,
// v1.5.18 citation_registry_sha256, v1.5.19 proxy_schema_sha256.
//
// Pre-v1.5.20 attestations (no original_content_hash field) verify
// byte-identically. Attestations that opt in bind the field into the
// signature so post-hoc CCR summary swap breaks verification.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { buildAttestation, verifyAttestation } from "../lib/attestation.js";


// ═══════════════════════════════════════════════════════════════
// Back-compat: no originalContentHash param behaves like v1.5.19
// ═══════════════════════════════════════════════════════════════

test("attestation without originalContentHash verifies (back-compat)", () => {
  const request = { loan: { credit_score: 720 } };
  const response = { final_verdict: "approve" };
  const att = buildAttestation({
    request,
    response,
    modelId: "runLoanCouncil/pure-compute",
    secret: "test-secret",
  });
  const result = verifyAttestation(att, request, response, { secret: "test-secret" });
  assert.equal(result.ok, true);
  assert.ok(!att.original_content_hash, "field should be absent when not set");
});


// ═══════════════════════════════════════════════════════════════
// Opt-in: originalContentHash gets bound into signature
// ═══════════════════════════════════════════════════════════════

test("originalContentHash is emitted when passed", () => {
  const request = { loan: { credit_score: 720 } };
  const response = { final_verdict: "approve" };
  const original = "The full uncompressed council rationale here...";
  const originalHash = createHash("sha256").update(original).digest("hex");
  const att = buildAttestation({
    request,
    response,
    modelId: "shadow/ccr-mode@scaffold",
    secret: "test-secret",
    originalContentHash: originalHash,
  });
  assert.equal(att.original_content_hash, originalHash);
});

test("attestation with originalContentHash verifies happy path", () => {
  const request = { loan: { credit_score: 720 } };
  const response = { final_verdict: "approve" };
  const originalHash = createHash("sha256").update("original content").digest("hex");
  const att = buildAttestation({
    request,
    response,
    modelId: "shadow/ccr-mode@scaffold",
    secret: "test-secret",
    originalContentHash: originalHash,
  });
  const result = verifyAttestation(att, request, response, { secret: "test-secret" });
  assert.equal(result.ok, true);
});


// ═══════════════════════════════════════════════════════════════
// Tampering: swapping original_content_hash breaks verification
// ═══════════════════════════════════════════════════════════════

test("tampering with original_content_hash breaks verification", () => {
  const request = { loan: { credit_score: 720 } };
  const response = { final_verdict: "approve" };
  const originalHash = createHash("sha256").update("original A").digest("hex");
  const att = buildAttestation({
    request,
    response,
    modelId: "shadow/ccr-mode@scaffold",
    secret: "test-secret",
    originalContentHash: originalHash,
  });
  // Attacker swaps the field to point at a different pre-compression original
  const tampered = {
    ...att,
    original_content_hash: createHash("sha256").update("attacker chose this").digest("hex"),
  };
  const result = verifyAttestation(tampered, request, response, { secret: "test-secret" });
  assert.equal(result.ok, false);
  assert.match(result.reason, /signature mismatch/);
});


// ═══════════════════════════════════════════════════════════════
// Pre-v1.5.20 wire back-compat
// ═══════════════════════════════════════════════════════════════

test("attestation signed WITHOUT originalContentHash verifies against verifier that expects it optional", () => {
  const request = { loan: { credit_score: 720 } };
  const response = { final_verdict: "approve" };
  const att = buildAttestation({
    request,
    response,
    modelId: "runLoanCouncil/pure-compute",
    secret: "test-secret",
  });
  // Explicitly ensure the field is absent from the attestation object
  assert.equal(att.original_content_hash, undefined);
  // Verifier code path handles the absent case (v1.5.19 attestations)
  const result = verifyAttestation(att, request, response, { secret: "test-secret" });
  assert.equal(result.ok, true);
});
