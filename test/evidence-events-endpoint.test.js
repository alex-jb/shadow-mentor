// Contract tests for POST /api/evidence/events — v3 M2.3 generic HTTP ingest.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import handler from "../api/evidence/events.js";
import { verifyBundle } from "../packages/attest-core/session.js";

function mockReq(body = {}, method = "POST", extraHeaders = {}) {
  return {
    method,
    body,
    headers: { "content-type": "application/json", ...extraHeaders },
  };
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

function setKeyEnv() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privPem = privateKey.export({ type: "pkcs8", format: "pem" });
  const pubPem = publicKey.export({ type: "spki", format: "pem" });
  const prevPriv = process.env.SHADOW_ATTESTATION_ED25519_PRIVATE_KEY;
  const prevKid = process.env.SHADOW_ATTESTATION_KEY_ID;
  process.env.SHADOW_ATTESTATION_ED25519_PRIVATE_KEY = privPem;
  process.env.SHADOW_ATTESTATION_KEY_ID = "test-key";
  return {
    pubPem,
    restore() {
      if (prevPriv === undefined) delete process.env.SHADOW_ATTESTATION_ED25519_PRIVATE_KEY;
      else process.env.SHADOW_ATTESTATION_ED25519_PRIVATE_KEY = prevPriv;
      if (prevKid === undefined) delete process.env.SHADOW_ATTESTATION_KEY_ID;
      else process.env.SHADOW_ATTESTATION_KEY_ID = prevKid;
    },
  };
}

const validBody = {
  session: {
    agent: { name: "test-agent", version: "1.0" },
    models: [{ model_id: "test:model", provider: "test" }],
    environment_fingerprint: { os: "test", node_version: "test" },
    key_id: "test-key",
  },
  events: [
    { event_type: "user_message", actor: "user", payload: { text: "hi" } },
    { event_type: "tool_call", actor: "agent", payload: { tool: "grep" } },
    { event_type: "tool_result", actor: "tool", payload: { hits: 0 } },
  ],
};

