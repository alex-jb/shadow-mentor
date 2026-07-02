// test/attestation.test.js
// ──────────────────────────────────────────────────────────────────
// Pins the AEX-style attestation contract shipped 2026-07-02.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildAttestation,
  verifyAttestation,
  commitmentOf,
  canonicalize,
  ATTESTATION_VERSION,
} from "../lib/attestation.js";


// ═══════════════════════════════════════════════════════════════
// Canonicalization — the load-bearing property
// ═══════════════════════════════════════════════════════════════

test("canonicalize produces same string for equivalent objects", () => {
  const a = { foo: 1, bar: 2, baz: [1, 2, 3] };
  const b = { baz: [1, 2, 3], bar: 2, foo: 1 };
  assert.equal(canonicalize(a), canonicalize(b));
});


test("canonicalize handles nested objects", () => {
  const a = { outer: { z: 1, a: 2 }, list: [{ y: 1, x: 2 }] };
  const b = { list: [{ x: 2, y: 1 }], outer: { a: 2, z: 1 } };
  assert.equal(canonicalize(a), canonicalize(b));
});


test("canonicalize handles null, string, number, bool", () => {
  assert.equal(canonicalize(null), "null");
  assert.equal(canonicalize("hi"), '"hi"');
  assert.equal(canonicalize(42), "42");
  assert.equal(canonicalize(true), "true");
});


test("commitmentOf is stable across key orderings", () => {
  const c1 = commitmentOf({ foo: 1, bar: 2 });
  const c2 = commitmentOf({ bar: 2, foo: 1 });
  assert.equal(c1, c2);
});


test("commitmentOf differs when content differs", () => {
  const c1 = commitmentOf({ foo: 1 });
  const c2 = commitmentOf({ foo: 2 });
  assert.notEqual(c1, c2);
});


// ═══════════════════════════════════════════════════════════════
// buildAttestation
// ═══════════════════════════════════════════════════════════════

const REQUEST = { loan_id: "TEST-001", credit_score: 720, dti: 0.30 };
const RESPONSE = { verdict: "approve", voices: [{ voice: "Credit", verdict: "approve" }] };

test("buildAttestation emits all required fields", () => {
  const att = buildAttestation({
    request: REQUEST, response: RESPONSE, modelId: "claude-sonnet-4-6",
  });
  assert.equal(att.version, ATTESTATION_VERSION);
  assert.ok(att.request_commitment);
  assert.equal(att.request_commitment.length, 64);  // sha256 hex
  assert.ok(att.output_commitment);
  assert.equal(att.output_commitment.length, 64);
  assert.equal(att.model_id, "claude-sonnet-4-6");
  assert.ok(att.completed_at_utc);
  assert.ok(att.signature);
  assert.equal(att.signature.length, 64);  // hmac-sha256 hex
  assert.ok(att.key_id);
});


test("buildAttestation requires request", () => {
  assert.throws(() => buildAttestation({
    response: RESPONSE, modelId: "sonnet",
  }), /request required/);
});


test("buildAttestation requires response", () => {
  assert.throws(() => buildAttestation({
    request: REQUEST, modelId: "sonnet",
  }), /response required/);
});


test("buildAttestation requires modelId", () => {
  assert.throws(() => buildAttestation({
    request: REQUEST, response: RESPONSE,
  }), /modelId required/);
});


test("buildAttestation captures previousHash for chain", () => {
  const prev = "aaaa1111";
  const att = buildAttestation({
    request: REQUEST, response: RESPONSE, modelId: "sonnet",
    previousHash: prev,
  });
  assert.equal(att.previous_hash, prev);
});


// ═══════════════════════════════════════════════════════════════
// verifyAttestation happy path
// ═══════════════════════════════════════════════════════════════

test("verifyAttestation passes when request + response match", () => {
  const att = buildAttestation({
    request: REQUEST, response: RESPONSE, modelId: "sonnet",
  });
  const result = verifyAttestation(att, REQUEST, RESPONSE);
  assert.equal(result.ok, true);
  assert.equal(result.checks.request_commitment_match, true);
  assert.equal(result.checks.output_commitment_match, true);
  assert.equal(result.checks.signature_match, true);
});


