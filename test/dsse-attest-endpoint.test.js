// test/dsse-attest-endpoint.test.js
// Contract tests for POST /api/dsse-attest — server-side DSSE/in-toto attestation.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import { createSession, appendEvent, sealSession } from "../packages/attest-core/session.js";
import { verifyDsse, SHADOW_PREDICATE_TYPE } from "../packages/attest-core/dsse.js";
import handler from "../api/dsse-attest.js";

function sealed() {
  const { privateKey } = generateKeyPairSync("ed25519");
  const s = createSession({
    agent: { name: "loan-council", version: "1.0.0", identity_ref: "op:acme-bank" },
    models: [{ model_id: "anthropic:claude-opus-4", provider: "anthropic" }],
    environmentFingerprint: { os: "darwin", node_version: "24" },
    keyId: "prod-2026-q3", privateKey,
  });
  appendEvent(s, { event_type: "model_output", actor: "model", payload: { verdict: "BLOCK" } });
  return sealSession(s);
}

function mockRes() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(p) { this.body = p; return this; },
    end() { return this; },
  };
}

function withEnvKey(fn) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privPem = privateKey.export({ type: "pkcs8", format: "pem" });
  const pubPem = publicKey.export({ type: "spki", format: "pem" });
  const prev = process.env.SHADOW_ATTESTATION_ED25519_PRIVATE_KEY;
  const prevKid = process.env.SHADOW_ATTESTATION_KEY_ID;
  process.env.SHADOW_ATTESTATION_ED25519_PRIVATE_KEY = privPem;
  process.env.SHADOW_ATTESTATION_KEY_ID = "prod-2026-q3";
  try { return fn(pubPem); }
  finally {
    if (prev === undefined) delete process.env.SHADOW_ATTESTATION_ED25519_PRIVATE_KEY; else process.env.SHADOW_ATTESTATION_ED25519_PRIVATE_KEY = prev;
    if (prevKid === undefined) delete process.env.SHADOW_ATTESTATION_KEY_ID; else process.env.SHADOW_ATTESTATION_KEY_ID = prevKid;
  }
}

test("POST /api/dsse-attest signs a bundle into a DSSE envelope verifiable by the public key (PEM key from env)", async () => {
  const bundle = sealed();
  await withEnvKey(async (pubPem) => {
    const res = mockRes();
    await handler({ method: "POST", headers: {}, body: { bundle } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    const v = verifyDsse(res.body.envelope, { publicKey: pubPem });
    assert.equal(v.ok, true);
    assert.equal(v.payload.subject[0].digest.sha256, bundle.batch_root);
    assert.equal(v.payload.predicateType, SHADOW_PREDICATE_TYPE);
    assert.equal(v.keyid, "prod-2026-q3");
  });
});

test("refuses to attest without a persistent key (no ephemeral)", async () => {
  const prev = process.env.SHADOW_ATTESTATION_ED25519_PRIVATE_KEY;
  delete process.env.SHADOW_ATTESTATION_ED25519_PRIVATE_KEY;
  try {
    const res = mockRes();
    await handler({ method: "POST", headers: {}, body: { bundle: sealed() } }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /persistent signing key/);
  } finally {
    if (prev !== undefined) process.env.SHADOW_ATTESTATION_ED25519_PRIVATE_KEY = prev;
  }
});

test("rejects a missing/unsealed bundle with 400", async () => {
  await withEnvKey(async () => {
    const res = mockRes();
    await handler({ method: "POST", headers: {}, body: {} }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /missing sealed 'bundle'/);
  });
});

test("rejects non-POST with 405", async () => {
  const res = mockRes();
  await handler({ method: "GET", headers: {} }, res);
  assert.equal(res.statusCode, 405);
});