test("evidence-events OPTIONS returns 200 with CORS headers", async () => {
  const res = mockRes();
  await handler(mockReq({}, "OPTIONS"), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Access-Control-Allow-Methods"], "POST, OPTIONS");
});


test("evidence-events GET returns 405", async () => {
  const res = mockRes();
  await handler(mockReq({}, "GET"), res);
  assert.equal(res.statusCode, 405);
});


test("evidence-events without env key returns 500", async () => {
  const prev = process.env.SHADOW_ATTESTATION_ED25519_PRIVATE_KEY;
  delete process.env.SHADOW_ATTESTATION_ED25519_PRIVATE_KEY;
  try {
    // Force fresh module import so the env-var-derived module constant
    // reflects the deletion. Node modules are cached, so we simulate the
    // "server misconfigured" state by re-reading via dynamic import.
    // Cheaper: we just verify the check by omitting the env in a fresh child
    // — but that's overkill for a unit test. Assert the current running
    // module already loaded a null when we started, if applicable.
    // Instead: only run this test if the env var is currently unset in this
    // process, or skip.
    if (process.env.SHADOW_ATTESTATION_ED25519_PRIVATE_KEY) return;
    const res = mockRes();
    await handler(mockReq(validBody), res);
    assert.equal(res.statusCode, 500);
    assert.match(res.body.error, /signing key not configured/);
  } finally {
    if (prev !== undefined) process.env.SHADOW_ATTESTATION_ED25519_PRIVATE_KEY = prev;
  }
});


test("evidence-events returns 400 when session missing", async () => {
  const env = setKeyEnv();
  try {
    const res = mockRes();
    await handler(mockReq({ events: [] }), res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /session required/);
  } finally {
    env.restore();
  }
});


test("evidence-events returns 400 when events not array", async () => {
  const env = setKeyEnv();
  try {
    const res = mockRes();
    await handler(mockReq({ session: validBody.session, events: "not-an-array" }), res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /events must be an array/);
  } finally {
    env.restore();
  }
});


test("evidence-events returns 400 when events empty", async () => {
  const env = setKeyEnv();
  try {
    const res = mockRes();
    await handler(mockReq({ session: validBody.session, events: [] }), res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /at least one event/);
  } finally {
    env.restore();
  }
});


test("evidence-events returns 400 with helpful error on unknown event_type", async () => {
  const env = setKeyEnv();
  try {
    const res = mockRes();
    await handler(mockReq({
      session: validBody.session,
      events: [{ event_type: "unknown_kind", actor: "user", payload: {} }],
    }), res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /unknown event_type/);
    assert.ok(res.body.allowed.includes("user_message"));
  } finally {
    env.restore();
  }
});


test("evidence-events returns 400 with helpful error on unknown actor", async () => {
  const env = setKeyEnv();
  try {
    const res = mockRes();
    await handler(mockReq({
      session: validBody.session,
      events: [{ event_type: "user_message", actor: "alien", payload: {} }],
    }), res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /unknown actor/);
  } finally {
    env.restore();
  }
});


test("evidence-events happy path — returns a bundle that verifies with the matching public key", async () => {
  const env = setKeyEnv();
  try {
    const res = mockRes();
    await handler(mockReq(validBody), res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.ok(res.body.bundle);
    const bundle = res.body.bundle;
    assert.equal(bundle.bundle_version, 1);
    assert.equal(bundle.events.length, 4); // 3 supplied + auto session_end
    assert.equal(bundle.signatures[0].key_id, "test-key");

    const result = verifyBundle(bundle, { publicKey: env.pubPem });
    assert.equal(result.ok, true, result.reason);
  } finally {
    env.restore();
  }
});


test("evidence-events sets no-store cache header", async () => {
  const env = setKeyEnv();
  try {
    const res = mockRes();
    await handler(mockReq(validBody), res);
    assert.equal(res.headers["Cache-Control"], "no-store");
  } finally {
    env.restore();
  }
});


// F2 — DoS defense: too many events → 413.
test("evidence-events returns 413 when events array exceeds MAX_EVENTS_PER_REQUEST", async () => {
  const env = setKeyEnv();
  try {
    const events = Array.from({ length: 5001 }).map(() => ({
      event_type: "tool_call",
      actor: "agent",
      payload: {},
    }));
    const res = mockRes();
    await handler(mockReq({ session: validBody.session, events }), res);
    assert.equal(res.statusCode, 413);
    assert.match(res.body.error, /too many events/);
    assert.equal(res.body.max_events_per_request, 5000);
    assert.equal(res.body.got, 5001);
  } finally {
    env.restore();
  }
});


// F3 — Idempotency-Key derives a stable session_id when body doesn't specify one.
test("evidence-events derives session_id from Idempotency-Key header", async () => {
  const env = setKeyEnv();
  try {
    const key = "user-supplied-retry-key-abc123";
    // strip explicit session_id from body so the derivation kicks in.
    const { session_id: _drop, ...sessionNoId } = validBody.session;
    void _drop;
    const body = { session: sessionNoId, events: validBody.events };

    const res1 = mockRes();
    await handler(mockReq(body, "POST", { "idempotency-key": key }), res1);
    assert.equal(res1.statusCode, 200, JSON.stringify(res1.body));
    const sid1 = res1.body.session_id;
    assert.ok(sid1, "expected top-level session_id on response");

    // Retry with same key + same body → same derived session_id.
    const res2 = mockRes();
    await handler(mockReq(body, "POST", { "idempotency-key": key }), res2);
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.body.session_id, sid1, "same key must produce same session_id");
  } finally {
    env.restore();
  }
});


// F3 — body session_id wins over Idempotency-Key header (Stripe convention).
test("evidence-events body session_id wins over Idempotency-Key header", async () => {
  const env = setKeyEnv();
  try {
    const explicitId = "explicit-session-id-from-caller";
    const body = {
      session: { ...validBody.session, session_id: explicitId },
      events: validBody.events,
    };
    const res = mockRes();
    await handler(mockReq(body, "POST", { "idempotency-key": "some-other-key" }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.session_id, explicitId);
  } finally {
    env.restore();
  }
});


// F4 — top-level session_id mirror for common tooling.
test("evidence-events response includes top-level session_id matching bundle header", async () => {
  const env = setKeyEnv();
  try {
    const res = mockRes();
    await handler(mockReq(validBody), res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.session_id, "expected top-level session_id");
    assert.equal(res.body.session_id, res.body.bundle.header.session_id);
  } finally {
    env.restore();
  }
});


// F7 — X-Shadow-Bundle-Version + X-Shadow-Session-Id response headers.
test("evidence-events sets X-Shadow-Bundle-Version and X-Shadow-Session-Id response headers", async () => {
  const env = setKeyEnv();
  try {
    const res = mockRes();
    await handler(mockReq(validBody), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["X-Shadow-Bundle-Version"], "1");
    assert.equal(res.headers["X-Shadow-Session-Id"], res.body.session_id);
  } finally {
    env.restore();
  }
});


test("evidence-events preserves ordering of supplied events in the resulting chain", async () => {
  const env = setKeyEnv();
  try {
    const bigBody = {
      session: validBody.session,
      events: Array.from({ length: 20 }).map((_, i) => ({
        event_type: "tool_call",
        actor: "agent",
        payload: { iter: i },
      })),
    };
    const res = mockRes();
    await handler(mockReq(bigBody), res);
    assert.equal(res.statusCode, 200);
    const bundle = res.body.bundle;
    // First 20 events should be the tool_calls in order; last is session_end.
    for (let i = 0; i < 20; i++) {
      assert.equal(bundle.events[i].event_type, "tool_call");
      assert.equal(bundle.events[i].seq, i);
    }
    assert.equal(bundle.events[20].event_type, "session_end");
    const result = verifyBundle(bundle, { publicKey: env.pubPem });
    assert.equal(result.ok, true, result.reason);
  } finally {
    env.restore();
  }
});
