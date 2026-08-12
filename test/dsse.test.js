// test/dsse.test.js
// Contract tests for DSSE envelope + in-toto Statement emission over Shadow bundles.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import { createSession, appendEvent, sealSession } from "../packages/attest-core/session.js";
import {
  pae,
  signDsse,
  verifyDsse,
  inTotoStatement,
  dsseAttestBundle,
  INTOTO_PAYLOAD_TYPE,
  SHADOW_PREDICATE_TYPE,
} from "../packages/attest-core/dsse.js";

function keys() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return { privateKey, publicKey };
}

function sealed() {
  const { privateKey } = keys();
  const s = createSession({
    agent: { name: "loan-council", version: "1.0.0", identity_ref: "op:acme-bank" },
    models: [{ model_id: "anthropic:claude-opus-4", provider: "anthropic" }],
    environmentFingerprint: { os: "darwin", node_version: "24" },
    keyId: "prod-2026-q3", privateKey,
  });
  appendEvent(s, { event_type: "model_output", actor: "model", payload: { verdict: "BLOCK" } });
  return sealSession(s);
}

test("PAE matches the DSSE spec reference vector", () => {
  // From the DSSE spec: payloadType "http://example.com/HelloWorld", payload "hello world"
  const encoded = pae("http://example.com/HelloWorld", Buffer.from("hello world", "utf8"));
  assert.equal(encoded.toString("utf8"), "DSSEv1 29 http://example.com/HelloWorld 11 hello world");
});

test("PAE length fields are byte lengths, not char lengths (utf8 safety)", () => {
  // "café" is 5 bytes in utf8 (é = 2 bytes), 4 chars.
  const encoded = pae("t", Buffer.from("café", "utf8"));
  assert.equal(encoded.toString("utf8"), "DSSEv1 1 t 5 café");
});

test("signDsse → verifyDsse round-trips and decodes the JSON payload", () => {
  const { privateKey, publicKey } = keys();
  const stmt = { hello: "world", n: 42 };
  const env = signDsse({ payload: stmt, privateKey, keyId: "k1" });
  assert.equal(env.payloadType, INTOTO_PAYLOAD_TYPE);
  assert.equal(env.signatures[0].keyid, "k1");
  const v = verifyDsse(env, { publicKey });
  assert.equal(v.ok, true);
  assert.deepEqual(v.payload, stmt);
  assert.equal(v.keyid, "k1");
});

test("verifyDsse fails against the wrong public key", () => {
  const { privateKey } = keys();
  const { publicKey: otherPub } = keys();
  const env = signDsse({ payload: { a: 1 }, privateKey, keyId: "k1" });
  const v = verifyDsse(env, { publicKey: otherPub });
  assert.equal(v.ok, false);
  assert.match(v.reason, /no signature verified/);
});

test("verifyDsse fails when the payload is tampered (signature is over the PAE)", () => {
  const { privateKey, publicKey } = keys();
  const env = signDsse({ payload: { verdict: "BLOCK" }, privateKey, keyId: "k1" });
  // Adversary swaps the payload for an APPROVE statement, keeps the signature.
  const tampered = { ...env, payload: Buffer.from(JSON.stringify({ verdict: "APPROVE" }), "utf8").toString("base64") };
  const v = verifyDsse(tampered, { publicKey });
  assert.equal(v.ok, false);
});

test("verifyDsse also fails when payloadType is tampered (PAE binds the type)", () => {
  const { privateKey, publicKey } = keys();
  const env = signDsse({ payload: { a: 1 }, payloadType: "application/vnd.in-toto+json", privateKey, keyId: "k1" });
  const tampered = { ...env, payloadType: "application/x-evil" };
  assert.equal(verifyDsse(tampered, { publicKey }).ok, false);
});

test("inTotoStatement binds a subject digest to a predicate", () => {
  const stmt = inTotoStatement({ subjectName: "s", sha256: "deadbeef", predicateType: "p", predicate: { x: 1 } });
  assert.equal(stmt._type, "https://in-toto.io/Statement/v1");
  assert.equal(stmt.subject[0].digest.sha256, "deadbeef");
  assert.equal(stmt.predicateType, "p");
  assert.deepEqual(stmt.predicate, { x: 1 });
});

test("dsseAttestBundle binds the in-toto subject digest to the bundle's batch_root", () => {
  const bundle = sealed();
  const { privateKey, publicKey } = keys();
  const env = dsseAttestBundle(bundle, { privateKey, keyId: "prod-2026-q3" });
  const v = verifyDsse(env, { publicKey });
  assert.equal(v.ok, true);
  // The DSSE attestation is cryptographically bound to the exact evidence chain.
  assert.equal(v.payload.subject[0].digest.sha256, bundle.batch_root);
  assert.equal(v.payload.predicateType, SHADOW_PREDICATE_TYPE);
  assert.equal(v.payload.predicate.session_id, bundle.header.session_id);
  assert.equal(v.payload.predicate.event_count, bundle.events.length);
  // The native Ed25519-over-batch_root signature rides in the predicate for cross-check.
  assert.equal(v.payload.predicate.native_signature.signature, bundle.signatures[0].signature);
});

test("dsseAttestBundle requires a sealed bundle + signing material", () => {
  const { privateKey } = keys();
  assert.throws(() => dsseAttestBundle({}, { privateKey, keyId: "k" }), /batch_root required/);
  const bundle = sealed();
  assert.throws(() => signDsse({ payload: {}, keyId: "k" }), /privateKey required/);
  assert.throws(() => signDsse({ payload: {}, privateKey }), /keyId required/);
});
