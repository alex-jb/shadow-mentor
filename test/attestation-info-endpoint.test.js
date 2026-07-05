// Contract tests for GET /api/attestation-info — public key discovery.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { computeFingerprint } from "../api/attestation-info.js";

function mockReq(method = "GET") {
  return { method, headers: {} };
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

// Fresh dynamic import per test so env var changes are picked up.
async function callHandler() {
  const mod = await import(`../api/attestation-info.js?ts=${Date.now()}`);
  return mod.default;
}

test("attestation-info fingerprint is deterministic SHA-256 of DER", () => {
  const { publicKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const fp1 = computeFingerprint(publicKey);
  const fp2 = computeFingerprint(publicKey);
  assert.equal(fp1, fp2, "fingerprint must be deterministic");
  assert.equal(fp1.length, 64, "SHA-256 hex is 64 chars");
});

test("attestation-info fingerprints differ for different keypairs", () => {
  const kp1 = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const kp2 = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  assert.notEqual(computeFingerprint(kp1.publicKey), computeFingerprint(kp2.publicKey));
});

test("attestation-info GET returns full metadata in Ed25519 mode", async () => {
  const { publicKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const prevMode = process.env.SHADOW_ATTESTATION_MODE;
  const prevKey = process.env.SHADOW_ATTESTATION_ED25519_PUBLIC_KEY;
  const prevKeyId = process.env.SHADOW_ATTESTATION_KEY_ID;
  process.env.SHADOW_ATTESTATION_MODE = "ed25519";
  process.env.SHADOW_ATTESTATION_ED25519_PUBLIC_KEY = publicKey;
  process.env.SHADOW_ATTESTATION_KEY_ID = "test-attestation-info";
  try {
    const handler = await callHandler();
    const res = mockRes();
    await handler(mockReq("GET"), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.service, "shadow-mentor");
    assert.equal(res.body.mode, "ed25519");
    assert.equal(res.body.key_id, "test-attestation-info");
    assert.equal(res.body.public_key_pem, publicKey);
    assert.equal(res.body.public_key_fingerprint_sha256.length, 64);
    assert.equal(res.body.completeness_check.ed25519_public_key_present, true);
    assert.equal(res.body.completeness_check.warning, null);
    assert.equal(res.headers["Cache-Control"], "public, max-age=300");
  } finally {
    process.env.SHADOW_ATTESTATION_MODE = prevMode;
    process.env.SHADOW_ATTESTATION_ED25519_PUBLIC_KEY = prevKey;
    process.env.SHADOW_ATTESTATION_KEY_ID = prevKeyId;
  }
});

test("attestation-info hides all key material in HMAC mode", async () => {
  const prevMode = process.env.SHADOW_ATTESTATION_MODE;
  delete process.env.SHADOW_ATTESTATION_MODE;  // defaults to HMAC
  try {
    const handler = await callHandler();
    const res = mockRes();
    await handler(mockReq("GET"), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.mode, "hmac-sha256");
    assert.equal(res.body.public_key_pem, null);
    assert.equal(res.body.completeness_check.hmac_mode, true);
  } finally {
    process.env.SHADOW_ATTESTATION_MODE = prevMode;
  }
});

test("attestation-info surfaces warning when ed25519 mode but no key configured", async () => {
  const prevMode = process.env.SHADOW_ATTESTATION_MODE;
  const prevKey = process.env.SHADOW_ATTESTATION_ED25519_PUBLIC_KEY;
  process.env.SHADOW_ATTESTATION_MODE = "ed25519";
  delete process.env.SHADOW_ATTESTATION_ED25519_PUBLIC_KEY;
  try {
    const handler = await callHandler();
    const res = mockRes();
    await handler(mockReq("GET"), res);
    assert.equal(res.body.completeness_check.ed25519_public_key_present, false);
    assert.match(res.body.completeness_check.warning, /Deployed with ed25519 mode but no public key/);
  } finally {
    process.env.SHADOW_ATTESTATION_MODE = prevMode;
    if (prevKey) process.env.SHADOW_ATTESTATION_ED25519_PUBLIC_KEY = prevKey;
  }
});

test("attestation-info rejects POST with 405", async () => {
  const handler = await callHandler();
  const res = mockRes();
  await handler(mockReq("POST"), res);
  assert.equal(res.statusCode, 405);
});

test("attestation-info OPTIONS handled for CORS", async () => {
  const handler = await callHandler();
  const res = mockRes();
  await handler(mockReq("OPTIONS"), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "*");
});

test("attestation-info response advertises all 4 verifier dispatch surfaces", async () => {
  const handler = await callHandler();
  const res = mockRes();
  await handler(mockReq("GET"), res);
  assert.equal(res.body.docs.cli_verifier, "bin/verify-attestation.mjs");
  assert.equal(res.body.docs.mcp_tool, "shadow_verify_attestation");
  assert.equal(res.body.docs.http_verifier, "POST /api/verify-attestation");
  assert.equal(res.body.docs.python_library, "python/shadow_verify");
});
