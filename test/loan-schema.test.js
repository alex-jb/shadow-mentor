// Tests for lib/schemas/loan — input validation + normalization.

import { test } from "node:test";
import assert from "node:assert/strict";
import { validateLoan, normalizeLoan, LOAN_DEFAULTS, LOAN_SCHEMA_VERSION } from "../lib/schemas/loan.js";

test("LOAN_DEFAULTS exposes Lora's BR thresholds verbatim", () => {
  assert.equal(LOAN_DEFAULTS.fico_approve_floor, 700);
  assert.equal(LOAN_DEFAULTS.dti_approve_ceiling, 0.36);
  assert.equal(LOAN_DEFAULTS.ltv_approve_ceiling, 0.80);
  assert.equal(LOAN_DEFAULTS.var_approve_ceiling, 0.12);
  assert.equal(LOAN_DEFAULTS.var_confidence, 0.95);
  assert.equal(LOAN_DEFAULTS.var_horizon_days, 10);
});

test("LOAN_SCHEMA_VERSION pinned to mode-a", () => {
  assert.equal(LOAN_SCHEMA_VERSION, "1.0.0-mode-a");
});

test("validateLoan accepts minimal valid loan", () => {
  const r = validateLoan({
    credit_score: 720,
    debt_to_income: 0.30,
    loan_to_value: 0.75,
    amount: 250000
  });
  assert.equal(r.valid, true);
  assert.equal(r.errors.length, 0);
});

test("validateLoan rejects non-object", () => {
  assert.equal(validateLoan(null).valid, false);
  assert.equal(validateLoan("loan").valid, false);
});

test("validateLoan rejects out-of-range credit_score", () => {
  const r = validateLoan({ credit_score: 250, debt_to_income: 0.30, loan_to_value: 0.75, amount: 1000 });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes("credit_score")));
});

test("validateLoan rejects negative amount", () => {
  const r = validateLoan({ credit_score: 720, debt_to_income: 0.30, loan_to_value: 0.75, amount: -1 });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes("amount")));
});

test("validateLoan accepts optional fair_lending_review_flag", () => {
  const r = validateLoan({
    credit_score: 720, debt_to_income: 0.30, loan_to_value: 0.75, amount: 250000,
    fair_lending_review_flag: true
  });
  assert.equal(r.valid, true);
});

test("validateLoan rejects non-array adverse_action_reasons", () => {
  const r = validateLoan({
    credit_score: 720, debt_to_income: 0.30, loan_to_value: 0.75, amount: 250000,
    adverse_action_reasons: "missed payments"
  });
  assert.equal(r.valid, false);
});

test("validateLoan rejects unknown borrower_rating", () => {
  const r = validateLoan({
    credit_score: 720, debt_to_income: 0.30, loan_to_value: 0.75, amount: 250000,
    borrower_rating: "ZZ"
  });
  assert.equal(r.valid, false);
});

test("validateLoan accepts valid borrower_rating like B-rated", () => {
  const r = validateLoan({
    credit_score: 720, debt_to_income: 0.30, loan_to_value: 0.75, amount: 250000,
    borrower_rating: "B"
  });
  assert.equal(r.valid, true);
});

test("normalizeLoan fills sensible defaults for risk inputs", () => {
  const out = normalizeLoan({ credit_score: 720, debt_to_income: 0.30, loan_to_value: 0.75, amount: 1 });
  assert.ok(Array.isArray(out.market_proxy_prices));
  assert.ok(out.market_proxy_prices.length >= 3);
  assert.deepEqual(out.collateral_positions, []);
  assert.ok(out.borrower_exposure_weights);
  assert.equal(out.fair_lending_review_flag, false);
  assert.deepEqual(out.adverse_action_reasons, []);
});

test("normalizeLoan lowercases sector for sector_exposure compatibility", () => {
  const out = normalizeLoan({
    credit_score: 720, debt_to_income: 0.30, loan_to_value: 0.75, amount: 1,
    sector: "Commercial_Real_Estate"
  });
  assert.equal(out.sector, "commercial_real_estate");
});
