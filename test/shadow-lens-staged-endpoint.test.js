// Contract tests for POST /api/shadow-lens (the staged dispatcher). Drives the full
// lifecycle through the module-scoped in-memory store, exercises the token gate + honest
// ephemerality flag. No LLM key needed (fixture findings).
import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/shadow-lens.js";

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
async function call(body, opts) { const r = mockRes(); await handler(mockReq(body, opts), r); return r; }

const PNG_B64 = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]).toString("base64");
const SM = [
  { source_id: "L1", text: "FICO Score: 706", bounding_box_normalized: { x: 0.1, y: 0.3, w: 0.4, h: 0.03 }, confidence: 0.97 },
  { source_id: "L2", text: "DTI: 0.41", bounding_box_normalized: { x: 0.1, y: 0.34, w: 0.4, h: 0.03 }, confidence: 0.95 },
];

test("full staged lifecycle over HTTP → verified, contract-valid", async () => {
  const create = await call({ stage: "create", device: { platform: "unity-xreal", runtime_mode: "UNITY_XREAL", tracking_mode: "6dof", camera_mode: "xreal-eye" }, build: { app_commit: "t" } });
  assert.equal(create.statusCode, 200);
  assert.equal(create.body.store, "in-memory-ephemeral");   // honest durability flag
  const token = create.body.token;
  assert.ok(token);

  assert.equal((await call({ stage: "capture", token, capture_image_base64: PNG_B64 })).statusCode, 200);
  assert.equal((await call({ stage: "source-map", token, source_map: SM })).statusCode, 200);
  assert.equal((await call({ stage: "analyze", token, findings: [{ claim: "DTI over ceiling", source_ids: ["L2"], quote: "DTI: 0.41", severity: "warn", confidence: 0.9 }] })).statusCode, 200);
  assert.equal((await call({ stage: "review", token, reviewer: { decision: "approved" } })).statusCode, 200);

  const seal = await call({ stage: "seal", token });
  assert.equal(seal.statusCode, 200);
  assert.equal(seal.body.verified, true);
  assert.equal(seal.body.valid, true, JSON.stringify(seal.body.validation_errors));
  assert.match(seal.body.public_key_pem, /BEGIN PUBLIC KEY/);

  const verify = await call({ stage: "verify", token });
  assert.equal(verify.body.record_integrity, "verified");
  assert.equal(verify.body.contract_valid, true);
});

test("unknown stage → 400; bad token → 401", async () => {
  assert.equal((await call({ stage: "nope" })).statusCode, 400);
  const bad = await call({ stage: "capture", token: "forged.tok", capture_image_base64: PNG_B64 });
  assert.equal(bad.statusCode, 401);
});

test("CORS allow-list: random origin is not reflected", async () => {
  const r = await call({ stage: "create" }, { origin: "https://evil.example" });
  assert.equal(r.headers["Access-Control-Allow-Origin"], undefined);
});
