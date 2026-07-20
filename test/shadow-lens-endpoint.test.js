// Contract tests for POST /api/shadow-lens-analyze — the real source-bound pipeline over
// HTTP. Fixture mode (precomputed findings) exercises the full analyze→seal→verify path
// with no key, plus the P0 guards (method, required fields, magic-byte image, CORS allow-list).
import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/shadow-lens-analyze.js";

function mockReq(body = {}, { method = "POST", origin } = {}) {
  return { method, body, headers: { ...(origin ? { origin } : {}) } };
}
function mockRes() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; },
    json(p) { this.body = p; return this; }, end() { return this; },
  };
}
const SM = [
  { source_id: "L1", text: "FICO Score: 706", bounding_box_normalized: { x: 0.1, y: 0.3, w: 0.4, h: 0.03 }, confidence: 0.97 },
  { source_id: "L2", text: "DTI: 0.41", bounding_box_normalized: { x: 0.1, y: 0.34, w: 0.4, h: 0.03 }, confidence: 0.95 },
];
const okBody = (extra = {}) => ({
  source_map: SM,
  capture: { capture_id: "cap1", capture_sha256: "sha256:" + "a".repeat(64), capture_method: "xreal-eye-still" },
  device: { platform: "unity-xreal", runtime_mode: "UNITY_XREAL", tracking_mode: "6dof", camera_mode: "xreal-eye" },
  build: { app_commit: "test" },
  findings: [{ claim: "DTI over ceiling", source_ids: ["L2"], quote: "DTI: 0.41", severity: "warn", confidence: 0.9 }],
  ...extra,
});

test("fixture-mode POST runs analyze→seal→verify → contract-valid verified session", async () => {
  const res = mockRes();
  await handler(mockReq(okBody()), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.contract_valid, true, JSON.stringify(res.body.contract_errors));
  assert.equal(res.body.verification.record_integrity, "verified");
  assert.equal(res.body.session.claims.length, 1);          // the one source_bound finding
  assert.equal(res.body.analysis.source_bound, 1);
  assert.match(res.body.public_key_pem, /BEGIN PUBLIC KEY/);
});

test("guards: method, required fields, magic-byte image", async () => {
  const g = mockRes(); await handler(mockReq(okBody(), { method: "GET" }), g); assert.equal(g.statusCode, 405);
  const o = mockRes(); await handler(mockReq({}, { method: "OPTIONS" }), o); assert.equal(o.statusCode, 200);
  const nosm = mockRes(); await handler(mockReq({ capture: { capture_sha256: "x" } }), nosm); assert.equal(nosm.statusCode, 400);
  const nocap = mockRes(); await handler(mockReq({ source_map: SM }), nocap); assert.equal(nocap.statusCode, 400);
  const badimg = mockRes(); await handler(mockReq(okBody({ capture_image_base64: Buffer.from("<svg>").toString("base64") })), badimg);
  assert.equal(badimg.statusCode, 400);
  assert.match(badimg.body.error, /magic bytes|image rejected/);
});

test("CORS: allow-listed origin is echoed; a random origin is not", async () => {
  const ok = mockRes(); await handler(mockReq(okBody(), { origin: "http://localhost:8127" }), ok);
  assert.equal(ok.headers["Access-Control-Allow-Origin"], "http://localhost:8127");
  const evil = mockRes(); await handler(mockReq(okBody(), { origin: "https://evil.example" }), evil);
  assert.equal(evil.headers["Access-Control-Allow-Origin"], undefined);
});

test("a finding citing a nonexistent source_id does not become a claim", async () => {
  const res = mockRes();
  await handler(mockReq(okBody({ findings: [{ claim: "fake", source_ids: ["L99"], confidence: 0.5 }] })), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.session.claims.length, 0);   // rejected, never a claim
  assert.equal(res.body.analysis.rejected, 1);
});
