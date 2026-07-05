// v1.5.8 dictionary-hash binding contract tests.
//
// The counsel-signed reason-code dictionary is Reg B's highest-stakes control.
// If a downstream can silently swap `lib/schemas/reason-code-dictionary.json`
// between signature time and audit time, the borrower-facing denial reason
// no longer matches what bank counsel signed off on. That's a Reg B violation
// and a class-action risk.
//
// Binding the SHA-256 of the dictionary file bytes into the attestation
// signing payload closes that gap: any post-hoc edit changes the file hash,
// and every attestation signed against the old bytes fails verification.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import loanCouncilHandler from "../api/loan-council.js";
import { buildAttestation, verifyAttestation, SIGNATURE_MODES } from "../lib/attestation.js";
import { computeDictionaryHash } from "../lib/enforce-reason-code-dictionary.js";

function mockReq(body = {}, method = "POST") {
  return { method, body, headers: { "content-type": "application/json" } };
}
function mockRes() {
  const res = {
    statusCode: 200, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    end() { return this; }
  };
  return res;
}

const CLEAN_LOAN = {
  credit_score: 740,
  debt_to_income: 0.28,
  loan_to_value: 0.65,
  amount: 250000,
  sector: "industrials",
  fair_lending_review_flag: false,
  market_proxy_prices: [100, 101, 99, 102, 100, 101, 99, 100, 101, 100, 99],
};

test("computeDictionaryHash returns a stable 64-char SHA-256 hex", () => {
  const h1 = computeDictionaryHash();
  const h2 = computeDictionaryHash();
  assert.equal(h1, h2);
  assert.equal(h1.length, 64);
  assert.match(h1, /^[0-9a-f]{64}$/);
});

test("loan-council response includes attestation.dictionary_hash matching the current file", async () => {
  const res = mockRes();
  await loanCouncilHandler(mockReq({ loan: CLEAN_LOAN }), res);
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.attestation.dictionary_hash);
  assert.equal(res.body.attestation.dictionary_hash, computeDictionaryHash());
});

test("attestation with dictionary_hash verifies happy path (HMAC)", () => {
  const request = { loan: CLEAN_LOAN };
  const response = { verdict: "approve", voices: [] };
  const dictionaryHash = computeDictionaryHash();
  const att = buildAttestation({
    request, response, modelId: "sonnet",
    mode: SIGNATURE_MODES.HMAC, secret: "s", dictionaryHash,
  });
  assert.equal(att.dictionary_hash, dictionaryHash);
  const result = verifyAttestation(att, request, response, { secret: "s" });
  assert.equal(result.ok, true);
});

test("attestation with dictionary_hash verifies happy path (Ed25519)", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const request = { loan: CLEAN_LOAN };
  const response = { verdict: "approve" };
  const dictionaryHash = computeDictionaryHash();
  const att = buildAttestation({
    request, response, modelId: "sonnet",
    mode: SIGNATURE_MODES.ED25519, privateKey, dictionaryHash,
  });
  const result = verifyAttestation(att, request, response, { publicKey });
  assert.equal(result.ok, true);
});

test("tampering with dictionary_hash field breaks Ed25519 verification", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const request = { loan: CLEAN_LOAN };
  const response = { verdict: "approve" };
  const att = buildAttestation({
    request, response, modelId: "sonnet",
    mode: SIGNATURE_MODES.ED25519, privateKey,
    dictionaryHash: "aa".repeat(32),
  });
  // Attacker rewrites dictionary_hash to a different value (pointing to a
  // tampered dictionary they swapped in after Shadow signed).
  const tampered = { ...att, dictionary_hash: "bb".repeat(32) };
  const result = verifyAttestation(tampered, request, response, { publicKey });
  assert.equal(result.ok, false);
  assert.match(result.reason, /ed25519 signature mismatch/);
});

test("tampering with dictionary_hash field breaks HMAC verification", () => {
  const request = { loan: CLEAN_LOAN };
  const response = { verdict: "approve" };
  const att = buildAttestation({
    request, response, modelId: "sonnet",
    mode: SIGNATURE_MODES.HMAC, secret: "s",
    dictionaryHash: "aa".repeat(32),
  });
  const tampered = { ...att, dictionary_hash: "cc".repeat(32) };
  const result = verifyAttestation(tampered, request, response, { secret: "s" });
  assert.equal(result.ok, false);
  assert.match(result.reason, /signature mismatch/);
});

test("pre-v1.5.8 attestations WITHOUT dictionary_hash still verify (back-compat)", () => {
  // Build an attestation without dictionaryHash — this is the shape of
  // every attestation signed before v1.5.8. If the verifier requires
  // dictionary_hash, we've broken every historical audit record.
  const request = { loan: CLEAN_LOAN };
  const response = { verdict: "approve" };
  const att = buildAttestation({
    request, response, modelId: "sonnet",
    mode: SIGNATURE_MODES.HMAC, secret: "s",
    // no dictionaryHash — the pre-v1.5.8 shape
  });
  assert.equal(att.dictionary_hash, undefined,
    "pre-v1.5.8 attestation must NOT include dictionary_hash field");
  const result = verifyAttestation(att, request, response, { secret: "s" });
  assert.equal(result.ok, true,
    "pre-v1.5.8 attestation must still verify to preserve wire back-compat");
});

test("attestation from a rotated dictionary fails against the new file's hash", () => {
  // Simulate: Shadow signed on Monday with dictionary_hash=X. On Tuesday
  // the dictionary was legitimately rotated (bank counsel signed off on
  // a new version) — now the file hash is Y. Monday's attestation must
  // now FAIL rehash if we use the LIVE dictionary hash, because the
  // signed record is still valid but points to the retired dictionary.
  //
  // This proves rotation is detectable — auditor sees:
  //   attestation.dictionary_hash != computeDictionaryHash()
  // and knows the attestation was signed against a retired dictionary.
  // Which is the whole point: an auditor can independently verify which
  // counsel-signed dictionary was in force at decision time.
  const request = { loan: CLEAN_LOAN };
  const response = { verdict: "approve" };
  const oldHash = "d".repeat(64);
  const att = buildAttestation({
    request, response, modelId: "sonnet",
    mode: SIGNATURE_MODES.HMAC, secret: "s",
    dictionaryHash: oldHash,
  });
  // Signature verifies (the attestation is authentic to when it was signed):
  const result = verifyAttestation(att, request, response, { secret: "s" });
  assert.equal(result.ok, true);
  // But the auditor can independently check that the dictionary_hash
  // does NOT match the current file's hash — this surfaces the rotation.
  assert.notEqual(att.dictionary_hash, computeDictionaryHash(),
    "auditor's dictionary hash check would detect the retired dictionary");
});
