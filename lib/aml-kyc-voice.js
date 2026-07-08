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


// ═══════════════════════════════════════════════════════════════
// v1.5.25 (2026-07-08) — FinCEN NPRM 2026-04-07 alignment
// ═══════════════════════════════════════════════════════════════
//
// On 2026-04-07 FinCEN + Fed + OCC + FDIC issued a joint Notice of
// Proposed Rulemaking to "Fundamentally Reform Financial Institution
// AML Programs" — the largest BSA update since USA PATRIOT Act.
// Comment closed 2026-06-09, final expected late 2026 / early 2027.
//
// Key change: the four-pillar AML program framework (internal
// policies, BSA compliance officer, training, independent testing)
// is consolidated into a **risk-based effective AML/CFT program**
// framework. CDD, previously a distinct "fifth pillar" grafted onto
// the four-pillar structure via 31 CFR 1010.230, is folded into
// "internal policies, procedures, and controls" per the NPRM at
// 31 CFR 1020.210.
//
// Shadow's existing hard-coded rationales cite the pre-NPRM
// four-pillar structure. Once the NPRM finalizes, those citations
// go stale. Rather than wait, Shadow v1.5.25 ships a stage-aware
// citation resolver so callers can render notice text against the
// pre-NPRM, NPRM-proposed, or NPRM-final framing depending on when
// the origination happened.
//
// This matters for audit traceability: a 2026-Q3 origination
// referenced the pre-NPRM framework; a 2027-Q2 origination might
// reference the finalized NPRM. Both must be reconstructable.

/**
 * Canonical stage identifiers. See docs/FINCEN-NPRM-2026-04-07-ALIGNMENT.md
 * for the transition path.
 */
export const NPRM_STAGES = Object.freeze({
  PRE_NPRM: "pre-nprm",       // Pre-2026-04-07, four-pillar structure
  NPRM_PROPOSED: "nprm-proposed", // 2026-04-07 through NPRM finalization
  NPRM_FINAL: "nprm-final",   // NPRM finalized (expected late 2026 / early 2027)
});

/**
 * Get the current default NPRM stage. Reads
 * `SHADOW_FINCEN_NPRM_STAGE` env var; defaults to "pre-nprm" for
 * back-compat with every deployed instance that predates v1.5.25.
 */
export function getFinCenNprmStage() {
  const s = process.env.SHADOW_FINCEN_NPRM_STAGE;
  if (s === NPRM_STAGES.NPRM_PROPOSED || s === NPRM_STAGES.NPRM_FINAL) return s;
  return NPRM_STAGES.PRE_NPRM;
}

/**
 * Given a citation from the pre-NPRM policy tables (AML_FLAG_POLICY,
 * KYC_STATUS_POLICY), return the stage-appropriate rewrite. The
 * mapping is deterministic and reversible so an auditor can
 * reconstruct which stage was in force at decision time from the
 * citation string alone.
 *
 * Preserves the ORIGINAL citation for pre-NPRM. For NPRM-proposed +
 * NPRM-final, appends the NPRM section reference so the notice text
 * stays valid against the newer framework.
 */
export function citationForStage(citation, stage = getFinCenNprmStage()) {
  if (!citation) return citation;
  if (stage === NPRM_STAGES.PRE_NPRM) return citation;

  // FinCEN CDD 31 CFR 1010.230 → NPRM consolidates into 31 CFR 1020.210
  // as "risk-based AML/CFT program controls".
  if (citation.includes("31 CFR 1010.230") || citation.includes("FinCEN CDD")) {
    if (stage === NPRM_STAGES.NPRM_PROPOSED) {
      return `${citation}; NPRM 2026-04-07 consolidates as 31 CFR 1020.210 (proposed risk-based AML/CFT program)`;
    }
    if (stage === NPRM_STAGES.NPRM_FINAL) {
      return `31 CFR 1020.210 (finalized risk-based AML/CFT program, absorbing 31 CFR 1010.230 CDD)`;
    }
  }

  // BSA structuring 31 USC 5324 is statutory — untouched by NPRM.
  // OFAC 50% rule is Treasury OFAC, not FinCEN — untouched by NPRM.
  // USA PATRIOT Act §326 CIP — untouched by NPRM.
  return citation;
}

/**
 * NPRM-aware wrapper around `computeAmlKycVoice`. Returns the same
 * voice payload but every rationale + finding.citation is rewritten
 * per the NPRM stage. Callers who want deterministic pre-NPRM
 * behavior pass stage: NPRM_STAGES.PRE_NPRM explicitly.
 */
export function computeAmlKycVoiceWithStage(loan, { stage } = {}) {
  const effectiveStage = stage || getFinCenNprmStage();
  const base = computeAmlKycVoice(loan);
  const rewrittenFindings = base.metrics.findings.map((f) => ({
    ...f,
    citation: citationForStage(f.citation, effectiveStage),
  }));

  const citations = [
    ...new Set(rewrittenFindings.map((f) => f.citation).filter(Boolean)),
  ].join("; ");
  const rationale =
    rewrittenFindings.length === 0
      ? base.rationale
      : citations
        ? `${rewrittenFindings.length} AML/KYC finding(s): ${citations}. See ` +
          "adverse-action codes + reason-code dictionary for borrower-readable text."
        : base.rationale;

  return {
    ...base,
    rationale,
    metrics: {
      ...base.metrics,
      findings: rewrittenFindings,
      nprm_stage: effectiveStage,
    },
  };
}
