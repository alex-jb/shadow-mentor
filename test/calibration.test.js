// Contract tests for /api/calibration — bank model-risk reviewers poll this
// for their SR 11-7 monitoring dashboards. If it 500s or shape-drifts,
// monitoring breaks silently.

import { test } from "node:test";
import assert from "node:assert/strict";
import calibrationHandler from "../api/calibration.js";

function mockReq(path = "/api/calibration") {
  return { method: "GET", url: path, headers: { host: "localhost:3000" } };
}

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

test("calibration returns all-persona snapshot when no persona param", async () => {
  const res = mockRes();
  await calibrationHandler(mockReq("/api/calibration"), res);
  assert.equal(res.statusCode, 200);
  assert.ok("personas" in res.body);
  for (const p of ["compliance", "quant", "engineer", "trader", "advisor"]) {
    assert.ok(p in res.body.personas, `missing persona ${p}`);
  }
});

test("calibration returns per-persona stats", async () => {
  const res = mockRes();
  await calibrationHandler(mockReq("/api/calibration?persona=compliance"), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.persona, "compliance");
  assert.ok(typeof res.body.n === "number" && res.body.n > 0);
  assert.ok(typeof res.body.mean_brier === "number");
  assert.ok(res.body.mean_brier >= 0 && res.body.mean_brier <= 1);
});

test("calibration rejects unknown persona", async () => {
  const res = mockRes();
  await calibrationHandler(mockReq("/api/calibration?persona=spy"), res);
  assert.equal(res.statusCode, 400);
  assert.ok(res.body.error.includes("unknown persona"));
  assert.ok(Array.isArray(res.body.valid_personas));
});

test("calibration includes Brier interpretation guide", async () => {
  const res = mockRes();
  await calibrationHandler(mockReq("/api/calibration?persona=quant"), res);
  assert.ok(res.body.brier_interpretation.includes("0 = perfect"));
});

test("calibration sets short public cache (60s)", async () => {
  const res = mockRes();
  await calibrationHandler(mockReq("/api/calibration"), res);
  assert.match(res.headers["Cache-Control"], /max-age=60/);
});

test("calibration rubric_version exposed for model-risk audit", async () => {
  const res = mockRes();
  await calibrationHandler(mockReq("/api/calibration"), res);
  assert.equal(res.body.rubric_version, "0.3.3");
});
