// v1.5.9 — AML/KYC adversarial hardening test suite.
//
// The audit agent flagged that the existing AML/KYC voice tests only cover
// single-flag cases. Real procurement threat models are combinatorial:
// what happens when OFAC + PEP + high-risk-country fire together? What if
// KYC is "not_verified" AND aml_flags has "sanctions_hit"? Does one BLOCK
// override any ESCALATE below it? Does the borrower-facing rationale leak
// specifics that would violate tipping-off (BSA 31 USC 5318(g)(2))?
//
// This suite adversarially covers:
//   - all 7 known AML flags fire independently (no cross-contamination)
//   - flag combinations (block wins over escalate wins over approve)
//   - kyc_status × aml_flags interaction (both dimensions considered)
//   - unknown flag → escalate fail-safe (never silent drop)
//   - AA06 emission binding (borrower gets a code iff verdict != approve)
//   - tipping-off compliance: rationale text must NOT name specific
//     flag types by name (would tip off a sanctioned party)
//   - confidence tiering: 0.95 block > 0.75 escalate > 0.60 approve

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeAmlKycVoice,
  shouldAttachAmlKycVoice,
  AML_FLAG_POLICY,
  KYC_STATUS_POLICY,
} from "../lib/aml-kyc-voice.js";

// ─── all 7 AML flags fire independently ─────────────────────────────

for (const [flag, policy] of Object.entries(AML_FLAG_POLICY)) {
  test(`AML flag "${flag}" alone → ${policy.tier} with correct citation`, () => {
    const voice = computeAmlKycVoice({ aml_flags: [flag] });
    assert.equal(voice.verdict, policy.tier);
    assert.ok(voice.rationale.includes(policy.citation),
      `rationale missing citation "${policy.citation}"`);
    assert.equal(voice.metrics.aml_flags.length, 1);
    assert.equal(voice.metrics.aml_flags[0], flag);
    if (policy.tier === "approve") {
      assert.equal(voice.adverse_action_codes.length, 0);
    } else {
      assert.equal(voice.adverse_action_codes.length, 1);
      assert.equal(voice.adverse_action_codes[0].code, "AA06");
    }
  });
}

// ─── all 4 KYC statuses fire independently ──────────────────────────

for (const [status, policy] of Object.entries(KYC_STATUS_POLICY)) {
  test(`kyc_status "${status}" alone → ${policy.tier}`, () => {
    const voice = computeAmlKycVoice({ kyc_status: status });
    assert.equal(voice.verdict, policy.tier);
    if (policy.tier !== "approve") {
      assert.equal(voice.adverse_action_codes[0].code, "AA06");
    }
  });
}

// ─── combinations: block wins over escalate ──────────────────────────

test("sanctions_hit + pep + high_risk_country → block (block wins)", () => {
  const voice = computeAmlKycVoice({
    aml_flags: ["sanctions_hit", "pep", "high_risk_country"],
  });
  assert.equal(voice.verdict, "block");
  assert.equal(voice.confidence, 0.95);
  // All 3 findings should still be captured for audit trail
  assert.equal(voice.metrics.findings.length, 3);
});

test("2 escalate flags → escalate (never approve on multiple escalates)", () => {
  const voice = computeAmlKycVoice({
    aml_flags: ["pep", "beneficial_ownership_opaque"],
  });
  assert.equal(voice.verdict, "escalate");
  assert.equal(voice.confidence, 0.75);
  assert.equal(voice.metrics.findings.length, 2);
});

test("2 block flags → block (never double-count)", () => {
  const voice = computeAmlKycVoice({
    aml_flags: ["sanctions_hit", "ofac_50_rule"],
  });
  assert.equal(voice.verdict, "block");
});

// ─── kyc_status × aml_flags interaction ─────────────────────────────

test("kyc_status: not_verified + sanctions_hit → both block, verdict block", () => {
  const voice = computeAmlKycVoice({
    aml_flags: ["sanctions_hit"],
    kyc_status: "not_verified",
  });
  assert.equal(voice.verdict, "block");
  // Both dimensions contribute to findings
  assert.equal(voice.metrics.findings.length, 2);
  const sources = voice.metrics.findings.map((f) => f.source);
  assert.ok(sources.includes("aml_flag"));
  assert.ok(sources.includes("kyc_status"));
});

test("kyc_status: current + pep → escalate (approve KYC doesn't downgrade AML)", () => {
  const voice = computeAmlKycVoice({
    aml_flags: ["pep"],
    kyc_status: "current",
  });
  // KYC being clean must NOT mask an AML escalate.
  assert.equal(voice.verdict, "escalate");
});

test("kyc_status: stale + no aml flags → escalate (KYC alone can escalate)", () => {
  const voice = computeAmlKycVoice({ kyc_status: "stale" });
  assert.equal(voice.verdict, "escalate");
  assert.equal(voice.confidence, 0.75);
});

