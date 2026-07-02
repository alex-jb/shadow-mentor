// test/aml-kyc-voice.test.js
// ──────────────────────────────────────────────────────────────────
// Pins the AML/KYC Investigator voice contract shipped 2026-07-02.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  shouldAttachAmlKycVoice,
  computeAmlKycVoice,
  AML_FLAG_POLICY,
  KYC_STATUS_POLICY,
} from "../lib/aml-kyc-voice.js";

import { runLoanCouncil } from "../lib/run-loan-council.js";


// ═══════════════════════════════════════════════════════════════
// shouldAttachAmlKycVoice — the back-compat gate
// ═══════════════════════════════════════════════════════════════

test("no AML/KYC fields → do NOT attach voice (5-voice back-compat)", () => {
  assert.equal(shouldAttachAmlKycVoice({ credit_score: 720 }), false);
});


test("empty aml_flags array → do NOT attach voice", () => {
  assert.equal(shouldAttachAmlKycVoice({ aml_flags: [] }), false);
});


test("non-empty aml_flags → attach", () => {
  assert.equal(
    shouldAttachAmlKycVoice({ aml_flags: ["structuring"] }),
    true,
  );
});


test("kyc_status present → attach", () => {
  assert.equal(
    shouldAttachAmlKycVoice({ kyc_status: "current" }),
    true,
  );
});


test("null loan → do NOT attach", () => {
  assert.equal(shouldAttachAmlKycVoice(null), false);
});


// ═══════════════════════════════════════════════════════════════
// computeAmlKycVoice — verdict + citation matrix
// ═══════════════════════════════════════════════════════════════

test("sanctions_hit → block + OFAC citation + AA06", () => {
  const voice = computeAmlKycVoice({ aml_flags: ["sanctions_hit"] });
  assert.equal(voice.verdict, "block");
  assert.equal(voice.voice, "AML/KYC Investigator");
  assert.ok(voice.confidence >= 0.9);  // very high — regulatory
  assert.match(voice.rationale, /OFAC/);
  assert.equal(voice.adverse_action_codes.length, 1);
  assert.equal(voice.adverse_action_codes[0].code, "AA06");
});


test("structuring → escalate + BSA citation", () => {
  const voice = computeAmlKycVoice({ aml_flags: ["structuring"] });
  assert.equal(voice.verdict, "escalate");
  assert.match(voice.rationale, /BSA/);
  assert.equal(voice.adverse_action_codes[0].code, "AA06");
});


test("pep → escalate + FinCEN CDD citation", () => {
  const voice = computeAmlKycVoice({ aml_flags: ["pep"] });
  assert.equal(voice.verdict, "escalate");
  assert.match(voice.rationale, /FinCEN|CDD/);
});


test("kyc_status=not_verified → block + PATRIOT §326 citation", () => {
  const voice = computeAmlKycVoice({ kyc_status: "not_verified" });
  assert.equal(voice.verdict, "block");
  assert.match(voice.rationale, /PATRIOT|CIP/);
});


test("kyc_status=stale → escalate", () => {
  const voice = computeAmlKycVoice({ kyc_status: "stale" });
  assert.equal(voice.verdict, "escalate");
});


test("kyc_status=current + no aml_flags → approve", () => {
  const voice = computeAmlKycVoice({
    aml_flags: [], kyc_status: "current",
  });
  assert.equal(voice.verdict, "approve");
  assert.equal(voice.adverse_action_codes.length, 0);
});


test("block-tier + escalate-tier flags together → block wins", () => {
  const voice = computeAmlKycVoice({
    aml_flags: ["structuring", "sanctions_hit", "pep"],
  });
  assert.equal(voice.verdict, "block");
});


test("multiple escalate-tier flags → escalate", () => {
  const voice = computeAmlKycVoice({
    aml_flags: ["structuring", "pep", "high_risk_country"],
  });
  assert.equal(voice.verdict, "escalate");
  // Rationale should cite multiple regulatory bases
  assert.match(voice.rationale, /BSA/);
  assert.match(voice.rationale, /FinCEN/);
});


