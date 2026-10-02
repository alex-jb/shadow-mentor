// test/api-deliberate-typed-claims.test.js
// v1.5.38 contract tests for /api/deliberate typed-claim wire-in.
// Invalid claims stop before the SDK; accepted claims reach a mocked SDK
// resource. These routing checks make no provider HTTP requests.

import { test } from "node:test";
import assert from "node:assert/strict";
import { offlineDeliberate, OFFLINE_PROVIDER_ERROR } from "./helpers/offline-deliberate.js";

const { default: handler } = await import("../api/deliberate.js");

function mockReq(body, method = "POST") {
  return { method, body };
}
function mockRes() {
  const res = {
    statusCode: 200, body: null, headers: {},
    setHeader(n, v) { this.headers[n] = v; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    end() { return this; },
  };
  return res;
}


test("rejects invalid claim_type override with HTTP 400 + anchor", async (t) => {
  const messages = offlineDeliberate(t);
  const original = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key";

  const res = mockRes();
  await handler(mockReq({
    persona: "compliance",
    scenario: "lbo",
    claim_type: "not-a-real-class",
  }), res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /unknown claim_type/);
  assert.equal(res.body.anchor, "arXiv:2605.20312");
  assert.equal(messages.mock.callCount(), 0);

  if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
  else delete process.env.ANTHROPIC_API_KEY;
});


test("accepts valid claim_type override (does not reject at 400)", async (t) => {
  const messages = offlineDeliberate(t);
  const original = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key";

  const res = mockRes();
  await handler(mockReq({
    persona: "compliance",
    scenario: "lbo",
    claim_type: "inference",
  }), res);

  // A controlled SDK failure proves claim validation passed; no real
  // provider call or unrelated error is accepted as success here.
  assert.notEqual(res.statusCode, 400);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, OFFLINE_PROVIDER_ERROR);
  assert.equal(messages.mock.callCount(), 3);

  if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
  else delete process.env.ANTHROPIC_API_KEY;
});


test("accepts all 4 valid claim_type values", async (t) => {
  const messages = offlineDeliberate(t);
  const original = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key";

  for (const claim_type of ["perception", "inference", "analogy", "testimony"]) {
    const res = mockRes();
    await handler(mockReq({
      persona: "compliance",
      scenario: "lbo",
      claim_type,
    }), res);
    assert.notEqual(res.statusCode, 400,
      `claim_type=${claim_type} should not be rejected`);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, OFFLINE_PROVIDER_ERROR);
  }
  assert.equal(messages.mock.callCount(), 12, "three mocked voice calls per accepted claim type");

  if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
  else delete process.env.ANTHROPIC_API_KEY;
});


test("rejects invalid claim_type BEFORE reaching LLM (fast-fail)", async (t) => {
  const messages = offlineDeliberate(t);
  // No ANTHROPIC_API_KEY set — normally that would 500 downstream.
  // But invalid claim_type override should 400-reject before that check.
  // Currently unknown-persona / scenario / claim_type are all validated
  // before the API-key check via body destructure.
  const original = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key"; // set so we reach claim_type check
  const res = mockRes();
  await handler(mockReq({
    persona: "compliance",
    scenario: "lbo",
    claim_type: "garbage",
  }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(messages.mock.callCount(), 0);

  if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
  else delete process.env.ANTHROPIC_API_KEY;
});


test("BACK-COMPAT: missing claim_type field → no 400 (heuristic default used)", async (t) => {
  const messages = offlineDeliberate(t);
  const original = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key";

  const res = mockRes();
  await handler(mockReq({
    persona: "compliance",
    scenario: "lbo",
    // no claim_type
  }), res);

  assert.notEqual(res.statusCode, 400);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, OFFLINE_PROVIDER_ERROR);
  assert.equal(messages.mock.callCount(), 3);

  if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
  else delete process.env.ANTHROPIC_API_KEY;
});