test("verifyAttestation passes on canonicalized equivalent request", () => {
  const att = buildAttestation({
    request: { foo: 1, bar: 2 }, response: RESPONSE, modelId: "sonnet",
  });
  // Re-order keys in the persisted request — should still verify
  const result = verifyAttestation(att, { bar: 2, foo: 1 }, RESPONSE);
  assert.equal(result.ok, true);
});


// ═══════════════════════════════════════════════════════════════
// verifyAttestation catches tampering
// ═══════════════════════════════════════════════════════════════

test("verifyAttestation fails when request was tampered", () => {
  const att = buildAttestation({
    request: REQUEST, response: RESPONSE, modelId: "sonnet",
  });
  const tampered = { ...REQUEST, credit_score: 600 };  // credit score changed
  const result = verifyAttestation(att, tampered, RESPONSE);
  assert.equal(result.ok, false);
  assert.match(result.reason, /request commitment mismatch/);
});


test("verifyAttestation fails when response was tampered", () => {
  const att = buildAttestation({
    request: REQUEST, response: RESPONSE, modelId: "sonnet",
  });
  const tampered = { ...RESPONSE, verdict: "block" };  // verdict changed
  const result = verifyAttestation(att, REQUEST, tampered);
  assert.equal(result.ok, false);
  assert.match(result.reason, /output commitment mismatch/);
});


test("verifyAttestation fails on model_id substitution", () => {
  const att = buildAttestation({
    request: REQUEST, response: RESPONSE, modelId: "claude-sonnet-4-6",
  });
  // An adversary substitutes model_id in the persisted attestation
  const tampered = { ...att, model_id: "claude-haiku-4-5" };
  const result = verifyAttestation(tampered, REQUEST, RESPONSE);
  assert.equal(result.ok, false);
  // Signature won't match because model_id is in the signing payload
  assert.match(result.reason, /signature mismatch/);
});


test("verifyAttestation fails with wrong secret", () => {
  const att = buildAttestation({
    request: REQUEST, response: RESPONSE, modelId: "sonnet",
    secret: "correct-secret",
  });
  const result = verifyAttestation(att, REQUEST, RESPONSE, "wrong-secret");
  assert.equal(result.ok, false);
  assert.match(result.reason, /signature mismatch/);
});


test("verifyAttestation fails on unsupported version", () => {
  const att = buildAttestation({
    request: REQUEST, response: RESPONSE, modelId: "sonnet",
  });
  const tampered = { ...att, version: "aex-attestation/v999" };
  const result = verifyAttestation(tampered, REQUEST, RESPONSE);
  assert.equal(result.ok, false);
  assert.match(result.reason, /unsupported attestation version/);
});


test("verifyAttestation fails on missing attestation", () => {
  const result = verifyAttestation(null, REQUEST, RESPONSE);
  assert.equal(result.ok, false);
  assert.match(result.reason, /missing or malformed/);
});


// ═══════════════════════════════════════════════════════════════
// Hash-chain via previous_hash
// ═══════════════════════════════════════════════════════════════

test("hash-chain: two consecutive attestations link via previous_hash", () => {
  const att1 = buildAttestation({
    request: REQUEST, response: RESPONSE, modelId: "sonnet",
  });
  const att2 = buildAttestation({
    request: { loan_id: "TEST-002" },
    response: { verdict: "escalate" },
    modelId: "sonnet",
    previousHash: att1.signature,
  });
  assert.equal(att2.previous_hash, att1.signature);
});


test("different secrets produce different signatures for same data", () => {
  const att1 = buildAttestation({
    request: REQUEST, response: RESPONSE, modelId: "sonnet",
    secret: "secret-1",
    completedAtUtc: "2026-07-02T00:00:00Z",  // pin time for determinism
  });
  const att2 = buildAttestation({
    request: REQUEST, response: RESPONSE, modelId: "sonnet",
    secret: "secret-2",
    completedAtUtc: "2026-07-02T00:00:00Z",
  });
  assert.notEqual(att1.signature, att2.signature);
  // Commitments match though — same content
  assert.equal(att1.request_commitment, att2.request_commitment);
  assert.equal(att1.output_commitment, att2.output_commitment);
});