test("kyc_status: not_verified alone → block (KYC alone can block)", () => {
  const voice = computeAmlKycVoice({ kyc_status: "not_verified" });
  assert.equal(voice.verdict, "block");
  assert.equal(voice.confidence, 0.95);
});

// ─── unknown flag fail-safe ─────────────────────────────────────────

test("unknown aml_flag → escalate + auditor-visible note (never silent drop)", () => {
  const voice = computeAmlKycVoice({
    aml_flags: ["a_flag_that_does_not_exist_yet"],
  });
  assert.equal(voice.verdict, "escalate");
  const finding = voice.metrics.findings[0];
  assert.equal(finding.tier, "escalate");
  assert.match(finding.rationale, /Unrecognized AML flag/);
  assert.match(finding.rationale, /aml-kyc-voice/);  // fix-it pointer
});

test("unknown kyc_status → escalate + auditor-visible note", () => {
  const voice = computeAmlKycVoice({ kyc_status: "some_new_status_value" });
  assert.equal(voice.verdict, "escalate");
  const finding = voice.metrics.findings[0];
  assert.match(finding.rationale, /Unrecognized kyc_status/);
});

test("unknown flag + known block flag → block (block still wins)", () => {
  const voice = computeAmlKycVoice({
    aml_flags: ["sanctions_hit", "totally_new_flag"],
  });
  assert.equal(voice.verdict, "block");
});

// ─── tipping-off compliance ─────────────────────────────────────────

test("TIPPING-OFF: block-tier rationale does NOT literally name the flag", () => {
  // BSA 31 USC 5318(g)(2) prohibits telling the customer that a SAR was
  // filed or that specific AML monitoring occurred. The borrower-facing
  // AA06 dictionary text is deliberately general. The rationale we return
  // is auditor-facing but even it should not spell "sanctions_hit" as
  // a literal string a naive UI could accidentally render.
  const voice = computeAmlKycVoice({ aml_flags: ["sanctions_hit"] });
  // Rationale must NOT contain the raw flag key (which is programmer jargon).
  assert.equal(voice.rationale.includes("sanctions_hit"), false,
    "rationale must not include raw flag key sanctions_hit — tipping-off vector");
});

test("TIPPING-OFF: borrower-facing AA06 code stays generic", () => {
  const voice = computeAmlKycVoice({ aml_flags: ["sanctions_hit"] });
  assert.equal(voice.adverse_action_codes[0].code, "AA06");
  // The label must be the neutral procurement text — the dictionary owns
  // the borrower-safe rendering. Bank counsel signs THAT copy.
  assert.match(voice.adverse_action_codes[0].label,
    /AML\/KYC-related eligibility concern requiring compliance review/);
  // Sanity: label must NOT contain "OFAC" or "SDN" or "sanctioned" (would
  // tip off the sanctioned party that they matched a specific list).
  assert.equal(voice.adverse_action_codes[0].label.match(/OFAC|SDN|sanctioned/i), null,
    "AA06 label must be generic — tipping-off vector if it names OFAC/SDN");
});

// ─── confidence tiering ─────────────────────────────────────────────

test("confidence: block-tier is 0.95 (deterministic regulatory rule)", () => {
  assert.equal(computeAmlKycVoice({ aml_flags: ["sanctions_hit"] }).confidence, 0.95);
});

test("confidence: escalate-tier is 0.75 (rule matched, requires human)", () => {
  assert.equal(computeAmlKycVoice({ aml_flags: ["pep"] }).confidence, 0.75);
});

test("confidence: approve-only is 0.60 (weakest evidence — no rule matched)", () => {
  const voice = computeAmlKycVoice({ kyc_status: "current" });
  assert.equal(voice.verdict, "approve");
  assert.equal(voice.confidence, 0.60);
});

// ─── shouldAttach guardrails ───────────────────────────────────────

test("shouldAttach: no aml/kyc fields → false (5-voice back-compat)", () => {
  assert.equal(shouldAttachAmlKycVoice({}), false);
  assert.equal(shouldAttachAmlKycVoice({ credit_score: 720 }), false);
});

test("shouldAttach: empty aml_flags array → false (not real signal)", () => {
  assert.equal(shouldAttachAmlKycVoice({ aml_flags: [] }), false);
});

test("shouldAttach: any aml_flag → true", () => {
  assert.equal(shouldAttachAmlKycVoice({ aml_flags: ["pep"] }), true);
});

test("shouldAttach: kyc_status alone → true", () => {
  assert.equal(shouldAttachAmlKycVoice({ kyc_status: "stale" }), true);
});

// ─── policy tables frozen ───────────────────────────────────────────

test("AML_FLAG_POLICY is frozen (defensive against runtime privilege creep)", () => {
  assert.equal(Object.isFrozen(AML_FLAG_POLICY), true);
});

test("KYC_STATUS_POLICY is frozen", () => {
  assert.equal(Object.isFrozen(KYC_STATUS_POLICY), true);
});
