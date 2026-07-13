// test/session-api.test.js
// v3 M1.2 contract tests for the streaming evidence-bundle session API.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import {
  EVENT_TYPES,
  createSession,
  appendEvent,
  sealSession,
  verifyBundle,
} from "../packages/attest-core/session.js";

function testKeypair() {
  return generateKeyPairSync("ed25519");
}

function baseHeaderParams() {
  const { privateKey } = testKeypair();
  return {
    agent: { name: "claude-code", version: "1.2.3" },
    models: [{ model_id: "anthropic:claude-sonnet-4-6", provider: "anthropic" }],
    environmentFingerprint: { os: "darwin-25.3.0", node_version: "24.14.1" },
    keyId: "test-key",
    privateKey,
  };
}


test("EVENT_TYPES enum contains the 13 spec kinds + 5 M2.1 adapter kinds and is frozen", () => {
  // 13 original spec kinds + 5 hook-specific kinds added for the Claude
  // Code adapter (M2.1, 2026-07-13): prompt, tool_error, subagent_stop,
  // turn_end, pre_compact. See packages/attest-core/session.js for the
  // rationale — hook semantics that user_message + error + model_output
  // can't express cleanly.
  assert.equal(EVENT_TYPES.length, 18);
  assert.ok(EVENT_TYPES.includes("session_start"));
  assert.ok(EVENT_TYPES.includes("model_call"));
  assert.ok(EVENT_TYPES.includes("session_end"));
  assert.ok(EVENT_TYPES.includes("prompt"));
  assert.ok(EVENT_TYPES.includes("tool_error"));
  assert.ok(EVENT_TYPES.includes("subagent_stop"));
  assert.ok(EVENT_TYPES.includes("turn_end"));
  assert.ok(EVENT_TYPES.includes("pre_compact"));
  assert.ok(Object.isFrozen(EVENT_TYPES));
});


test("createSession throws when required params missing", () => {
  assert.throws(() => createSession({}), /agent required/);
  assert.throws(() => createSession({ agent: { name: "a" } }), /agent\.name and agent\.version required/);
});


test("createSession produces a valid header seed", () => {
  const s = createSession(baseHeaderParams());
  assert.equal(s._sealed, false);
  assert.equal(s.events.length, 0);
  assert.equal(s.header.agent.name, "claude-code");
  assert.equal(s.header.schema_versions.bundle, 1);
  assert.match(s._headerHash, /^[0-9a-f]{64}$/);
});


test("appendEvent extends the chain and returns a frozen event", () => {
  const s = createSession(baseHeaderParams());
  const ev = appendEvent(s, {
    event_type: "user_message",
    actor: "user",
    payload: { text: "hello" },
  });
  assert.equal(ev.seq, 0);
  assert.equal(ev.event_type, "user_message");
  assert.equal(ev.prev_hash, s._headerHash);
  assert.match(ev.payload_hash, /^[0-9a-f]{64}$/);
  assert.equal(ev.payload_ref, `sha256:${ev.payload_hash}`);
  assert.ok(Object.isFrozen(ev));
  assert.equal(s.events.length, 1);
});


test("appendEvent chains prev_hash across multiple events", () => {
  const s = createSession(baseHeaderParams());
  const a = appendEvent(s, { event_type: "user_message", actor: "user", payload: { text: "a" } });
  const b = appendEvent(s, { event_type: "model_call", actor: "model", payload: { messages: [] } });
  const c = appendEvent(s, { event_type: "model_output", actor: "model", payload: { text: "reply" } });
  assert.equal(a.seq, 0);
  assert.equal(b.seq, 1);
  assert.equal(c.seq, 2);
  // Chain integrity: b.prev_hash must equal sha256 of a's canonicalized record.
  assert.notEqual(a.prev_hash, b.prev_hash);
  assert.notEqual(b.prev_hash, c.prev_hash);
});


test("appendEvent rejects unknown event_type", () => {
  const s = createSession(baseHeaderParams());
  assert.throws(
    () => appendEvent(s, { event_type: "bogus", actor: "user", payload: {} }),
    /unknown event_type/,
  );
});


test("appendEvent rejects unknown actor", () => {
  const s = createSession(baseHeaderParams());
  assert.throws(
    () => appendEvent(s, { event_type: "user_message", actor: "alien", payload: {} }),
    /unknown actor/,
  );
});


test("appendEvent supports null payload_ref for pre-redacted events", () => {
  const s = createSession(baseHeaderParams());
  const ev = appendEvent(s, {
    event_type: "user_message",
    actor: "user",
    payload: { text: "sensitive" },
    payload_ref: null,
  });
  assert.equal(ev.payload_ref, null);
  assert.match(ev.payload_hash, /^[0-9a-f]{64}$/);
});


test("sealSession produces a bundle whose signature verifies with the matching public key", () => {
  const { publicKey, privateKey } = testKeypair();
  const s = createSession({ ...baseHeaderParams(), privateKey });
  appendEvent(s, { event_type: "user_message", actor: "user", payload: { text: "hi" } });
  appendEvent(s, { event_type: "model_call", actor: "model", payload: { messages: [] } });
  appendEvent(s, { event_type: "model_output", actor: "model", payload: { text: "response" } });
  const bundle = sealSession(s);
  assert.equal(bundle.bundle_version, 1);
  assert.equal(bundle.spec_version, "shadow-evidence/v1");
  assert.equal(bundle.events.length, 4); // 3 appends + auto session_end
  assert.equal(bundle.events[bundle.events.length - 1].event_type, "session_end");
  assert.match(bundle.batch_root, /^[0-9a-f]{64}$/);
  assert.equal(bundle.signatures.length, 1);
  assert.equal(bundle.signatures[0].algorithm, "ed25519");
  assert.equal(bundle.signatures[0].key_id, "test-key");

  const result = verifyBundle(bundle, { publicKey });
  assert.equal(result.ok, true, result.reason);
});


