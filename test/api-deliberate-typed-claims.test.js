// test/api-deliberate-typed-claims.test.js
// v1.5.38 contract tests for /api/deliberate typed-claim wire-in.
// Tests only the early-return path (invalid claim_type override) since
// full-flow tests need real LLM keys.

import { test } from "node:test";
import assert from "node:assert/strict";

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


test("rejects invalid claim_type override with HTTP 400 + anchor", async () => {
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

  if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
  else delete process.env.ANTHROPIC_API_KEY;
});


test("accepts valid claim_type override (does not reject at 400)", async () => {
  const original = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key";

  const res = mockRes();
  await handler(mockReq({
    persona: "compliance",
    scenario: "lbo",
    claim_type: "inference",
  }), res);

  // Will fail downstream because test-key isn't real; assert it didn't
  // 400-reject at claim_type validation.
  assert.notEqual(res.statusCode, 400);

  if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
  else delete process.env.ANTHROPIC_API_KEY;
});


test("accepts all 4 valid claim_type values", async () => {
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
  }

  if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
  else delete process.env.ANTHROPIC_API_KEY;
});


test("rejects invalid claim_type BEFORE reaching LLM (fast-fail)", async () => {
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

  if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
  else delete process.env.ANTHROPIC_API_KEY;
});


test("BACK-COMPAT: missing claim_type field → no 400 (heuristic default used)", async () => {
  const original = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key";

  const res = mockRes();
  await handler(mockReq({
    persona: "compliance",
    scenario: "lbo",
    // no claim_type
  }), res);

  assert.notEqual(res.statusCode, 400);

  if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
  else delete process.env.ANTHROPIC_API_KEY;
});
