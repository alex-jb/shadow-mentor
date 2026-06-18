// Contract tests for POST /api/loan-council — Lora Mode A 5-voice
// deterministic compute endpoint. No LLM, pure rule layer.

import { test } from "node:test";
import assert from "node:assert/strict";
import loanCouncilHandler from "../api/loan-council.js";

function mockReq(body = {}, method = "POST") {
  return { method, body, headers: { "content-type": "application/json" } };
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    end() { return this; }
  };
  return res;
}

const cleanLoan = {
  credit_score: 740,
  debt_to_income: 0.28,
  loan_to_value: 0.65,
  amount: 250000,
  sector: "industrials",
  fair_lending_review_flag: false,
  // Stable price series → VaR < 0.12 ceiling → Risk Officer approves
  market_proxy_prices: [100, 101, 99, 102, 100, 101, 99, 100, 101, 100, 99]
};

test("loan-council POST returns 5 voices + approve on clean input", async () => {
  const res = mockRes();
  await loanCouncilHandler(mockReq({ loan: cleanLoan }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.voices.length, 5);
  assert.equal(res.body.final_verdict, "approve");
  assert.ok(typeof res.body.latency_ms === "number");
});

test("loan-council POST returns block when fair_lending_review_flag", async () => {
  const res = mockRes();
  await loanCouncilHandler(mockReq({ loan: { ...cleanLoan, fair_lending_review_flag: true } }), res);
  assert.equal(res.body.final_verdict, "block");
});

test("loan-council POST exposes thresholds_applied (Lora BR defaults)", async () => {
  const res = mockRes();
  await loanCouncilHandler(mockReq({ loan: cleanLoan }), res);
  assert.equal(res.body.thresholds_applied.fico_floor, 700);
  assert.equal(res.body.thresholds_applied.dti_ceiling, 0.36);
  assert.equal(res.body.thresholds_applied.ltv_ceiling, 0.80);
  assert.equal(res.body.thresholds_applied.var_ceiling, 0.12);
});

test("loan-council POST rejects missing loan body with 400 + example", async () => {
  const res = mockRes();
  await loanCouncilHandler(mockReq({}), res);
  assert.equal(res.statusCode, 400);
  assert.ok(res.body.error.includes("missing"));
  assert.ok(res.body.example.loan.credit_score);
});

test("loan-council POST rejects invalid loan with validation_errors", async () => {
  const res = mockRes();
  await loanCouncilHandler(mockReq({ loan: { credit_score: 100, debt_to_income: 0.3, loan_to_value: 0.5, amount: 1 } }), res);
  assert.equal(res.statusCode, 400);
  assert.ok(Array.isArray(res.body.validation_errors));
  assert.ok(res.body.validation_errors.some((e) => e.includes("credit_score")));
});

test("loan-council rejects non-POST with 405", async () => {
  const res = mockRes();
  await loanCouncilHandler(mockReq({}, "GET"), res);
  assert.equal(res.statusCode, 405);
});

test("loan-council handles OPTIONS for CORS preflight", async () => {
  const res = mockRes();
  await loanCouncilHandler(mockReq({}, "OPTIONS"), res);
  assert.equal(res.statusCode, 200);
});

test("loan-council sets no-store cache (always fresh)", async () => {
  const res = mockRes();
  await loanCouncilHandler(mockReq({ loan: cleanLoan }), res);
  assert.equal(res.headers["Cache-Control"], "no-store");
});

test("loan-council schema_version pinned to mode-a", async () => {
  const res = mockRes();
  await loanCouncilHandler(mockReq({ loan: cleanLoan }), res);
  assert.equal(res.body.schema_version, "1.0.0-mode-a");
});
