// HTTP tests for POST /api/shadow-lens/run (authoritative one-shot deployed path) and the
// staged endpoint's honest 501 when no durable store is configured in a production runtime.
import { test } from "node:test";
import assert from "node:assert/strict";
import runHandler from "../api/shadow-lens/run.js";
import stagedHandler from "../api/shadow-lens.js";

function mockReq(body = {}, { method = "POST", origin } = {}) { return { method, body, headers: { ...(origin ? { origin } : {}) } }; }
function mockRes() {
  return { statusCode: 200, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; },
    json(p) { this.body = p; return this; }, end() { return this; } };
}
const SM = [{ source_id: "L1", text: "DTI: 0.41", bounding_box_normalized: { x: 0.1, y: 0.3, w: 0.4, h: 0.03 }, confidence: 0.95 }];
const BODY = {
  source_map: SM, capture: { capture_sha256: "sha256:" + "a".repeat(64) },
  device: { platform: "unity-xreal", runtime_mode: "UNITY_XREAL", tracking_mode: "6dof", camera_mode: "xreal-eye" },
  build: { app_commit: "t" }, findings: [{ claim: "DTI over ceiling", source_ids: ["L1"], quote: "DTI: 0.41", severity: "warn", confidence: 0.9 }],
  reviewer: { decision: "approved" },
};

test("/run one-shot returns a complete verified session + Flow in one request", async () => {
  const res = mockRes();
  await runHandler(mockReq(BODY), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.verification.record_integrity, "verified");
  assert.equal(res.body.contract_valid, true);
  assert.ok(res.body.flow?.scenes?.audit?.length > 0);
  assert.match(res.body.public_key_pem, /BEGIN PUBLIC KEY/);
});

test("/run guards method + missing source_map", async () => {
  const g = mockRes(); await runHandler(mockReq(BODY, { method: "GET" }), g); assert.equal(g.statusCode, 405);
  const n = mockRes(); await runHandler(mockReq({ capture: BODY.capture }), n); assert.equal(n.statusCode, 400);
});

test("staged endpoint refuses in a production runtime with no durable store (501)", async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const res = mockRes();
    await stagedHandler(mockReq({ stage: "create" }), res);
    assert.equal(res.statusCode, 501);
    assert.equal(res.body.code, "PERSISTENT_SESSION_STORE_NOT_CONFIGURED");
  } finally { process.env.NODE_ENV = prev; }
});