test("unknown AML flag → escalate + fail-safe rationale", () => {
  const voice = computeAmlKycVoice({
    aml_flags: ["some_novel_flag_type"],
  });
  assert.equal(voice.verdict, "escalate");
  assert.match(voice.rationale, /Unknown/);
  assert.equal(voice.metrics.findings[0].tier, "escalate");
});


test("unknown kyc_status → escalate + fail-safe rationale", () => {
  const voice = computeAmlKycVoice({ kyc_status: "some_novel_status" });
  assert.equal(voice.verdict, "escalate");
  assert.match(voice.rationale, /Unknown/);
});


test("metrics preserve findings for audit", () => {
  const voice = computeAmlKycVoice({
    aml_flags: ["structuring", "pep"],
    kyc_status: "stale",
  });
  assert.equal(voice.metrics.findings.length, 3);
  assert.ok(voice.metrics.findings.some((f) => f.flag === "structuring"));
  assert.ok(voice.metrics.findings.some((f) => f.flag === "pep"));
  assert.ok(voice.metrics.findings.some((f) => f.flag === "stale"));
});


test("policy tables are frozen (checked-in policy, not runtime-mutable)", () => {
  assert.throws(() => { AML_FLAG_POLICY.sanctions_hit = { tier: "approve" }; });
  assert.throws(() => { KYC_STATUS_POLICY.current = { tier: "block" }; });
});


// ═══════════════════════════════════════════════════════════════
// Integration with runLoanCouncil — 5-voice back-compat + 6-voice opt-in
// ═══════════════════════════════════════════════════════════════

const BASE_LOAN = {
  loan_id: "TEST-AML-001",
  credit_score: 740,
  debt_to_income: 0.30,
  loan_to_value: 0.75,
  amount: 250000,
};


test("runLoanCouncil: no AML fields → still 5 voices (back-compat)", () => {
  const r = runLoanCouncil(BASE_LOAN);
  assert.equal(r.voices.length, 5);
});


test("runLoanCouncil: with aml_flags → 6 voices, AML voice appended", () => {
  const r = runLoanCouncil({ ...BASE_LOAN, aml_flags: ["structuring"] });
  assert.equal(r.voices.length, 6);
  assert.equal(r.voices[5].voice, "AML/KYC Investigator");
  assert.equal(r.voices[5].verdict, "escalate");
});


test("runLoanCouncil: with kyc_status → 6 voices", () => {
  const r = runLoanCouncil({ ...BASE_LOAN, kyc_status: "current" });
  assert.equal(r.voices.length, 6);
  assert.equal(r.voices[5].voice, "AML/KYC Investigator");
});


test("runLoanCouncil: sanctions_hit propagates to final_verdict = block", () => {
  const r = runLoanCouncil({ ...BASE_LOAN, aml_flags: ["sanctions_hit"] });
  assert.equal(r.final_verdict, "block");
  assert.equal(r.confidence_weighted_verdict, "block");
});


test("runLoanCouncil: AA06 flows into adverse_action_codes", () => {
  const r = runLoanCouncil({ ...BASE_LOAN, aml_flags: ["structuring"] });
  const aa06 = r.adverse_action_codes.find((c) => c.code === "AA06");
  assert.ok(aa06);
});


test("runLoanCouncil: AA06 passes reason-code dictionary check", () => {
  const r = runLoanCouncil({ ...BASE_LOAN, aml_flags: ["structuring"] });
  // The dictionary was updated in the same ship to include AA06
  assert.equal(r.reason_code_dictionary_check.ok, true);
});


test("runLoanCouncil: 6-voice presentation_order is a valid permutation", () => {
  const r = runLoanCouncil({ ...BASE_LOAN, aml_flags: ["structuring"] });
  assert.equal(r.presentation_order.length, 6);
  assert.deepEqual(
    [...r.presentation_order].sort((a, b) => a - b),
    [0, 1, 2, 3, 4, 5],
  );
});
