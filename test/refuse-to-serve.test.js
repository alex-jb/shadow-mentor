// test/refuse-to-serve.test.js
// v1.5.35 contract tests for the refuse_to_serve response category.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  REFUSAL_CATEGORY,
  REFUSAL_CITATIONS,
  REFUSAL_BORROWER_NOTICE,
  buildRefuseToServeResponse,
  assessRefusalCategory,
  maybeRefuseToServe,
} from "../lib/refuse-to-serve.js";


test("REFUSAL_CATEGORY has 5 categories from arXiv:2606.29142 Table 4", () => {
  const values = Object.values(REFUSAL_CATEGORY);
  assert.equal(values.length, 5);
  assert.ok(values.includes("ofac_sdn_match"));
  assert.ok(values.includes("bsa_tipping_off"));
  assert.ok(values.includes("statutory_ineligibility"));
  assert.ok(values.includes("geographic_ineligibility"));
  assert.ok(values.includes("product_ineligibility"));
});


test("REFUSAL_CITATIONS covers every category with 2+ citations", () => {
  for (const cat of Object.values(REFUSAL_CATEGORY)) {
    assert.ok(Array.isArray(REFUSAL_CITATIONS[cat]),
      `citations for ${cat} must be array`);
    assert.ok(REFUSAL_CITATIONS[cat].length >= 2,
      `${cat} must have 2+ citations`);
  }
});


test("REFUSAL_BORROWER_NOTICE contains no rich rationale (no §5318 tipping)", () => {
  // Notice text must NOT include OFAC / SDN / SAR / BSA / tipping wording.
  // Rich rationale in a borrower-facing notice = §5318(g)(2) violation
  // for the AML categories.
  for (const cat of [REFUSAL_CATEGORY.OFAC_SDN_MATCH, REFUSAL_CATEGORY.BSA_TIPPING_OFF]) {
    const notice = REFUSAL_BORROWER_NOTICE[cat].toLowerCase();
    assert.ok(!notice.includes("ofac"), `${cat} notice must not name OFAC`);
    assert.ok(!notice.includes("sdn"), `${cat} notice must not name SDN`);
    assert.ok(!notice.includes("sar"), `${cat} notice must not name SAR`);
    assert.ok(!notice.includes("sanction"), `${cat} notice must not name sanction`);
    assert.ok(!notice.includes("tipping"), `${cat} notice must not name tipping`);
  }
});


test("buildRefuseToServeResponse: throws on unknown category", () => {
  assert.throws(() => buildRefuseToServeResponse({
    refusalCategory: "not-a-real-category",
  }), /unknown refusalCategory/);
});


test("buildRefuseToServeResponse: OFAC → structured verdict + no discretion", () => {
  const r = buildRefuseToServeResponse({
    refusalCategory: REFUSAL_CATEGORY.OFAC_SDN_MATCH,
    internalAuditNote: "SDN list match at profile ingestion.",
    evidenceRef: { attestation_hash: "abc" },
  });
  assert.equal(r.verdict, "refuse_to_serve");
  assert.equal(r.refusal_category, "ofac_sdn_match");
  assert.equal(r.escalation_valid, false);
  assert.equal(r.anchor, "arXiv:2606.29142");
  assert.ok(r.citations.some((c) => c.includes("OFAC")));
  assert.ok(r.borrower_facing_notice.length > 0);
  assert.equal(r.internal_audit_note, "SDN list match at profile ingestion.");
  assert.deepEqual(r.evidence_ref, { attestation_hash: "abc" });
});


test("buildRefuseToServeResponse: escalation_valid=false for every category", () => {
  // Critical invariant: NO refuse_to_serve category allows escalation.
  // If any allowed escalation it would either be tipping off (illegal)
  // or wasted compliance officer time (institutional cost).
  for (const cat of Object.values(REFUSAL_CATEGORY)) {
    const r = buildRefuseToServeResponse({ refusalCategory: cat });
    assert.equal(r.escalation_valid, false,
      `${cat} must NOT allow escalation`);
  }
});


test("assessRefusalCategory: OFAC finding → OFAC_SDN_MATCH", () => {
  const cat = assessRefusalCategory({
    loan: { fico: 720 },
    amlKycFindings: {
      findings: [{ rule_id: "OFAC_SDN_LIST_MATCH", severity: "block" }],
    },
  });
  assert.equal(cat, REFUSAL_CATEGORY.OFAC_SDN_MATCH);
});


test("assessRefusalCategory: BSA tipping-off finding → BSA_TIPPING_OFF", () => {
  const cat = assessRefusalCategory({
    loan: { fico: 720 },
    amlKycFindings: {
      findings: [{ rule_id: "BSA_5318_TIPPING_OFF", severity: "block" }],
    },
  });
  assert.equal(cat, REFUSAL_CATEGORY.BSA_TIPPING_OFF);
});


test("assessRefusalCategory: product_ineligibility_flag → PRODUCT_INELIGIBILITY", () => {
  const cat = assessRefusalCategory({
    loan: { fico: 720, product_ineligibility_flag: true },
  });
  assert.equal(cat, REFUSAL_CATEGORY.PRODUCT_INELIGIBILITY);
});


test("assessRefusalCategory: standard applicant → null (no refusal)", () => {
  const cat = assessRefusalCategory({
    loan: { fico: 720, dti: 0.3, ltv: 0.7 },
    amlKycFindings: { findings: [] },
  });
  assert.equal(cat, null);
});


test("assessRefusalCategory: OFAC takes precedence over other findings", () => {
  const cat = assessRefusalCategory({
    loan: { fico: 500, product_ineligibility_flag: true },
    amlKycFindings: {
      findings: [
        { rule_id: "OFAC_SDN_MATCH", severity: "block" },
        { rule_id: "SOMETHING_ELSE", severity: "warn" },
      ],
    },
  });
  assert.equal(cat, REFUSAL_CATEGORY.OFAC_SDN_MATCH);
});


test("maybeRefuseToServe: returns null when no refusal warranted", () => {
  const r = maybeRefuseToServe({
    loan: { fico: 720, dti: 0.3 },
    amlKycFindings: { findings: [] },
  });
  assert.equal(r, null);
});


test("maybeRefuseToServe: returns full structured response for OFAC", () => {
  const r = maybeRefuseToServe({
    loan: { fico: 720 },
    amlKycFindings: {
      findings: [{ rule_id: "OFAC_SDN_LIST_MATCH" }],
    },
    evidenceRef: { attestation_hash: "xyz" },
  });
  assert.equal(r.verdict, "refuse_to_serve");
  assert.equal(r.refusal_category, REFUSAL_CATEGORY.OFAC_SDN_MATCH);
  assert.equal(r.escalation_valid, false);
  assert.ok(r.internal_audit_note.includes("Non-discretionary"));
  assert.ok(r.internal_audit_note.includes("arXiv:2606.29142"));
  assert.deepEqual(r.evidence_ref, { attestation_hash: "xyz" });
});


test("REGRESSION: notice text is same length for OFAC vs BSA (no length side-channel)", () => {
  // A subtle side-channel: if OFAC notice is longer than BSA notice,
  // a savvy borrower who receives multiple notices can infer which
  // category they hit. Both notices are identical text length to
  // remove that side channel.
  assert.equal(
    REFUSAL_BORROWER_NOTICE[REFUSAL_CATEGORY.OFAC_SDN_MATCH],
    REFUSAL_BORROWER_NOTICE[REFUSAL_CATEGORY.BSA_TIPPING_OFF],
    "OFAC + BSA notice text must be byte-identical (no side channel)",
  );
});
