// Tests for lib/run-loan-council — JS port of Lora's verdict resolver.
// Verbatim block > escalate > approve logic from Python reference.

import { test } from "node:test";
import assert from "node:assert/strict";
import { runLoanCouncil } from "../lib/run-loan-council.js";

const cleanLoan = {
  credit_score: 740,           // ≥ 700 floor → fundamentals OK
  debt_to_income: 0.28,        // ≤ 0.36 ceiling → fundamentals OK
  loan_to_value: 0.65,         // ≤ 0.80 ceiling → risk officer OK
  amount: 250000,
  sector: "industrials",
  fair_lending_review_flag: false,
  adverse_action_reasons: [],
  market_proxy_prices: [100, 101, 99, 102, 100, 101, 99, 100, 101, 100, 99]
};

test("clean loan with no flags returns 5 voices + approve", () => {
  const r = runLoanCouncil(cleanLoan);
  assert.equal(r.voices.length, 5);
  assert.equal(r.final_verdict, "approve");
  assert.ok(r.risk_packet.var_95_10d >= 0);
  assert.ok(r.risk_packet.es_95_10d >= 0);
});

test("fair_lending_review_flag triggers hard block (overrides everything)", () => {
  const r = runLoanCouncil({ ...cleanLoan, fair_lending_review_flag: true });
  assert.equal(r.final_verdict, "block");
  const flcVoice = r.voices.find((v) => v.voice === "Fair Lending Compliance");
  assert.equal(flcVoice.verdict, "block");
});

test("low FICO escalates Credit Fundamentals voice but not whole council", () => {
  const r = runLoanCouncil({ ...cleanLoan, credit_score: 620 });
  const cf = r.voices.find((v) => v.voice === "Credit Fundamentals");
  assert.equal(cf.verdict, "escalate");
  assert.equal(r.final_verdict, "escalate");
});

test("high DTI escalates Credit Fundamentals", () => {
  const r = runLoanCouncil({ ...cleanLoan, debt_to_income: 0.50 });
  const cf = r.voices.find((v) => v.voice === "Credit Fundamentals");
  assert.equal(cf.verdict, "escalate");
});

test("high LTV escalates Risk Officer", () => {
  const r = runLoanCouncil({ ...cleanLoan, loan_to_value: 0.95 });
  const ro = r.voices.find((v) => v.voice === "Risk Officer");
  assert.equal(ro.verdict, "escalate");
});

test("CRE sector escalates Macro Contrarian", () => {
  const r = runLoanCouncil({ ...cleanLoan, sector: "commercial_real_estate" });
  const mc = r.voices.find((v) => v.voice === "Macro Contrarian");
  assert.equal(mc.verdict, "escalate");
});

test("'cre' string alias also triggers Macro Contrarian escalation", () => {
  const r = runLoanCouncil({ ...cleanLoan, sector: "cre" });
  const mc = r.voices.find((v) => v.voice === "Macro Contrarian");
  assert.equal(mc.verdict, "escalate");
});

test("adverse_action_reasons present escalates Customer Advocate", () => {
  const r = runLoanCouncil({
    ...cleanLoan,
    adverse_action_reasons: ["insufficient income", "high revolving balance"]
  });
  const ca = r.voices.find((v) => v.voice === "Customer Advocate");
  assert.equal(ca.verdict, "escalate");
});

test("block > escalate > approve resolution: flagged FL beats escalate signals", () => {
  const r = runLoanCouncil({
    ...cleanLoan,
    credit_score: 620,
    fair_lending_review_flag: true
  });
  assert.equal(r.final_verdict, "block");
});

test("escalate > approve resolution: any escalate flips final to escalate", () => {
  const r = runLoanCouncil({ ...cleanLoan, loan_to_value: 0.95 });
  assert.equal(r.final_verdict, "escalate");
});

test("thresholds_applied field exposes Lora's BR defaults for audit", () => {
  const r = runLoanCouncil(cleanLoan);
  assert.equal(r.thresholds_applied.fico_floor, 700);
  assert.equal(r.thresholds_applied.dti_ceiling, 0.36);
  assert.equal(r.thresholds_applied.ltv_ceiling, 0.80);
  assert.equal(r.thresholds_applied.var_ceiling, 0.12);
});

test("schema_version field pinned for downstream audit chain", () => {
  const r = runLoanCouncil(cleanLoan);
  assert.equal(r.schema_version, "1.0.0-mode-a");
});

test("loan_id assigned when not provided", () => {
  const r = runLoanCouncil(cleanLoan);
  assert.ok(r.loan_id.startsWith("loan-"));
});

test("loan_id preserved when provided", () => {
  const r = runLoanCouncil({ ...cleanLoan, loan_id: "loan-test-abc" });
  assert.equal(r.loan_id, "loan-test-abc");
});

test("all 5 voices present in order (Credit / Risk / FL / Advocate / Macro)", () => {
  const r = runLoanCouncil(cleanLoan);
  assert.equal(r.voices[0].voice, "Credit Fundamentals");
  assert.equal(r.voices[1].voice, "Risk Officer");
  assert.equal(r.voices[2].voice, "Fair Lending Compliance");
  assert.equal(r.voices[3].voice, "Customer Advocate");
  assert.equal(r.voices[4].voice, "Macro Contrarian");
});
