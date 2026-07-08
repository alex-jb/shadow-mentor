// lib/refuse-to-serve.js
// ──────────────────────────────────────────────────────────────────
// v1.5.35 (2026-07-08). Explicit "refuse_to_serve" response category
// per arXiv:2606.29142 (Mohan/Srinivasa, 2026-06-28) — Agent Security
// Meets Regulatory Reality: Systematization of Autonomous-Agent
// Threats in Regulated Financial Systems.
//
// The paper's contribution is documenting that automated systems in
// regulated finance MUST distinguish two adverse response classes:
//
//   escalate → human review can proceed. Compliance officer discretion
//              exists. Applicant gets AA-notice with specific reasons.
//              Example: FICO below floor, DTI over ceiling, applicant
//              didn't provide required documentation.
//
//   refuse_to_serve → no discretion. Statute or sanctions BAR service.
//                     Compliance officer cannot override without
//                     violating law. Applicant gets a legally-required
//                     notice with citation but NO substantive rationale.
//                     Example: OFAC SDN match, BSA §5318(g)(2) tipping-
//                     off restriction, applicant seeking product they
//                     are statutorily ineligible for.
//
// Prior to v1.5.35 Shadow returned `escalate` for both classes. That
// is factually wrong for the refuse_to_serve class because it implies
// human review will occur when in fact human review CANNOT resolve
// the block. It also creates a §5318(g)(2) tipping-off risk when the
// borrower-facing notice cites the wrong basis.
//
// This module ships:
//   - REFUSAL_CATEGORY enum with 5 categories from the paper
//   - assessRefusalCategory(loan, amlKycFindings, policyContext) → category|null
//   - buildRefuseToServeResponse(category, ...) → structured response
//
// The runtime does NOT auto-invoke. Callers wire this in at the
// output boundary of runLoanCouncil() when they want the distinction
// surfaced explicitly. Shadow keeps runLoanCouncil() unchanged for
// back-compat; wiring into `/api/deliberate` deferred to v1.5.36.

/**
 * The 5 refusal categories from arXiv:2606.29142 Table 4, translated
 * to Shadow's banking-lending context. Each category has a specific
 * regulatory citation set. Compliance officer CANNOT override any of
 * these without violating law — that is what distinguishes them from
 * `escalate` (where human discretion exists).
 */
export const REFUSAL_CATEGORY = Object.freeze({
  OFAC_SDN_MATCH: "ofac_sdn_match",
  BSA_TIPPING_OFF: "bsa_tipping_off",
  STATUTORY_INELIGIBILITY: "statutory_ineligibility",
  GEOGRAPHIC_INELIGIBILITY: "geographic_ineligibility",
  PRODUCT_INELIGIBILITY: "product_ineligibility",
});


/**
 * Citation set per refusal category. Bank counsel pins the citation
 * chain in procurement contracts so no ambiguity about which statute
 * makes the refusal non-discretionary.
 */
export const REFUSAL_CITATIONS = Object.freeze({
  [REFUSAL_CATEGORY.OFAC_SDN_MATCH]: [
    "31 CFR 501.603 (OFAC SDN)",
    "50% rule (OFAC guidance)",
    "Executive Order 13224 (or applicable EO)",
  ],
  [REFUSAL_CATEGORY.BSA_TIPPING_OFF]: [
    "31 USC 5318(g)(2) (BSA tipping-off prohibition)",
    "31 CFR 1020.320(e) (SAR confidentiality)",
    "FinCEN SAR Instructions",
  ],
  [REFUSAL_CATEGORY.STATUTORY_INELIGIBILITY]: [
    "Applicable federal or state statute",
    "12 CFR 1002.7 (Reg B rules concerning extensions of credit)",
  ],
  [REFUSAL_CATEGORY.GEOGRAPHIC_INELIGIBILITY]: [
    "State licensing law (institution not chartered)",
    "12 USC 30 (national bank charter geography)",
  ],
  [REFUSAL_CATEGORY.PRODUCT_INELIGIBILITY]: [
    "Applicable product-specific statute",
    "Institution product policy under BRD",
  ],
});


/**
 * Borrower-facing notice template per category. Deliberately minimal
 * — refusal is non-discretionary so a rich rationale would either
 * be false (implying discretion exists) or a §5318(g)(2) violation
 * (tipping off in the OFAC/BSA cases). §1002.9(b)(1) allows a general
 * statement when specific reasons are prohibited by other law.
 */
export const REFUSAL_BORROWER_NOTICE = Object.freeze({
  [REFUSAL_CATEGORY.OFAC_SDN_MATCH]:
    "We cannot proceed with your application at this time. Please " +
    "contact our compliance department at [BANK-COMPLIANCE-PHONE] " +
    "for further information. This notice is provided in accordance " +
    "with the Equal Credit Opportunity Act and applicable federal law.",
  [REFUSAL_CATEGORY.BSA_TIPPING_OFF]:
    "We cannot proceed with your application at this time. Please " +
    "contact our compliance department at [BANK-COMPLIANCE-PHONE] " +
    "for further information. This notice is provided in accordance " +
    "with the Equal Credit Opportunity Act and applicable federal law.",
  [REFUSAL_CATEGORY.STATUTORY_INELIGIBILITY]:
    "We are unable to extend credit for the requested product to " +
    "applicants in your circumstances. Please contact us at " +
    "[BANK-CONSUMER-LINE] if you believe this determination is in " +
    "error. This notice is provided in accordance with the Equal " +
    "Credit Opportunity Act.",
  [REFUSAL_CATEGORY.GEOGRAPHIC_INELIGIBILITY]:
    "Our institution is not licensed to offer this product in your " +
    "state or jurisdiction. Please contact us at [BANK-CONSUMER-LINE] " +
    "to discuss alternatives. This notice is provided in accordance " +
    "with the Equal Credit Opportunity Act.",
  [REFUSAL_CATEGORY.PRODUCT_INELIGIBILITY]:
    "The product you requested is not offered under the terms you " +
    "described. Please contact us at [BANK-CONSUMER-LINE] to discuss " +
    "products that may fit your circumstances. This notice is " +
    "provided in accordance with the Equal Credit Opportunity Act.",
});


