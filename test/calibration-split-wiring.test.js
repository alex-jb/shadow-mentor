// Wiring test for A1 — the calibration/ranking split is now emitted by
// runLoanCouncil, fixing the documented defect where the single aggregated_score
// collapses "how confident" and "how approvable" so two very different loans land on
// the identical number (obvious_approve == borderline_escalate == 0.6575).
import { test } from "node:test";
import assert from "node:assert/strict";
import { runLoanCouncil } from "../lib/run-loan-council.js";

const PRICES = [100, 101, 99, 102, 100, 101, 99, 100, 101, 100, 99];
const loan = (o) => runLoanCouncil({ market_proxy_prices: PRICES, ...o });

test("runLoanCouncil emits calibration_ranking_split with both scores + a commitment", () => {
  const r = loan({ loan_id: "x", credit_score: 780, debt_to_income: 0.2, loan_to_value: 0.6, amount: 100000, sector: "technology" });
  const s = r.calibration_ranking_split;
  assert.ok(s, "calibration_ranking_split present");
  assert.equal(typeof s.calibrated_p, "number");
  assert.equal(typeof s.ranking_score, "number");
  assert.match(s.commitment_sha256, /^[0-9a-f]{64}$/);
});

test("the split DISTINGUISHES loans (anti-collapse) — different ranking_score + commitment", () => {
  const obvious = loan({ loan_id: "obvious", credit_score: 800, debt_to_income: 0.15, loan_to_value: 0.5, amount: 100000, sector: "technology" });
  const borderline = loan({ loan_id: "borderline", credit_score: 705, debt_to_income: 0.4, loan_to_value: 0.82, amount: 300000, sector: "industrials" });
  assert.notEqual(obvious.calibration_ranking_split.ranking_score, borderline.calibration_ranking_split.ranking_score);
  assert.notEqual(obvious.calibration_ranking_split.calibrated_p, borderline.calibration_ranking_split.calibrated_p);
  assert.notEqual(obvious.calibration_ranking_split.commitment_sha256, borderline.calibration_ranking_split.commitment_sha256);
});

test("commitment is stable for the same decision (deterministic)", () => {
  const a = loan({ loan_id: "z", credit_score: 720, debt_to_income: 0.3, loan_to_value: 0.75, amount: 250000, sector: "industrials" });
  const b = loan({ loan_id: "z", credit_score: 720, debt_to_income: 0.3, loan_to_value: 0.75, amount: 250000, sector: "industrials" });
  assert.equal(a.calibration_ranking_split.commitment_sha256, b.calibration_ranking_split.commitment_sha256);
});