test("sealSession with omitSessionEnd does not append session_end", () => {
  const s = createSession(baseHeaderParams());
  appendEvent(s, { event_type: "user_message", actor: "user", payload: {} });
  const bundle = sealSession(s, { omitSessionEnd: true });
  assert.equal(bundle.events.length, 1);
  assert.notEqual(bundle.events[0].event_type, "session_end");
});


test("sealSession twice throws", () => {
  const s = createSession(baseHeaderParams());
  appendEvent(s, { event_type: "user_message", actor: "user", payload: {} });
  sealSession(s);
  assert.throws(() => sealSession(s), /already sealed/);
});


test("appendEvent after seal throws", () => {
  const s = createSession(baseHeaderParams());
  appendEvent(s, { event_type: "user_message", actor: "user", payload: {} });
  sealSession(s);
  assert.throws(
    () => appendEvent(s, { event_type: "user_message", actor: "user", payload: {} }),
    /already sealed/,
  );
});


test("verifyBundle detects tampered payload_hash", () => {
  const { publicKey, privateKey } = testKeypair();
  const s = createSession({ ...baseHeaderParams(), privateKey });
  appendEvent(s, { event_type: "user_message", actor: "user", payload: { text: "hi" } });
  const bundle = sealSession(s);

  bundle.events[0].payload_hash = "0".repeat(64);
  const result = verifyBundle(bundle, { publicKey });
  assert.equal(result.ok, false);
});


test("verifyBundle detects event reordering", () => {
  const { publicKey, privateKey } = testKeypair();
  const s = createSession({ ...baseHeaderParams(), privateKey });
  appendEvent(s, { event_type: "user_message", actor: "user", payload: { text: "a" } });
  appendEvent(s, { event_type: "user_message", actor: "user", payload: { text: "b" } });
  appendEvent(s, { event_type: "user_message", actor: "user", payload: { text: "c" } });
  const bundle = sealSession(s);

  // Swap events 0 and 1
  [bundle.events[0], bundle.events[1]] = [bundle.events[1], bundle.events[0]];
  const result = verifyBundle(bundle, { publicKey });
  assert.equal(result.ok, false);
  assert.match(result.reason, /seq gap|prev_hash mismatch/);
});


test("verifyBundle detects event deletion", () => {
  const { publicKey, privateKey } = testKeypair();
  const s = createSession({ ...baseHeaderParams(), privateKey });
  appendEvent(s, { event_type: "user_message", actor: "user", payload: { text: "a" } });
  appendEvent(s, { event_type: "user_message", actor: "user", payload: { text: "b" } });
  appendEvent(s, { event_type: "user_message", actor: "user", payload: { text: "c" } });
  const bundle = sealSession(s);

  bundle.events.splice(1, 1);
  // renumber sequences to attempt to hide the deletion
  bundle.events.forEach((e, i) => { e.seq = i; });
  const result = verifyBundle(bundle, { publicKey });
  assert.equal(result.ok, false);
});


test("verifyBundle detects wrong public key", () => {
  const { privateKey } = testKeypair();
  const { publicKey: otherPublicKey } = testKeypair();
  const s = createSession({ ...baseHeaderParams(), privateKey });
  appendEvent(s, { event_type: "user_message", actor: "user", payload: {} });
  const bundle = sealSession(s);

  const result = verifyBundle(bundle, { publicKey: otherPublicKey });
  assert.equal(result.ok, false);
  assert.match(result.reason, /signature verification failed/);
});


test("null payload_ref (redacted) still verifies as long as payload_hash unchanged", () => {
  const { publicKey, privateKey } = testKeypair();
  const s = createSession({ ...baseHeaderParams(), privateKey });
  const ev = appendEvent(s, {
    event_type: "user_message",
    actor: "user",
    payload: { text: "sensitive PII" },
  });
  // Simulate post-hoc redaction by dropping the payload_ref. In real
  // usage the payload store gets emptied; the record's payload_hash
  // is intentionally unchanged so the chain still verifies.
  const bundle = sealSession(s);
  bundle.events[0].payload_ref = null;
  const result = verifyBundle(bundle, { publicKey });
  assert.equal(result.ok, true, result.reason);
  assert.match(ev.payload_hash, /^[0-9a-f]{64}$/);
});


test("bundle round-trip through JSON stringify + parse still verifies", () => {
  const { publicKey, privateKey } = testKeypair();
  const s = createSession({ ...baseHeaderParams(), privateKey });
  for (let i = 0; i < 20; i++) {
    appendEvent(s, {
      event_type: "tool_call",
      actor: "agent",
      payload: { tool: "grep", args: { pattern: `iter-${i}` } },
    });
  }
  const bundle = sealSession(s);
  const round = JSON.parse(JSON.stringify(bundle));
  const result = verifyBundle(round, { publicKey });
  assert.equal(result.ok, true, result.reason);
});
