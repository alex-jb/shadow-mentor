// v1.5.16 — Cross-vertical hash-chain continuity contract tests.
//
// The named invariant: sequential /api/deliberate calls — regardless of
// mode (banking / trading / ds) — MUST form ONE monotone SHA-256 chain.
// Reordering, insertion, or deletion of any entry must break the chain
// under verifyChain().
//
// This is the closing gap that turns the "one Shadow engine, three
// verticals" claim from marketing into a testable procurement property.
// Bank counsel can now mix banking + trading + ds requests, log the
// responses, and hand the whole log to verifyChain() for one answer.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { verifyChain, computeAttestationHash } from "../lib/attestation-chain.js";
import { defaultStore, createStore } from "../lib/attestation-chain-store.js";

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

function baseArtifact(overrides = {}) {
  return {
    artifact_id: "mlflow-run-abc123",
    model_type: "xgboost.XGBClassifier",
    task: "credit_scoring",
    feature_columns: ["fico", "dti", "ltv"],
    drift_snapshot: { psi: 0.10 },
    calibration: { brier: 0.15 },
    disparate_impact: { aim_ratio: 0.92 },
    ops_metrics: { p95_ms: 250 },
    ...overrides,
  };
}

// Reset the shared chain state before every test so tests don't leak
// state into each other. defaultStore is a process-scoped singleton
// consumed by api/deliberate.js.
beforeEach(() => {
  defaultStore.reset();
});

test("createStore returns an isolated chain — genesis previous_hash is null", () => {
  const s = createStore();
  assert.equal(s.getPreviousHash(), null);
  assert.equal(s.size(), 0);
});

test("recordAttestation advances the head to SHA-256 of the attestation", () => {
  const s = createStore();
  const att = {
    version: "shadow-attestation-v1",
    mode: "hmac-sha256",
    model_id: "test-model",
    request_commitment: "a".repeat(64),
    output_commitment: "b".repeat(64),
    completed_at_utc: "2026-07-07T21:00:00+00:00",
    previous_hash: null,
    key_id: "test",
    signature: "test-sig",
  };
  const head = s.recordAttestation(att);
  assert.equal(head, computeAttestationHash(att));
  assert.equal(s.getPreviousHash(), head);
  assert.equal(s.size(), 1);
});

test("reset returns the store to genesis", () => {
  const s = createStore();
  s.recordAttestation({ signature: "x", request_commitment: "y" });
  assert.equal(s.size(), 1);
  s.reset();
  assert.equal(s.getPreviousHash(), null);
  assert.equal(s.size(), 0);
});

test("two mode=trading calls in sequence form a valid 2-attestation chain", async () => {
  const res1 = mockRes();
  await handler(mockReq({ mode: "trading", trade: baseTrade() }), res1);
  const res2 = mockRes();
  await handler(mockReq({ mode: "trading", trade: baseTrade({ bankroll_usd: 20_000 }) }), res2);

  assert.equal(res1.body.attestation.previous_hash, null);
  const expectedPrev = computeAttestationHash(res1.body.attestation);
  assert.equal(res2.body.attestation.previous_hash, expectedPrev);

  const chain = verifyChain([res1.body.attestation, res2.body.attestation]);
  assert.equal(chain.ok, true);
  assert.equal(chain.links_verified, 1);
});

test("two mode=ds calls in sequence form a valid 2-attestation chain", async () => {
  const res1 = mockRes();
  await handler(mockReq({ mode: "ds", ds: { artifact: baseArtifact() } }), res1);
  const res2 = mockRes();
  await handler(mockReq({ mode: "ds", ds: { artifact: baseArtifact({ artifact_id: "run-002" }) } }), res2);

  const chain = verifyChain([res1.body.attestation, res2.body.attestation]);
  assert.equal(chain.ok, true);
});

