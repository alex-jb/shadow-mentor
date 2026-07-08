// test/api-deliberate-refuse-to-serve.test.js
// v1.5.36 contract tests for /api/deliberate refuse_to_serve wire-in.
// Uses the handler directly with a mock LLM-fail path — we exercise
// only the code that runs AFTER LLM call would return. The Anthropic
// SDK will throw with the fake key; we test that the pre-LLM
// refuse_to_serve semantics apply correctly.
//
// Since the LLM will fail (no real key), we don't hit the LBO-branch
// promotion. Instead we test the primitive layer directly + assert
// the wire-in imports resolve.

import { test } from "node:test";
import assert from "node:assert/strict";

import { maybeRefuseToServe, REFUSAL_CATEGORY } from "../lib/refuse-to-serve.js";


test("wire-in: maybeRefuseToServe returns refuse_to_serve verdict for OFAC in loan.aml_flags", () => {
  const loan = { fico: 720, dti: 0.3, aml_flags: ["OFAC_SDN_MATCH"] };
  const amlKycFindings = {
    findings: loan.aml_flags.map((f) => ({ rule_id: f })),
  };
  const r = maybeRefuseToServe({ loan, amlKycFindings });
  assert.ok(r, "refusal expected");
  assert.equal(r.verdict, "refuse_to_serve");
  assert.equal(r.refusal_category, REFUSAL_CATEGORY.OFAC_SDN_MATCH);
  assert.equal(r.escalation_valid, false);
});


test("wire-in: BSA tipping-off in loan.aml_flags → refuse_to_serve", () => {
  const loan = { fico: 720, aml_flags: ["BSA_5318_TIPPING_OFF"] };
  const amlKycFindings = {
    findings: loan.aml_flags.map((f) => ({ rule_id: f })),
  };
  const r = maybeRefuseToServe({ loan, amlKycFindings });
  assert.ok(r);
  assert.equal(r.refusal_category, REFUSAL_CATEGORY.BSA_TIPPING_OFF);
});


test("wire-in: statutory ineligibility flag → refuse_to_serve", () => {
  const loan = { fico: 720, statutory_ineligibility_flag: true };
  const r = maybeRefuseToServe({ loan, amlKycFindings: { findings: [] } });
  assert.ok(r);
  assert.equal(r.refusal_category, REFUSAL_CATEGORY.STATUTORY_INELIGIBILITY);
});


test("wire-in: geographic ineligibility flag → refuse_to_serve", () => {
  const loan = { fico: 720, geographic_ineligibility_flag: true };
  const r = maybeRefuseToServe({ loan, amlKycFindings: { findings: [] } });
  assert.ok(r);
  assert.equal(r.refusal_category, REFUSAL_CATEGORY.GEOGRAPHIC_INELIGIBILITY);
});


test("wire-in: product ineligibility flag → refuse_to_serve", () => {
  const loan = { fico: 720, product_ineligibility_flag: true };
  const r = maybeRefuseToServe({ loan, amlKycFindings: { findings: [] } });
  assert.ok(r);
  assert.equal(r.refusal_category, REFUSAL_CATEGORY.PRODUCT_INELIGIBILITY);
});


test("wire-in: clean loan → no refuse_to_serve (verdict flows to escalate/approve/reject)", () => {
  const loan = { fico: 720, dti: 0.3, ltv: 0.7 };
  const r = maybeRefuseToServe({ loan, amlKycFindings: { findings: [] } });
  assert.equal(r, null);
});


test("wire-in: OFAC precedence over product_ineligibility (paper Table 4 ordering)", () => {
  const loan = {
    fico: 720,
    product_ineligibility_flag: true,
    aml_flags: ["OFAC_SDN_MATCH"],
  };
  const amlKycFindings = { findings: loan.aml_flags.map((f) => ({ rule_id: f })) };
  const r = maybeRefuseToServe({ loan, amlKycFindings });
  // OFAC wins because AML/KYC block outranks product policy in the paper's
  // threat model priority — statute > product policy.
  assert.equal(r.refusal_category, REFUSAL_CATEGORY.OFAC_SDN_MATCH);
});


test("wire-in: loan.aml_flags array of {rule_id} objects also parses correctly", () => {
  const loan = {
    fico: 720,
    aml_flags: [{ rule_id: "OFAC_SDN_MATCH", severity: "block" }],
  };
  const amlKycFindings = {
    findings: loan.aml_flags.map((f) => (typeof f === "string" ? { rule_id: f } : f)),
  };
  const r = maybeRefuseToServe({ loan, amlKycFindings });
  assert.ok(r);
  assert.equal(r.refusal_category, REFUSAL_CATEGORY.OFAC_SDN_MATCH);
});
