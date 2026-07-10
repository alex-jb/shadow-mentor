// test/run-loan-council-gated.test.js
// v1.5.43 contract tests for runLoanCouncilGated wrapper.
// Directly closes SIVE Baseline Finding #2 at library level.

import { test } from "node:test";
import assert from "node:assert/strict";

import { runLoanCouncilGated } from "../lib/run-loan-council-gated.js";
import { runLoanCouncil } from "../lib/run-loan-council.js";
import { getSiveLoan, SIVE_FIXTURES } from "../lib/sive-fixtures.js";
import { REFUSAL_CATEGORY } from "../lib/refuse-to-serve.js";


test("runLoanCouncilGated: throws when loan missing", () => {
  assert.throws(() => runLoanCouncilGated({}), TypeError);
  assert.throws(() => runLoanCouncilGated({ loan: null }), TypeError);
});


test("SIVE FINDING #2 FIX: ofac fixture through gated wrapper returns refuse_to_serve", () => {
  // This is the whole point of v1.5.43 — pre-v1.5.43, SIVE OFAC
  // fixture returned "escalate" via runLoanCouncil. Now the gated
  // wrapper returns "refuse_to_serve" and marks the reason category.
  const loan = getSiveLoan("ofac_refuse_to_serve");
  const result = runLoanCouncilGated({ loan });
  assert.equal(result.final_verdict, "refuse_to_serve",
    `Expected refuse_to_serve, got ${result.final_verdict}`);
  assert.equal(result.gate, "refuse_to_serve_gate");
  assert.equal(result.gate_reason, REFUSAL_CATEGORY.OFAC_SDN_MATCH);
});


test("gated OFAC response carries refusal envelope", () => {
  const loan = getSiveLoan("ofac_refuse_to_serve");
  const result = runLoanCouncilGated({ loan });
  assert.ok(result.refuse_to_serve, "refuse_to_serve envelope missing");
  assert.equal(result.refuse_to_serve.refusal_category, REFUSAL_CATEGORY.OFAC_SDN_MATCH);
  assert.ok(result.refuse_to_serve.borrower_facing_notice,
    "borrower_facing_notice missing from refusal envelope");
  assert.ok(Array.isArray(result.refuse_to_serve.citations));
});


test("gated OFAC skips personas (voices array empty)", () => {
  // Refusal gate short-circuits BEFORE persona deliberation. This
  // matters for cost: LLM-backed variants of runLoanCouncil would
  // otherwise spend on 5 voices only to be discarded.
  const loan = getSiveLoan("ofac_refuse_to_serve");
  const result = runLoanCouncilGated({ loan });
  assert.equal(result.voices.length, 0);
  assert.equal(result.adverse_action_codes.length, 0);
});


test("gated wrapper is pass-through for non-OFAC loans", () => {
  // obvious_approve has no aml_flags, no ineligibility flags —
  // gated wrapper must delegate to runLoanCouncil verbatim.
  const loan = getSiveLoan("obvious_approve");
  const gated = runLoanCouncilGated({ loan });
  const raw = runLoanCouncil(loan);
  assert.equal(gated.final_verdict, raw.final_verdict);
  assert.equal(gated.gate, "pass_through");
});


test("gated wrapper preserves obvious_deny block verdict", () => {
  const loan = getSiveLoan("obvious_deny");
  const result = runLoanCouncilGated({ loan });
  assert.equal(result.final_verdict, "block");
  assert.equal(result.gate, "pass_through");
});


test("gated wrapper preserves borderline_escalate verdict", () => {
  const loan = getSiveLoan("borderline_escalate");
  const result = runLoanCouncilGated({ loan });
  assert.equal(result.final_verdict, "escalate");
  assert.equal(result.gate, "pass_through");
});


test("explicit BSA tipping-off finding routes to refuse_to_serve", () => {
  const loan = getSiveLoan("obvious_approve");
  const amlKycFindings = {
    findings: [{ rule_id: "BSA_5318_TIPPING_OFF" }],
  };
  const result = runLoanCouncilGated({ loan, amlKycFindings });
  assert.equal(result.final_verdict, "refuse_to_serve");
  assert.equal(result.gate_reason, REFUSAL_CATEGORY.BSA_TIPPING_OFF);
});


test("explicit statutory_ineligibility flag routes to refuse_to_serve", () => {
  const loan = { ...getSiveLoan("obvious_approve"), statutory_ineligibility_flag: true };
  const result = runLoanCouncilGated({ loan });
  assert.equal(result.final_verdict, "refuse_to_serve");
  assert.equal(result.gate_reason, REFUSAL_CATEGORY.STATUTORY_INELIGIBILITY);
});


test("SIVE fixtures with refuse_to_serve ideal_verdict are satisfied by gated wrapper", () => {
  // Regression net for refusal-gate correctness. Only fixtures whose
  // ideal_verdict is refuse_to_serve are checked here; other ideal_verdicts
  // (e.g. obvious_approve → approve for Finding #1) are v1.5.44 work.
  const refusalFixtures = SIVE_FIXTURES.filter(
    (f) => f.ideal_verdict === "refuse_to_serve"
  );
  assert.ok(refusalFixtures.length >= 1,
    "at least one refuse_to_serve fixture expected");
  for (const fixture of refusalFixtures) {
    const result = runLoanCouncilGated({ loan: fixture.loan });
    assert.equal(result.final_verdict, "refuse_to_serve",
      `${fixture.name}: expected refuse_to_serve, got ${result.final_verdict}`);
  }
});
