import { test } from "node:test";
import assert from "node:assert/strict";

// We test the handler's input-validation contract — the early-return paths that
// do not call the SDK. SDK behavior is tested manually against the live Vercel
// deployment.
const { default: handler } = await import("../api/deliberate.js");

function mockReq(body, method = "POST") {
  return { method, body };
}
function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; }
  };
  return res;
}

test("rejects non-POST requests", async () => {
  const res = mockRes();
  await handler(mockReq({}, "GET"), res);
  assert.equal(res.statusCode, 405);
});

test("handles OPTIONS preflight", async () => {
  const res = mockRes();
  await handler(mockReq({}, "OPTIONS"), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "*");
});

test("rejects unknown persona", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const res = mockRes();
  await handler(mockReq({ persona: "unknown", scenario: "lbo", question: "test" }), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /unknown persona/);
});

test("rejects unknown scenario", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const res = mockRes();
  await handler(mockReq({ persona: "compliance", scenario: "fictitious", question: "test" }), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /unknown scenario/);
});

test("returns 500 when ANTHROPIC_API_KEY missing", async () => {
  const original = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  const res = mockRes();
  await handler(mockReq({ persona: "compliance", scenario: "lbo", question: "test" }), res);
  assert.equal(res.statusCode, 500);
  assert.match(res.body.error, /ANTHROPIC_API_KEY/);
  if (original) process.env.ANTHROPIC_API_KEY = original;
});

test("CORS headers are set on every response", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const res = mockRes();
  await handler(mockReq({ persona: "unknown", scenario: "lbo" }), res);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(res.headers["Access-Control-Allow-Methods"], "POST, OPTIONS");
});

test("accepts all 5 known personas at the routing layer", async () => {
  const original = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  for (const persona of ["compliance", "quant", "engineer", "trader", "advisor"]) {
    const res = mockRes();
    await handler(mockReq({ persona, scenario: "lbo", question: "test" }), res);
    // missing API key returns 500, which proves we passed persona/scenario validation
    assert.equal(res.statusCode, 500, `${persona} should pass routing and fail on missing key`);
  }
  if (original) process.env.ANTHROPIC_API_KEY = original;
});

test("accepts all 4 known scenarios at the routing layer", async () => {
  const original = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  for (const scenario of ["lbo", "bloomberg", "cds", "policy"]) {
    const res = mockRes();
    await handler(mockReq({ persona: "compliance", scenario, question: "test" }), res);
    assert.equal(res.statusCode, 500, `${scenario} should pass routing and fail on missing key`);
  }
  if (original) process.env.ANTHROPIC_API_KEY = original;
});
