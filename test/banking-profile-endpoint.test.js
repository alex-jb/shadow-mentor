// Contract tests for POST /api/banking-profile — the HTTP dispatch surface for
// Banking Evidence Profile v1. Same checkBankingProfileV1() primitive as the CLI
// (shadow-verify --profile banking-v1) and the MCP tool (shadow_banking_profile),
// so a SIEM/GRC pipeline gets a verdict identical to the analyst's chat surface.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import handler from "../api/banking-profile.js";
import { createSession, appendEvent, sealSession } from "../packages/attest-core/session.js";
import { computeDictionaryHash } from "../lib/enforce-reason-code-dictionary.js";

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

function conforming() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const s = createSession({ agent: { name: "loan-council", version: "1.5" }, models: [{ model_id: "council-v1", provider: "anthropic" }],
    environmentFingerprint: { os: "linux", node_version: "v24" }, keyId: "k", privateKey: privateKey.export({ type: "pkcs8", format: "pem" }) });
  appendEvent(s, { event_type: "tool_call", actor: "tool", payload: { tool: "bureau_pull" } });
  appendEvent(s, { event_type: "model_output", actor: "model", payload: { decision: "deny" },
    extensions: { dictionary_hash: computeDictionaryHash(), citation_registry_sha256: "sha256:x" } });
  appendEvent(s, { event_type: "human_approval", actor: "user", payload: { approved: true } });
  return { bundle: sealSession(s), pub: publicKey.export({ type: "spki", format: "pem" }) };
}

test("POST a conforming bundle → 200 ok, CONFORMS, packet when requested", async () => {
  const { bundle, pub } = conforming();
  const res = mockRes();
  await handler(mockReq({ bundle, public_key: pub, packet: true }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.conformance.pass, true);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "*");
  assert.match(res.body.examiner_packet_markdown, /Credit-decision evidence packet/);
  assert.equal(typeof res.body.latency_ms, "number");
});

test("C1: check_anchors surfaces the external trust level on HTTP (parity with the CLI)", async () => {
  const { bundle, pub } = conforming();
  // no external_anchors on this bundle → the base level, but the field is now PRESENT
  // (before C1, HTTP/MCP callers could never see anchor trust at all)
  const on = mockRes();
  await handler(mockReq({ bundle, public_key: pub, check_anchors: "structural" }), on);
  assert.equal(on.body.trust_level, "SELF_SIGNED");
  assert.ok(Array.isArray(on.body.anchors));
  // omitted by default → no trust_level noise for callers that don't ask
  const off = mockRes();
  await handler(mockReq({ bundle, public_key: pub }), off);
  assert.equal(off.body.trust_level, undefined);
});

test("POST a bare bundle → 200 with ok:false + named missing evidence", async () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  const s = createSession({ agent: { name: "x", version: "1" }, models: [], environmentFingerprint: { os: "m", node_version: "v1" },
    keyId: "k", privateKey: privateKey.export({ type: "pkcs8", format: "pem" }) });
  appendEvent(s, { event_type: "prompt", actor: "user", payload: { q: "hi" } });
  const res = mockRes();
  await handler(mockReq({ bundle: sealSession(s) }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, false);
  assert.ok(res.body.conformance.missing_required.includes("decision_outcome"));
});

test("GET → 405, missing bundle → 400, OPTIONS → 200", async () => {
  const g = mockRes(); await handler(mockReq({}, "GET"), g); assert.equal(g.statusCode, 405);
  const b = mockRes(); await handler(mockReq({}), b); assert.equal(b.statusCode, 400);
  const o = mockRes(); await handler(mockReq({}, "OPTIONS"), o); assert.equal(o.statusCode, 200);
});
