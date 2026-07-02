// lib/aml-kyc-voice.js
// ──────────────────────────────────────────────────────────────────
// Optional 6th council voice: AML/KYC Investigator.
//
// Ships 2026-07-02 based on the 2026-07-02 3-agent research pass —
// ACAMS Assembly Hollywood (Apr 20-22, 2026) signals AML/KYC is the
// fastest procurement lane at mid-tier banks, ahead of consumer-
// credit decisioning. Comply ComplyAI MCP Server (GA May 2026)
// targets FA/broker-dealer trade pre-clearance + AML — Shadow's
// insertion point is "we're the OSS council that governs Anthropic's
// KYC agent" (10 finance agents launched to LPL May 2026-05-06).
//
// Design: OPT-IN
// --------------
// The AML/KYC voice is added to the council ONLY if the loan carries
// AML/KYC-relevant fields:
//   - loan.aml_flags: string[] (e.g. ["structuring", "sanctions_hit",
//     "pep", "high_risk_country", "beneficial_ownership_opaque"])
//   - loan.kyc_status: "current" | "stale" | "incomplete" | "not_verified"
//
// If neither field is present the council stays 5-voice (100%
// back-compat with existing consumers keyed on voices.length === 5).
//
// Regulatory anchor
// -----------------
// - Bank Secrecy Act (31 USC 5311+) — SAR/CTR reporting obligations
// - FinCEN Customer Due Diligence rule (31 CFR 1010.230) — beneficial
//   ownership + risk-based CDD program
// - OFAC 50% rule (sanctions ownership aggregation)
// - USA PATRIOT Act §326 — CIP (customer identification program)
// - FinCEN 2026-Q1 GTOs (Geographic Targeting Orders) — extend to
//   selected metro areas for high-value cash real estate deals
//
// AA code
// -------
// AA06 = "AML/KYC-related eligibility concern requiring compliance
// review." Added to lib/schemas/reason-code-dictionary.json in the
// same ship. Under CFPB Bulletin 2024-09 model-traceability, AML
// denials must cite the specific rule (BSA, OFAC, CDD) — NOT just
// "AML concern" — so the rationale field carries that specific
// citation.
//
// Ref
// ---
// - ACAMS Assembly Hollywood 2026 program guide
// - FinCEN CDD final rule (31 CFR 1010.230)
// - USA PATRIOT Act §326 CIP
// - Comply ComplyAI MCP Server launch (April 2026)
// - Anthropic finance-agents launch 2026-05-06 (RIABiz)

// AML flag → verdict + rationale + AA code binding.
// Each row is a checked-in policy decision, not an LLM opinion.
// The classifier is deterministic: any BLOCK-tier flag → block,
// any ESCALATE-tier flag → escalate, else approve.
const AML_FLAG_POLICY = Object.freeze({
  sanctions_hit: {
    tier: "block",
    citation: "OFAC SDN list match",
    rationale: "Applicant matches an OFAC-published sanctioned party " +
      "(SDN or 50%-rule aggregate ownership); origination is prohibited.",
  },
  ofac_50_rule: {
    tier: "block",
    citation: "OFAC 50% rule (ownership aggregation)",
    rationale: "Beneficial-ownership aggregation exceeds 50% held by " +
      "sanctioned parties per OFAC 50% rule; origination is prohibited.",
  },
  structuring: {
    tier: "escalate",
    citation: "BSA structuring (31 USC 5324)",
    rationale: "Pattern-of-structuring detected (multiple applications " +
      "or deposits just below reporting thresholds); AML compliance " +
      "review + SAR filing consideration required.",
  },
  pep: {
    tier: "escalate",
    citation: "FinCEN CDD PEP screening (31 CFR 1010.230)",
    rationale: "Politically Exposed Person identified per FinCEN CDD; " +
      "enhanced due-diligence required prior to origination.",
  },
  high_risk_country: {
    tier: "escalate",
    citation: "FATF high-risk jurisdiction",
    rationale: "Applicant or beneficial owner tied to FATF-listed " +
      "high-risk or non-cooperative jurisdiction; enhanced CDD required.",
  },
  beneficial_ownership_opaque: {
    tier: "escalate",
    citation: "FinCEN CDD beneficial-ownership rule (31 CFR 1010.230(d))",
    rationale: "Beneficial ownership chain cannot be resolved to natural " +
      "persons at ≥25% threshold; CDD compliance review required before " +
      "origination.",
  },
  gto_metro: {
    tier: "escalate",
    citation: "FinCEN Geographic Targeting Order",
    rationale: "Property or applicant covered by an active FinCEN GTO; " +
      "enhanced identification requirements apply.",
  },
});


