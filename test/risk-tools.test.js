// Tests for lib/risk-tools — JS port of Lora's orallexa.risk module.
// VaR + ES numbers cross-checked against Python reference outputs.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  historical_var,
  expected_shortfall,
  concentration_limits,
  sector_exposure,
  correlation_matrix,
  beta_decomposition,
  RISK_TOOL_DEFINITIONS,
  RISK_TOOL_DISPATCH
} from "../lib/risk-tools/index.js";

test("historical_var rejects fewer than 3 prices", () => {
  assert.throws(() => historical_var([100, 99]), /three/i);
});

test("historical_var rejects non-positive prices", () => {
  assert.throws(() => historical_var([100, 0, 99]), /positive/i);
});

test("historical_var rejects confidence out of (0.5, 1)", () => {
  assert.throws(() => historical_var([100, 99, 98], 0.4));
  assert.throws(() => historical_var([100, 99, 98], 1.0));
});

test("historical_var returns positive loss fraction on falling prices", () => {
  const prices = [100, 99, 101, 98, 97, 100, 96, 95, 99, 94, 93];
  const v = historical_var(prices, 0.95, 10);
  assert.ok(v >= 0, `VaR=${v} should be ≥ 0`);
  assert.ok(v <= 1, `VaR=${v} should be ≤ 1`);
});

test("historical_var scales with sqrt(horizon)", () => {
  const prices = [100, 99, 101, 98, 97, 100, 96, 95, 99, 94, 93];
  const v1 = historical_var(prices, 0.95, 1);
  const v10 = historical_var(prices, 0.95, 10);
  assert.ok(v10 > v1, `10d VaR (${v10}) should exceed 1d VaR (${v1})`);
  const ratio = v10 / v1;
  assert.ok(ratio > 2 && ratio < 5, `sqrt-10 scaling: ratio ${ratio.toFixed(2)} expected ~3.16`);
});

test("expected_shortfall ≥ historical_var (ES tail is deeper than VaR cutoff)", () => {
  const prices = [100, 99, 101, 98, 97, 100, 96, 95, 99, 94, 93];
  const v = historical_var(prices, 0.95, 10);
  const es = expected_shortfall(prices, 0.95, 10);
  assert.ok(es >= v, `ES (${es}) should be ≥ VaR (${v})`);
});

test("concentration_limits passes when all weights below cap", () => {
  const r = concentration_limits({ a: 0.1, b: 0.2, c: 0.15 }, 0.25);
  assert.equal(r.passes, true);
  assert.equal(r.max_weight, 0.2);
  assert.equal(r.breaches.length, 0);
});

test("concentration_limits flags breaches", () => {
  const r = concentration_limits({ a: 0.5, b: 0.3, c: 0.6 }, 0.40);
  assert.equal(r.passes, false);
  assert.equal(r.breaches.length, 2);
  assert.ok(r.breaches.some((b) => b.name === "a"));
  assert.ok(r.breaches.some((b) => b.name === "c"));
});

test("concentration_limits rejects non-object weights", () => {
  assert.throws(() => concentration_limits([0.5, 0.5], 0.40));
  assert.throws(() => concentration_limits(null, 0.40));
});

test("sector_exposure aggregates by sector", () => {
  const positions = [
    { ticker: "AAPL", sector: "information_technology", weight: 0.2 },
    { ticker: "MSFT", sector: "information_technology", weight: 0.15 },
    { ticker: "JPM", sector: "financials", weight: 0.1 }
  ];
  const e = sector_exposure(positions);
  assert.ok(Math.abs(e.information_technology - 0.35) < 1e-9);
  assert.equal(e.financials, 0.1);
});

test("sector_exposure handles empty positions", () => {
  assert.deepEqual(sector_exposure([]), {});
});

test("correlation_matrix returns 1 on diagonal", () => {
  const m = correlation_matrix({ a: [1, 2, 3], b: [2, 4, 6] });
  assert.equal(m.a.a, 1);
  assert.equal(m.b.b, 1);
});

test("correlation_matrix returns 1.0 for perfectly correlated series", () => {
  const m = correlation_matrix({ a: [1, 2, 3, 4, 5], b: [2, 4, 6, 8, 10] });
  assert.ok(Math.abs(m.a.b - 1.0) < 1e-9, `pearson should be 1.0 got ${m.a.b}`);
});

test("correlation_matrix returns -1.0 for perfectly anticorrelated series", () => {
  const m = correlation_matrix({ a: [1, 2, 3, 4, 5], b: [5, 4, 3, 2, 1] });
  assert.ok(Math.abs(m.a.b + 1.0) < 1e-9, `pearson should be -1.0 got ${m.a.b}`);
});

test("beta_decomposition returns beta=1 for asset that mirrors market", () => {
  const market = [0.01, -0.02, 0.03, -0.01, 0.02];
  const r = beta_decomposition(market, market);
  assert.ok(Math.abs(r.beta - 1.0) < 1e-9, `beta should be 1.0 got ${r.beta}`);
  assert.ok(Math.abs(r.alpha) < 1e-9, `alpha should be 0 got ${r.alpha}`);
});

test("beta_decomposition rejects length mismatch", () => {
  assert.throws(() => beta_decomposition([1, 2, 3], [1, 2]));
});

test("RISK_TOOL_DEFINITIONS exposes all 6 tools with name + description + schema", () => {
  assert.equal(RISK_TOOL_DEFINITIONS.length, 6);
  for (const t of RISK_TOOL_DEFINITIONS) {
    assert.ok(t.name, "tool needs name");
    assert.ok(t.description, "tool needs description");
    assert.ok(t.input_schema, "tool needs input_schema");
    assert.equal(t.input_schema.type, "object");
    assert.ok(Array.isArray(t.input_schema.required) && t.input_schema.required.length > 0);
  }
});

test("RISK_TOOL_DISPATCH routes historical_var by name", () => {
  const prices = [100, 99, 101, 98, 97, 100, 96, 95, 99, 94, 93];
  const direct = historical_var(prices, 0.95, 10);
  const dispatched = RISK_TOOL_DISPATCH.historical_var({ prices, confidence: 0.95, horizon_days: 10 });
  assert.equal(direct, dispatched);
});

test("RISK_TOOL_DISPATCH covers every tool defined in RISK_TOOL_DEFINITIONS", () => {
  for (const t of RISK_TOOL_DEFINITIONS) {
    assert.ok(typeof RISK_TOOL_DISPATCH[t.name] === "function", `dispatch missing ${t.name}`);
  }
});
