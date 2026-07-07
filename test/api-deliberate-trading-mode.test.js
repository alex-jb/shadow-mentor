// /api/deliberate?mode=trading — trader-pack v0.2 dispatch tests.
//
// End-to-end coverage that the trading vertical hits sizePosition() through
// the same endpoint as banking, and that the 3 named contract invariants
// survive the HTTP layer:
//
//   1. Risk Sizer never emits a direction (Judge owns direction upstream).
//   2. Position respects max_kelly_cap and volatility scalar.
//   3. no_op direction → skip verdict, position_usd = null.
//
// These are the same 3 named contracts pinned inside the pure-JS unit tests
// at test/trader-pack-risk-sizer-contract.test.js — asserting them at the
// HTTP boundary catches wire-format regressions the pure-JS tests would miss.

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

function baseTrade(overrides = {}) {
  return {
    direction: "long",
    directional_confidence: 0.72,
    bankroll_usd: 10_000.0,
    volatility_regime: "medium",
    kelly_p_win: 0.55,
    kelly_avg_win_pct: 0.04,
    kelly_avg_loss_pct: 0.02,
    ...overrides,
  };
}

test("mode=trading returns 200 with Risk Sizer voice on valid input", async () => {
  const res = mockRes();
  await handler(mockReq({ mode: "trading", trade: baseTrade() }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.mode, "trading");
  assert.equal(res.body.trader_pack_version, "v0.2");
  assert.ok(Array.isArray(res.body.voices));
  assert.equal(res.body.voices.length, 1);
  assert.equal(res.body.voices[0].voice, "Risk Sizer");
  assert.ok(["fund", "skip"].includes(res.body.verdict));
});

test("mode=trading Risk Sizer NEVER emits a direction field on the wire", async () => {
  for (const direction of ["long", "short", "no_op"]) {
    const res = mockRes();
    await handler(mockReq({ mode: "trading", trade: baseTrade({ direction }) }), res);
    assert.equal(res.statusCode, 200);
    // Voice output has verdict + position_usd, but no direction.
    const voice = res.body.voices[0];
    assert.equal(voice.direction, undefined, `voice must not have direction field (dir=${direction})`);
    // Envelope verdict is fund/skip — never long/short/no_op.
    assert.ok(["fund", "skip"].includes(res.body.verdict));
  }
});

test("mode=trading no_op direction → skip verdict + null position_usd", async () => {
  const res = mockRes();
  await handler(mockReq({ mode: "trading", trade: baseTrade({ direction: "no_op" }) }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.verdict, "skip");
  assert.equal(res.body.voices[0].position_usd, null);
});

test("mode=trading respects max_kelly_cap through the wire", async () => {
  const res = mockRes();
  await handler(
    mockReq({
      mode: "trading",
      trade: baseTrade({ max_kelly_cap: 0.10, volatility_regime: "low" }),
    }),
    res,
  );
  assert.equal(res.statusCode, 200);
  if (res.body.verdict === "fund") {
    assert.ok(
      res.body.voices[0].position_usd <= 0.10 * 10_000 + 0.01,
      `position ${res.body.voices[0].position_usd} exceeds 10% cap on $10k`,
    );
  }
});

test("mode=trading rejects missing trade object", async () => {
  const res = mockRes();
  await handler(mockReq({ mode: "trading" }), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /trade/);
});

test("mode=trading rejects unknown direction", async () => {
  const res = mockRes();
  await handler(mockReq({ mode: "trading", trade: baseTrade({ direction: "moonshot" }) }), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /direction/);
});

test("mode=trading rejects unknown volatility_regime", async () => {
  const res = mockRes();
  await handler(mockReq({ mode: "trading", trade: baseTrade({ volatility_regime: "epic" }) }), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /volatility_regime/);
});

test("mode=trading rejects missing required Kelly fields", async () => {
  const t = baseTrade();
  delete t.kelly_p_win;
  const res = mockRes();
  await handler(mockReq({ mode: "trading", trade: t }), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /kelly_p_win/);
});

test("mode=trading dispatch bypasses persona/scenario validation (banking mode is untouched)", async () => {
  // If banking-mode validation ran, this would fail with "unknown persona".
  // Trading mode's early dispatch must return 200 without touching persona/scenario.
  const res = mockRes();
  await handler(
    mockReq({
      mode: "trading",
      persona: "nonexistent-persona-would-fail-in-banking-mode",
      trade: baseTrade(),
    }),
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.mode, "trading");
});

test("mode=trading returns latency_ms + attestation=null on v0.2", async () => {
  const res = mockRes();
  await handler(mockReq({ mode: "trading", trade: baseTrade() }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(typeof res.body.latency_ms, "number");
  assert.ok(res.body.latency_ms >= 0);
  // v0.2 skips attestation — v0.4 adds cross-vertical hash-chain continuity.
  assert.equal(res.body.attestation, null);
});