const KYC_STATUS_POLICY = Object.freeze({
  current: {
    tier: "approve",
    citation: null,
    rationale: "KYC record current; no additional identification needed.",
  },
  stale: {
    tier: "escalate",
    citation: "USA PATRIOT Act §326 (CIP)",
    rationale: "KYC record older than the institution's refresh threshold; " +
      "re-verification required before origination.",
  },
  incomplete: {
    tier: "escalate",
    citation: "USA PATRIOT Act §326 (CIP)",
    rationale: "Customer Identification Program elements missing; complete " +
      "CIP required before origination.",
  },
  not_verified: {
    tier: "block",
    citation: "USA PATRIOT Act §326 (CIP)",
    rationale: "Customer identity not verified; origination is prohibited " +
      "until CIP requirements are met.",
  },
});


/**
 * Decide whether the loan carries any AML/KYC signal that warrants a
 * voice. Returns true if `loan.aml_flags` is a non-empty array OR
 * `loan.kyc_status` is present.
 *
 * When false, callers should NOT add the AML/KYC voice — the council
 * stays 5-voice (100% back-compat).
 */
export function shouldAttachAmlKycVoice(loan) {
  if (!loan) return false;
  if (Array.isArray(loan.aml_flags) && loan.aml_flags.length > 0) return true;
  if (typeof loan.kyc_status === "string" && loan.kyc_status.length > 0) return true;
  return false;
}


/**
 * Compute the AML/KYC Investigator voice for a loan.
 *
 * @param {object} loan — must have at least one of aml_flags[] or kyc_status
 * @returns {{
 *   voice: string,
 *   verdict: 'approve'|'escalate'|'block',
 *   confidence: number,
 *   rationale: string,
 *   adverse_action_codes: Array<{code, label, source}>,
 *   metrics: object,
 * }}
 */
export function computeAmlKycVoice(loan) {
  const flags = Array.isArray(loan.aml_flags) ? loan.aml_flags : [];
  const kycStatus = typeof loan.kyc_status === "string" ? loan.kyc_status : null;

  const findings = [];
  let hardBlock = false;
  let anyEscalate = false;

  for (const f of flags) {
    const rule = AML_FLAG_POLICY[f];
    if (!rule) {
      // Unknown flag — treat as escalate + note for auditor. Never
      // silently drop.
      findings.push({
        source: "aml_flag",
        flag: f,
        tier: "escalate",
        citation: "Unknown AML flag",
        rationale:
          `Unrecognized AML flag "${f}" — treated as escalate per ` +
          "fail-safe policy; add to lib/aml-kyc-voice.js AML_FLAG_POLICY.",
      });
      anyEscalate = true;
      continue;
    }
    findings.push({ source: "aml_flag", flag: f, ...rule });
    if (rule.tier === "block") hardBlock = true;
    if (rule.tier === "escalate") anyEscalate = true;
  }

  if (kycStatus) {
    const rule = KYC_STATUS_POLICY[kycStatus];
    if (!rule) {
      findings.push({
        source: "kyc_status",
        flag: kycStatus,
        tier: "escalate",
        citation: "Unknown KYC status",
        rationale:
          `Unrecognized kyc_status "${kycStatus}" — treated as escalate ` +
          "per fail-safe policy; add to lib/aml-kyc-voice.js KYC_STATUS_POLICY.",
      });
      anyEscalate = true;
    } else {
      findings.push({ source: "kyc_status", flag: kycStatus, ...rule });
      if (rule.tier === "block") hardBlock = true;
      if (rule.tier === "escalate") anyEscalate = true;
    }
  }

  let verdict;
  if (hardBlock) verdict = "block";
  else if (anyEscalate) verdict = "escalate";
  else verdict = "approve";

  // AA06 emitted whenever the voice is block OR escalate. Reason-code
  // dictionary carries the borrower-readable text.
  const adverse_action_codes = verdict === "approve" ? [] : [{
    code: "AA06",
    label: "AML/KYC-related eligibility concern requiring compliance review",
    source: "BSA/USA PATRIOT/FinCEN CDD/OFAC",
  }];

  // Citations to include in rationale. Deduplicated + short-form.
  const citations = [...new Set(
    findings.map((f) => f.citation).filter(Boolean),
  )].join("; ");

  const rationale = findings.length === 0
    ? "No AML/KYC signals evaluated (voice attached because loan carried " +
      "AML/KYC fields, but no flags matched policy)."
    : citations
      ? `${findings.length} AML/KYC finding(s): ${citations}. See ` +
        "adverse-action codes + reason-code dictionary for borrower-readable text."
      : `${findings.length} AML/KYC finding(s). See reason-code dictionary.`;

  // Confidence is HIGH (0.90) when we hit hard-block flags (regulatory
  // rules are deterministic), MEDIUM (0.75) when escalating, LOWEST
  // (0.60) on baseline approve because "no flag matched" is weaker
  // evidence than "flag matched a rule."
  const confidence = hardBlock ? 0.95 : anyEscalate ? 0.75 : 0.60;

  return {
    voice: "AML/KYC Investigator",
    verdict,
    confidence,
    rationale,
    adverse_action_codes,
    metrics: {
      aml_flags: flags,
      kyc_status: kycStatus,
      findings,
    },
  };
}

export { AML_FLAG_POLICY, KYC_STATUS_POLICY };
