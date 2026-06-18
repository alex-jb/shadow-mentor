// Contract tests for /api/scenarios — surface-discovery endpoint. If
// the shape drifts, AI crawlers indexing this URL get stale data and
// banking reviewers' "what can Shadow do" answer becomes wrong.

import { test } from "node:test";
import assert from "node:assert/strict";
import scenariosHandler from "../api/scenarios.js";

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
  return res;
}

test("scenarios endpoint returns service identity", async () => {
  const res = mockRes();
  await scenariosHandler({ method: "GET" }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.service, "shadow-mentor");
  assert.equal(res.body.rubric_version, "0.3.3");
});

test("scenarios endpoint enumerates 5 personas with 3 voices each", async () => {
  const res = mockRes();
  await scenariosHandler({ method: "GET" }, res);
  assert.equal(res.body.personas.length, 5);
  for (const p of res.body.personas) {
    assert.equal(p.voices.length, 3, `${p.id} should have 3 voices`);
    assert.ok(p.voices.includes("junior"));
    assert.ok(p.voices.includes("senior"));
    assert.ok(p.voices.includes("third"));
  }
});

test("scenarios endpoint enumerates 4 scenarios", async () => {
  const res = mockRes();
  await scenariosHandler({ method: "GET" }, res);
  assert.equal(res.body.scenarios.length, 4);
  const ids = res.body.scenarios.map((s) => s.id);
  for (const expected of ["lbo", "bloomberg", "cds", "policy"]) {
    assert.ok(ids.includes(expected), `missing scenario ${expected}`);
  }
});

test("scenarios endpoint shows 4 device clients", async () => {
  const res = mockRes();
  await scenariosHandler({ method: "GET" }, res);
  assert.equal(res.body.devices.length, 4);
  const ids = res.body.devices.map((d) => d.id);
  for (const expected of ["desktop", "g2", "frame", "xreal"]) {
    assert.ok(ids.includes(expected), `missing device ${expected}`);
  }
});

test("scenarios endpoint shows both providers", async () => {
  const res = mockRes();
  await scenariosHandler({ method: "GET" }, res);
  assert.equal(res.body.providers.length, 2);
  const ids = res.body.providers.map((p) => p.id);
  assert.ok(ids.includes("anthropic"));
  assert.ok(ids.includes("glm"));
});

test("scenarios endpoint advertises 7 endpoints", async () => {
  const res = mockRes();
  await scenariosHandler({ method: "GET" }, res);
  assert.equal(res.body.endpoints.length, 7);
  const paths = res.body.endpoints.map((e) => e.path);
  for (const expected of ["/api/deliberate", "/api/recall", "/api/calibration", "/api/health", "/api/badge", "/api/version", "/api/scenarios"]) {
    assert.ok(paths.includes(expected), `missing endpoint ${expected}`);
  }
});

test("scenarios endpoint reports 5×4 = 20 cells total", async () => {
  const res = mockRes();
  await scenariosHandler({ method: "GET" }, res);
  assert.equal(res.body.cells_total, 20);
});

test("scenarios endpoint sets 1-hour cache", async () => {
  const res = mockRes();
  await scenariosHandler({ method: "GET" }, res);
  assert.match(res.headers["Cache-Control"], /max-age=3600/);
});
