// Contract tests for POST /api/verify-attestation — public HTTP verifier.
// Same primitive as bin/verify-attestation.mjs (CLI) and shadow_verify_attestation
// (MCP tool). All three wrap verifyAttestation() from lib/attestation.js.
//
// A bank auditor sitting outside a chat surface (SIEM pipeline, integration
// test, procurement smoke check) hits this endpoint with the persisted
// attestation + request + response + verification key material. Response is
// the same shape the MCP tool returns so the audit trail is identical
// regardless of dispatch surface.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import verifyHandler from "../api/verify-attestation.js";
import { buildAttestation, SIGNATURE_MODES } from "../lib/attestation.js";

function mockReq(body = {}, method = "POST") {
  return { method, body, headers: { "content-type": "application/json" } };
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    end() { return this; }
  };
  return res;
}

const REQUEST = { loan_id: "HTTP-VER-001", credit_score: 720 };
const RESPONSE = { verdict: "approve", voices: [] };

// ─── happy path ─────────────────────────────────────────────────────

test("verify-attestation POST verifies a good HMAC attestation", async () => {
  const secret = "http-endpoint-test-key";
  const att = buildAttestation({
    request: REQUEST, response: RESPONSE, modelId: "sonnet",
    mode: SIGNATURE_MODES.HMAC, secret,
  });
  const res = mockRes();
  await verifyHandler(mockReq({
    attestation: att,
    original_request: REQUEST,
    original_response: RESPONSE,
    hmac_key: secret,
  }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.mode, SIGNATURE_MODES.HMAC);
  assert.equal(res.body.model_id, "sonnet");
  assert.match(res.body.interpretation, /verified/);
  assert.ok(typeof res.body.latency_ms === "number");
  assert.ok(typeof res.body.timestamp === "string");
});

test("verify-attestation POST verifies a good Ed25519 attestation", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const att = buildAttestation({
    request: REQUEST, response: RESPONSE, modelId: "claude-sonnet-4-6",
    mode: SIGNATURE_MODES.ED25519, privateKey,
  });
  const res = mockRes();
  await verifyHandler(mockReq({
    attestation: att,
    original_request: REQUEST,
    original_response: RESPONSE,
    public_key: publicKey,
  }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.mode, SIGNATURE_MODES.ED25519);
  assert.equal(res.body.model_id, "claude-sonnet-4-6");
});

// ─── tamper detection ──────────────────────────────────────────────

test("verify-attestation POST catches tampered response body", async () => {
  const secret = "s";
  const att = buildAttestation({
    request: REQUEST, response: RESPONSE, modelId: "sonnet",
    mode: SIGNATURE_MODES.HMAC, secret,
  });
  const tampered = { ...RESPONSE, verdict: "block" };
  const res = mockRes();
  await verifyHandler(mockReq({
    attestation: att,
    original_request: REQUEST,
    original_response: tampered,
    hmac_key: secret,
  }), res);
  assert.equal(res.statusCode, 200);  // 200: verification RAN, ok=false says what it found
  assert.equal(res.body.ok, false);
  assert.match(res.body.reason, /output commitment mismatch/);
  assert.match(res.body.interpretation, /FAILED/);
});

test("verify-attestation POST catches Ed25519 model-swap", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const att = buildAttestation({
    request: REQUEST, response: RESPONSE, modelId: "claude-sonnet-4-6",
    mode: SIGNATURE_MODES.ED25519, privateKey,
  });
  const tampered = { ...att, model_id: "claude-haiku-4-5" };
  const res = mockRes();
  await verifyHandler(mockReq({
    attestation: tampered,
    original_request: REQUEST,
    original_response: RESPONSE,
    public_key: publicKey,
  }), res);
  assert.equal(res.body.ok, false);
  assert.match(res.body.reason, /ed25519 signature mismatch/);
});

// ─── input validation ─────────────────────────────────────────────

test("verify-attestation rejects missing attestation with 400", async () => {
  const res = mockRes();
  await verifyHandler(mockReq({
    original_request: REQUEST,
    original_response: RESPONSE,
  }), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /attestation/);
});

test("verify-attestation rejects missing original_request with 400", async () => {
  const res = mockRes();
  await verifyHandler(mockReq({
    attestation: { version: "aex-attestation/v1" },
    original_response: RESPONSE,
  }), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /original_request/);
});

test("verify-attestation rejects missing original_response with 400", async () => {
  const res = mockRes();
  await verifyHandler(mockReq({
    attestation: { version: "aex-attestation/v1" },
    original_request: REQUEST,
  }), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /original_response/);
});

test("verify-attestation rejects GET with 405 + curl example", async () => {
  const res = mockRes();
  await verifyHandler(mockReq({}, "GET"), res);
  assert.equal(res.statusCode, 405);
  assert.ok(res.body.example.attestation, "405 response includes usage example");
});

// ─── OPTIONS (CORS preflight) ─────────────────────────────────────

test("verify-attestation OPTIONS returns 200 for CORS preflight", async () => {
  const res = mockRes();
  await verifyHandler(mockReq({}, "OPTIONS"), res);
  assert.equal(res.statusCode, 200);
});

// ─── cache + CORS headers ─────────────────────────────────────────

test("verify-attestation sets no-store cache + wildcard CORS", async () => {
  const res = mockRes();
  await verifyHandler(mockReq({}, "OPTIONS"), res);
  assert.equal(res.headers["Cache-Control"], "no-store");
  assert.equal(res.headers["Access-Control-Allow-Origin"], "*");
});

// ─── procurement scenario (round-trip) ────────────────────────────

test("PROCUREMENT: bank curl round-trip with Ed25519 + public key", async () => {
  // Simulates: Shadow signs a decision → bank persists attestation + response
  // → bank auditor curls /api/verify-attestation with only their public key
  // → gets a machine-readable ok/failed verdict.
  const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const request = { loan: { credit_score: 720, debt_to_income: 0.28 } };
  const response = { verdict: "approve", voices: ["v1","v2","v3","v4","v5"] };
  const attestation = buildAttestation({
    request, response, modelId: "claude-sonnet-4-6",
    mode: SIGNATURE_MODES.ED25519, privateKey, keyId: "prod-2026-Q3",
  });

  const res = mockRes();
  await verifyHandler(mockReq({
    attestation,
    original_request: request,
    original_response: response,
    public_key: publicKey,
  }), res);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.key_id, "prod-2026-Q3");
  assert.equal(res.body.checks.signature_match, true);
  assert.equal(res.body.checks.request_commitment_match, true);
  assert.equal(res.body.checks.output_commitment_match, true);
});
