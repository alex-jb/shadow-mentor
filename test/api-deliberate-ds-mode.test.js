// /api/deliberate?mode=ds — ds-pack v0.2 dispatch tests.
//
// End-to-end coverage that the DS vertical hits runDSCouncil() through
// the same endpoint as banking + trading, and that the named contract
// invariants survive the HTTP layer.

import { test } from "node:test";
import assert from "node:assert/strict";

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
    end() { return this; },
  };
  return res;
}

function baseArtifact(overrides = {}) {
  return {
    artifact_id: "mlflow-run-abc123",
    model_type: "xgboost.XGBClassifier",
    task: "credit_scoring",
    feature_columns: ["fico", "dti", "ltv", "amount", "sector"],
    drift_snapshot: { psi: 0.10 },
    calibration: { brier: 0.15 },
    disparate_impact: { aim_ratio: 0.92 },
    ops_metrics: { p95_ms: 250 },
    ...overrides,
  };
}

test("mode=ds returns 200 with 5-voice DS council on clean artifact", async () => {
  const res = mockRes();
  await handler(
    mockReq({
      mode: "ds",
      ds: { artifact: baseArtifact(), lifecycle_stage: "pre_deploy" },
    }),
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.mode, "ds");
  assert.equal(res.body.ds_pack_version, "v0.2");
  assert.equal(res.body.voices.length, 5);
  assert.equal(res.body.verdict, "SHIP");
});

test("mode=ds Fair-ML BLOCK propagates to envelope verdict", async () => {
  const res = mockRes();
  await handler(
    mockReq({
      mode: "ds",
      ds: {
        artifact: baseArtifact({ disparate_impact: { aim_ratio: 0.60 } }),
      },
    }),
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.verdict, "BLOCK");
  assert.ok(res.body.adverse_action_codes.includes("AA05"));
});

test("mode=ds returns Ed25519 attestation with ds-pack model_id", async () => {
  const res = mockRes();
  await handler(
    mockReq({ mode: "ds", ds: { artifact: baseArtifact() } }),
    res,
  );
  assert.equal(res.statusCode, 200);
  const att = res.body.attestation;
  assert.ok(att && typeof att === "object");
  assert.equal(att.model_id, "shadow/ds-pack@v0.2");
  assert.equal(typeof att.signature, "string");
  assert.ok(att.signature.length > 0);
});

test("mode=ds attestation binds request → response (tamper detection)", async () => {
  const res1 = mockRes();
  await handler(
    mockReq({ mode: "ds", ds: { artifact: baseArtifact() } }),
    res1,
  );
  const res2 = mockRes();
  await handler(
    mockReq({
      mode: "ds",
      ds: { artifact: baseArtifact({ artifact_id: "mlflow-run-different" }) },
    }),
    res2,
  );
  assert.notEqual(
    res1.body.attestation.request_commitment,
    res2.body.attestation.request_commitment,
  );
  assert.notEqual(res1.body.attestation.signature, res2.body.attestation.signature);
});

test("mode=ds rejects missing artifact", async () => {
  const res = mockRes();
  await handler(mockReq({ mode: "ds", ds: {} }), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /artifact/);
});

test("mode=ds rejects invalid lifecycle_stage", async () => {
  const res = mockRes();
  await handler(
    mockReq({
      mode: "ds",
      ds: { artifact: baseArtifact(), lifecycle_stage: "invalid_stage" },
    }),
    res,
  );
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /lifecycle_stage/);
});

test("mode=ds dispatch bypasses banking persona/scenario validation", async () => {
  // A nonexistent persona would fail in banking mode; mode=ds must be
  // isolated and still return 200.
  const res = mockRes();
  await handler(
    mockReq({
      mode: "ds",
      persona: "nonexistent-persona-would-fail-in-banking-mode",
      ds: { artifact: baseArtifact() },
    }),
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.mode, "ds");
});

test("mode=ds envelope has governance_packet with 5 statuses", async () => {
  const res = mockRes();
  await handler(
    mockReq({ mode: "ds", ds: { artifact: baseArtifact() } }),
    res,
  );
  assert.equal(res.statusCode, 200);
  const gp = res.body.governance_packet;
  assert.equal(gp.drift_status, "SHIP");
  assert.equal(gp.model_validation_status, "SHIP");
  assert.equal(gp.fair_ml_status, "SHIP");
  assert.equal(gp.reproducibility_status, "SHIP");
  assert.equal(gp.ops_status, "SHIP");
});

test("mode=ds latency_ms present", async () => {
  const res = mockRes();
  await handler(
    mockReq({ mode: "ds", ds: { artifact: baseArtifact() } }),
    res,
  );
  assert.equal(typeof res.body.latency_ms, "number");
  assert.ok(res.body.latency_ms >= 0);
});
