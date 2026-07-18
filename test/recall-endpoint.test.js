// Contract tests for GET /api/recall after it was rewired to honor the
// SHADOW_MEMORY_BACKEND env swap via buildMemoryBackend(). Covers the demo
// default, the method guards, the honest backend descriptor, and — the point of
// the try/catch — that a configured-but-unwired backend (the Elastic stub)
// degrades to a clean 503 instead of an unhandled 500.
import { test } from "node:test";
import assert from "node:assert/strict";
import recallHandler from "../api/recall.js";
import { describeMemoryBackend } from "../lib/memory-elastic.js";

function mockReq(path = "/api/recall", method = "GET") {
  return { method, url: path, headers: { host: "localhost" } };
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

test("default env → 200, in-memory-mock backend, entries array", async () => {
  const res = mockRes();
  await recallHandler(mockReq("/api/recall?persona=compliance"), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.backend, "in-memory-mock");
  assert.equal(res.body.persistent, false);
  assert.ok(Array.isArray(res.body.entries));
});

test("POST → 405, OPTIONS → 200", async () => {
  const p = mockRes(); await recallHandler(mockReq("/api/recall", "POST"), p); assert.equal(p.statusCode, 405);
  const o = mockRes(); await recallHandler(mockReq("/api/recall", "OPTIONS"), o); assert.equal(o.statusCode, 200);
});

test("describeMemoryBackend() tracks the env the factory reads", () => {
  const saved = { b: process.env.SHADOW_MEMORY_BACKEND, d: process.env.SHADOW_MEMORY_DIR, u: process.env.ELASTIC_URL };
  try {
    delete process.env.SHADOW_MEMORY_BACKEND; delete process.env.SHADOW_MEMORY_DIR; delete process.env.ELASTIC_URL;
    assert.deepEqual(describeMemoryBackend(), { name: "in-memory-mock", persistent: false });
    process.env.SHADOW_MEMORY_BACKEND = "tiered"; process.env.SHADOW_MEMORY_DIR = "/tmp/x";
    assert.deepEqual(describeMemoryBackend(), { name: "local-tiered", persistent: true });
    delete process.env.SHADOW_MEMORY_DIR;
    process.env.SHADOW_MEMORY_BACKEND = "elastic"; process.env.ELASTIC_URL = "https://es.example";
    assert.deepEqual(describeMemoryBackend(), { name: "elasticsearch", persistent: true });
  } finally {
    for (const [k, v] of [["SHADOW_MEMORY_BACKEND", saved.b], ["SHADOW_MEMORY_DIR", saved.d], ["ELASTIC_URL", saved.u]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});

test("configured-but-unwired Elastic backend → clean 503, not a 500", async () => {
  const saved = { b: process.env.SHADOW_MEMORY_BACKEND, u: process.env.ELASTIC_URL };
  try {
    process.env.SHADOW_MEMORY_BACKEND = "elastic";
    process.env.ELASTIC_URL = "https://es.example"; // constructs, but recall() throws (stub)
    const res = mockRes();
    await recallHandler(mockReq("/api/recall?persona=compliance"), res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.backend, "elasticsearch");
    assert.match(res.body.error, /unavailable/);
  } finally {
    if (saved.b === undefined) delete process.env.SHADOW_MEMORY_BACKEND; else process.env.SHADOW_MEMORY_BACKEND = saved.b;
    if (saved.u === undefined) delete process.env.ELASTIC_URL; else process.env.ELASTIC_URL = saved.u;
  }
});