/**
 * Structured refuse_to_serve response. Callers use this shape at the
 * output boundary of runLoanCouncil() when the loan hit a
 * non-discretionary bar. Fields are minimal by design — the borrower-
 * facing notice CANNOT include rich reasoning without either implying
 * discretion (false) or tipping off (illegal in OFAC/BSA cases).
 *
 * The internal_audit_note IS rich because the auditor sees it, not
 * the borrower. Bank counsel + regulator pin the internal note in
 * exam workpaper; borrower gets only the generic notice.
 *
 * @param {object} params
 * @param {string} params.refusalCategory — enum value
 * @param {string} [params.internalAuditNote] — audit-only rationale
 * @param {object} [params.evidenceRef] — pointer to hash-chain evidence
 * @returns {object} structured response
 */
export function buildRefuseToServeResponse({
  refusalCategory,
  internalAuditNote = null,
  evidenceRef = null,
} = {}) {
  if (!Object.values(REFUSAL_CATEGORY).includes(refusalCategory)) {
    throw new Error(
      `buildRefuseToServeResponse: unknown refusalCategory "${refusalCategory}". ` +
      `Must be one of: ${Object.values(REFUSAL_CATEGORY).join(", ")}`,
    );
  }
  return {
    verdict: "refuse_to_serve",
    refusal_category: refusalCategory,
    borrower_facing_notice: REFUSAL_BORROWER_NOTICE[refusalCategory],
    internal_audit_note: internalAuditNote,
    citations: [...REFUSAL_CITATIONS[refusalCategory]],
    anchor: "arXiv:2606.29142",
    evidence_ref: evidenceRef,
    // Distinguishes refuse_to_serve from escalate. Human review
    // CANNOT resolve a refuse_to_serve decision because the block is
    // statutory. Escalating anyway violates §5318(g)(2) in tipping-off
    // cases and wastes compliance officer time in the others.
    escalation_valid: false,
  };
}


/**
 * Assess whether the current loan + AML/KYC findings warrant a
 * refuse_to_serve response rather than escalate. Returns the category
 * enum value when refusal is warranted, or null when standard
 * escalate/approve/reject flow should proceed.
 *
 * @param {object} params
 * @param {object} params.loan — from lib/schemas/loan.js
 * @param {object} [params.amlKycFindings] — output of aml-kyc-voice.js
 * @returns {string|null} REFUSAL_CATEGORY value or null
 */
export function assessRefusalCategory({ loan, amlKycFindings } = {}) {
  if (amlKycFindings && Array.isArray(amlKycFindings.findings)) {
    for (const f of amlKycFindings.findings) {
      const rule = String(f.rule_id || f.rule || "").toLowerCase();
      if (rule.includes("ofac") || rule.includes("sdn")) {
        return REFUSAL_CATEGORY.OFAC_SDN_MATCH;
      }
      // BSA §5318(g)(2) tipping-off: any finding whose rule cites SAR
      // or tipping-off. The refusal category prevents the borrower-
      // facing notice from citing this basis.
      if (rule.includes("tipping") || rule.includes("sar") ||
          rule.includes("5318")) {
        return REFUSAL_CATEGORY.BSA_TIPPING_OFF;
      }
    }
  }

  // Product ineligibility — hard product policy no rewrite of pricing
  // can resolve. E.g. applying for a product the institution does not
  // offer, or for a product with statutory-eligibility gates.
  if (loan && loan.product_ineligibility_flag === true) {
    return REFUSAL_CATEGORY.PRODUCT_INELIGIBILITY;
  }

  // Geographic ineligibility — institution not chartered in
  // applicant's state.
  if (loan && loan.geographic_ineligibility_flag === true) {
    return REFUSAL_CATEGORY.GEOGRAPHIC_INELIGIBILITY;
  }

  // Statutory ineligibility — applicant does not meet any statutory
  // gate (e.g. Reg B minimum-age flag).
  if (loan && loan.statutory_ineligibility_flag === true) {
    return REFUSAL_CATEGORY.STATUTORY_INELIGIBILITY;
  }

  return null;
}


/**
 * Convenience: assess + build in one call. Returns null when no
 * refusal warranted (caller should proceed with standard flow).
 *
 * @param {object} params
 * @returns {object|null} refuse_to_serve response or null
 */
export function maybeRefuseToServe({ loan, amlKycFindings, evidenceRef } = {}) {
  const category = assessRefusalCategory({ loan, amlKycFindings });
  if (!category) return null;
  return buildRefuseToServeResponse({
    refusalCategory: category,
    internalAuditNote:
      `Non-discretionary refusal per ${REFUSAL_CITATIONS[category].join(" + ")}. ` +
      `Bank counsel cannot override without violating cited law. ` +
      `Category: ${category}. See arXiv:2606.29142 for systematization.`,
    evidenceRef,
  });
}