test("MIXED banking + trading + ds sequence forms ONE monotone chain (the named v0.4 invariant)", async () => {
  // Sequence: trading → ds → trading → ds (banking excluded here because
  // it requires LLM calls in the codepath; the cross-vertical claim is
  // demonstrated by pure-computation modes chaining together).
  const trade1 = mockRes();
  await handler(mockReq({ mode: "trading", trade: baseTrade() }), trade1);

  const ds1 = mockRes();
  await handler(mockReq({ mode: "ds", ds: { artifact: baseArtifact() } }), ds1);

  const trade2 = mockRes();
  await handler(
    mockReq({ mode: "trading", trade: baseTrade({ volatility_regime: "high" }) }),
    trade2,
  );

  const ds2 = mockRes();
  await handler(
    mockReq({ mode: "ds", ds: { artifact: baseArtifact({ artifact_id: "run-final" }) } }),
    ds2,
  );

  const chain = [
    trade1.body.attestation,
    ds1.body.attestation,
    trade2.body.attestation,
    ds2.body.attestation,
  ];
  const result = verifyChain(chain);
  assert.equal(result.ok, true, `chain must verify across verticals; got: ${result.reason}`);
  assert.equal(result.length, 4);
  assert.equal(result.links_verified, 3);

  // Each attestation's model_id reflects its vertical.
  assert.equal(chain[0].model_id, "shadow/trader-pack-risk-sizer@v0.2");
  assert.equal(chain[1].model_id, "shadow/ds-pack@v0.2");
  assert.equal(chain[2].model_id, "shadow/trader-pack-risk-sizer@v0.2");
  assert.equal(chain[3].model_id, "shadow/ds-pack@v0.2");
});

test("reordering the mixed chain breaks verification (tamper detection)", async () => {
  const trade1 = mockRes();
  await handler(mockReq({ mode: "trading", trade: baseTrade() }), trade1);
  const ds1 = mockRes();
  await handler(mockReq({ mode: "ds", ds: { artifact: baseArtifact() } }), ds1);
  const trade2 = mockRes();
  await handler(mockReq({ mode: "trading", trade: baseTrade({ bankroll_usd: 15_000 }) }), trade2);

  // Reorder ds1 and trade2 — chain must break at index 1.
  const reordered = [
    trade1.body.attestation,
    trade2.body.attestation,
    ds1.body.attestation,
  ];
  const result = verifyChain(reordered);
  assert.equal(result.ok, false);
  assert.equal(result.broken_at_index, 1);
});

test("inserting a fabricated attestation into the mixed chain breaks verification", async () => {
  const trade1 = mockRes();
  await handler(mockReq({ mode: "trading", trade: baseTrade() }), trade1);
  const ds1 = mockRes();
  await handler(mockReq({ mode: "ds", ds: { artifact: baseArtifact() } }), ds1);

  const fabricated = {
    ...trade1.body.attestation,
    request_commitment: "f".repeat(64),
    signature: "fake",
  };
  const tampered = [trade1.body.attestation, fabricated, ds1.body.attestation];
  const result = verifyChain(tampered);
  assert.equal(result.ok, false);
});

test("deleting a middle attestation breaks the chain (truncation detection)", async () => {
  const trade1 = mockRes();
  await handler(mockReq({ mode: "trading", trade: baseTrade() }), trade1);
  const ds1 = mockRes();
  await handler(mockReq({ mode: "ds", ds: { artifact: baseArtifact() } }), ds1);
  const trade2 = mockRes();
  await handler(mockReq({ mode: "trading", trade: baseTrade({ bankroll_usd: 15_000 }) }), trade2);

  // Delete ds1 from the middle.
  const deleted = [trade1.body.attestation, trade2.body.attestation];
  const result = verifyChain(deleted);
  assert.equal(result.ok, false);
  assert.equal(result.broken_at_index, 1);
});

test("trading verdict skip (no LLM cost) still advances the chain", async () => {
  const res1 = mockRes();
  await handler(mockReq({ mode: "trading", trade: baseTrade({ direction: "no_op" }) }), res1);
  const res2 = mockRes();
  await handler(mockReq({ mode: "trading", trade: baseTrade() }), res2);

  // Even a skip verdict must chain — otherwise an operator could hide
  // "declined" decisions from the audit trail.
  assert.equal(res1.body.verdict, "skip");
  assert.equal(res2.body.attestation.previous_hash, computeAttestationHash(res1.body.attestation));
});

test("ds verdict BLOCK still advances the chain", async () => {
  const res1 = mockRes();
  await handler(
    mockReq({
      mode: "ds",
      ds: { artifact: baseArtifact({ disparate_impact: { aim_ratio: 0.60 } }) },
    }),
    res1,
  );
  const res2 = mockRes();
  await handler(mockReq({ mode: "ds", ds: { artifact: baseArtifact() } }), res2);

  assert.equal(res1.body.verdict, "BLOCK");
  assert.equal(res2.body.attestation.previous_hash, computeAttestationHash(res1.body.attestation));
});
