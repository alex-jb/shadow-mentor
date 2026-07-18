// Contract tests for POST /api/scan-analyze — the vision "generate answer"
// endpoint for the scan→answer→glasses demo. The live Claude Vision call needs a
// key, so these cover the guards + the graceful no-key fallback the demo relies on.
import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/scan-analyze.js";

function mockReq(body = {}, method = "POST") { return { method, body, headers: {} }; }
function mockRes() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(p) { this.body = p; return this; },
    end() { return this; },
  };
}

test("GET → 405, OPTIONS → 200, missing image → 400", async () => {
  const g = mockRes(); await handler(mockReq({}, "GET"), g); assert.equal(g.statusCode, 405);
  const o = mockRes(); await handler(mockReq({}, "OPTIONS"), o); assert.equal(o.statusCode, 200);
  const m = mockRes(); await handler(mockReq({}), m); assert.equal(m.statusCode, 400);
  assert.match(m.body.error, /image_base64/);
});

test("no ANTHROPIC_API_KEY → 503 with the fallback hint (demo uses its offline mock)", async () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const res = mockRes();
    await handler(mockReq({ image_base64: "aGVsbG8=", media_type: "image/png" }), res);
    assert.equal(res.statusCode, 503);
    assert.match(res.body.error, /ANTHROPIC_API_KEY/);
    assert.match(res.body.hint, /offline worked-mock/);
  } finally {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  }
});

test("CORS is open (demo runs from a file:// or a different origin)", async () => {
  const res = mockRes();
  await handler(mockReq({}, "OPTIONS"), res);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "*");
});
