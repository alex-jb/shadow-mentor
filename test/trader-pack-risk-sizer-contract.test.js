// Shadow Trader Pack — Risk Sizer contract tests (v0.2, 2026-07-07).
//
// Direct JS mirror of Orallexa tests/test_risk_sizer_contract.py so both
// sides of the cross-language wire-format stay in lockstep. Ports the
// same 7 tests verbatim:
//
//   1. size_position() MUST NOT return a direction
//   2. size_position() respects Kelly max-cap
//   3. size_position() returns skip on no_op direction
//   4. size_position() scales inversely with volatility regime
//   5. size_position() shrinks under drawdown-adjusted Kelly
//   +2 bonus: negative-Kelly skip + rationale readable
//
// Reference: FinPos (arXiv 2510.27251), Orallexa engine/risk_sizer.py v1.2.0.

import { test } from "node:test";
import assert from "node:assert/strict";
import { sizePosition } from "../lib/personas/trader-pack/risk-sizer.js";

function baseInput(overrides = {}) {
  return {
    direction: "long",
    directional_confidence: 0.72,
    bankroll_usd: 10_000.0,
    volatility_regime: "medium",
    kelly_p_win: 0.55,
    kelly_avg_win_pct: 0.04,
    kelly_avg_loss_pct: 0.02,
    current_drawdown_pct: 0.0,
    max_kelly_cap: 0.25,
    ...overrides,
  };
}

// Contract 1 — Risk Sizer NEVER emits a direction.
test("trader-pack risk sizer never emits direction", () => {
  for (const direction of ["long", "short", "no_op"]) {
    const out = sizePosition(baseInput({ direction }));
    assert.ok(
      out.verdict === "fund" || out.verdict === "skip",
      `verdict must be fund/skip, got ${out.verdict}`,
    );
    // No direction field on the output — Judge owns direction.
    assert.equal(out.direction, undefined);
    // Input direction preserved in metrics for audit.
    assert.equal(out.metrics.direction, direction);
  }
});

// Contract 2 — Kelly cap is respected.
test("trader-pack risk sizer respects Kelly max-cap", () => {
  for (const cap of [0.10, 0.25, 0.40]) {
    const out = sizePosition(
      baseInput({ max_kelly_cap: cap, volatility_regime: "low" }),
    );
    if (out.verdict === "fund") {
      assert.ok(out.position_usd !== null);
      assert.ok(
        out.position_usd <= cap * 10_000.0 + 0.01,
        `position ${out.position_usd} exceeds cap ${cap * 10000}`,
      );
    }
  }
});

// Contract 3 — no_op skips.
test("trader-pack risk sizer skips on no_op", () => {
  const out = sizePosition(baseInput({ direction: "no_op" }));
  assert.equal(out.verdict, "skip");
  assert.equal(out.position_usd, null);
  assert.ok(out.rationale.toLowerCase().includes("no_op"));
});

// Contract 4 — position scales inversely with volatility.
test("trader-pack risk sizer scales inversely with volatility", () => {
  const low = sizePosition(baseInput({ volatility_regime: "low" }));
  const med = sizePosition(baseInput({ volatility_regime: "medium" }));
  const high = sizePosition(baseInput({ volatility_regime: "high" }));

  assert.equal(low.verdict, "fund");
  assert.equal(med.verdict, "fund");
  assert.equal(high.verdict, "fund");

  assert.ok(
    low.position_usd > med.position_usd && med.position_usd > high.position_usd,
    `low=${low.position_usd}, med=${med.position_usd}, high=${high.position_usd}`,
  );
});

// Contract 5 — drawdown shrinks position.
test("trader-pack risk sizer shrinks under drawdown", () => {
  const noDd = sizePosition(baseInput({ current_drawdown_pct: 0.0 }));
  const dd10 = sizePosition(baseInput({ current_drawdown_pct: 0.10 }));
  const dd50 = sizePosition(baseInput({ current_drawdown_pct: 0.50 }));

  assert.equal(noDd.verdict, "fund");
  // Under 10% DD, position smaller than at 0%.
  assert.ok(
    dd10.position_usd === null || dd10.position_usd < noDd.position_usd,
    `dd10=${dd10.position_usd}, noDd=${noDd.position_usd}`,
  );
  // Under 50% DD, even smaller or skipped entirely.
  if (dd50.verdict === "fund") {
    assert.ok(
      dd50.position_usd < dd10.position_usd || dd50.position_usd < 100.0,
    );
  } else {
    assert.equal(dd50.verdict, "skip");
  }
});

// Bonus 6 — negative-Kelly parameters skip cleanly (bad-strategy input).
test("trader-pack risk sizer skips on negative Kelly", () => {
  const out = sizePosition(
    baseInput({
      kelly_p_win: 0.30,
      kelly_avg_win_pct: 0.02,
      kelly_avg_loss_pct: 0.02,
    }),
  );
  assert.equal(out.verdict, "skip");
  assert.equal(out.position_usd, null);
  const r = out.rationale.toLowerCase();
  assert.ok(
    r.includes("non-positive") || r.includes("break-even"),
    `rationale should cite non-positive or break-even, got: ${out.rationale}`,
  );
});

// Bonus 7 — rationale is human-readable + cites Kelly parameters.
test("trader-pack risk sizer rationale is readable", () => {
  const out = sizePosition(baseInput());
  if (out.verdict === "fund") {
    const r = out.rationale.toLowerCase();
    assert.ok(r.includes("kelly"));
    assert.ok(r.includes("volatility"));
    assert.ok(
      r.includes("direction was fixed") || r.includes("judge"),
      `rationale should reference Judge/upstream direction, got: ${out.rationale}`,
    );
  }
});
