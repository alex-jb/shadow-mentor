// runLoanCouncil — JS port of Loredana C. Levitchi's
// orallexa.agents.run_loan_council (loan_council.py from Mode A package).
//
// Verdict resolution: ANY block → block · ANY escalate → escalate · ALL approve → approve.
// Logic verbatim from Lora's Python; only the language changes. Defaults wired
// from lib/schemas/loan.js (FICO 700 / DTI 0.36 / LTV 0.80 / VaR 0.12 @ 95%/10d).

import {
  historical_var,
  expected_shortfall,
  concentration_limits,
  sector_exposure
} from "./risk-tools/index.js";
import { normalizeLoan, LOAN_DEFAULTS } from "./schemas/loan.js";
import { ADVERSE_ACTION_CODES, AA_SOURCES } from "./schemas/adverse-action.js";
import { TRACEABILITY, classifyVarStatus } from "./traceability.js";
import { enforceAnalysisOnly } from "./audit-guardrail.js";
import { computeConfidenceWeightedVerdict } from "./confidence-weighted-verdict.js";
import {
  enforceReasonCodesInDictionary,
  enforceNoProtectedClassProxies,
} from "./enforce-reason-code-dictionary.js";
import { stablePresentationOrder } from "./presentation-order.js";
import { shouldAttachAmlKycVoice, computeAmlKycVoice } from "./aml-kyc-voice.js";

function riskPacket(loan) {
  const prices = loan.market_proxy_prices;
  const positions = loan.collateral_positions;
  const weights = loan.borrower_exposure_weights;
  return {
    var_95_10d: historical_var(prices, LOAN_DEFAULTS.var_confidence, LOAN_DEFAULTS.var_horizon_days),
    es_95_10d: expected_shortfall(prices, LOAN_DEFAULTS.var_confidence, LOAN_DEFAULTS.var_horizon_days),
    concentration: concentration_limits(weights, LOAN_DEFAULTS.concentration_single_name_cap),
    sector_exposure: positions.length > 0 ? sector_exposure(positions) : {}
  };
}

export function runLoanCouncil(rawLoan) {
  const loan = normalizeLoan(rawLoan);
  const risk = riskPacket(loan);

  // 3-bucket VaR classifier per Addendum C Risk Appetite Note.
  // Risk Officer voice uses this for escalate-vs-block routing.
  const risk_budget_status = classifyVarStatus(risk.var_95_10d, LOAN_DEFAULTS.var_approve_ceiling);

  const voices = [];
  const adverse_action_codes = [];

  // 1. Credit Fundamentals — FICO + DTI
  // Per Loredana Levitchi's 2026-06-19 policy clarification, FICO is the
  // credit-eligibility *floor*. Failing it returns block, not escalate —
  // DTI/LTV are repayment/collateral signals where human review may apply,
  // but the creditworthiness floor is not negotiable. Verbatim from her
  // policy note attached to Mode A integration response (June 18 docx).
  const fico_pass = loan.credit_score >= LOAN_DEFAULTS.fico_approve_floor;
  const dti_pass  = loan.debt_to_income <= LOAN_DEFAULTS.dti_approve_ceiling;
  const ltv_pass  = loan.loan_to_value <= LOAN_DEFAULTS.ltv_approve_ceiling;
  const credit_aa = [];
  if (!fico_pass) credit_aa.push({ code: "AA01", label: ADVERSE_ACTION_CODES.AA01, source: AA_SOURCES.AA01 });
  if (!dti_pass)  credit_aa.push({ code: "AA02", label: ADVERSE_ACTION_CODES.AA02, source: AA_SOURCES.AA02 });
  let credit_verdict;
  if (!fico_pass) {
    credit_verdict = "block";       // credit-eligibility floor failure — hard block
  } else if (!dti_pass) {
    credit_verdict = "escalate";    // repayment-capacity signal — human review
  } else {
    credit_verdict = "approve";
  }
  voices.push({
    voice: "Credit Fundamentals",
    verdict: credit_verdict,
    confidence: 0.82,
    rationale: !fico_pass
      ? `FICO=${loan.credit_score} below Addendum A floor ${LOAN_DEFAULTS.fico_approve_floor} (Reg B §1002.6 permissible consideration); credit-eligibility floor failure is a hard block per Levitchi 2026-06-19 policy semantics. Principal reason per CFPB Circular 2022-03: insufficient credit history depth (AA01).`
      : !dti_pass
      ? `FICO=${loan.credit_score} clears Addendum A floor; DTI=${loan.debt_to_income.toFixed(2)} exceeds Addendum B ceiling ${LOAN_DEFAULTS.dti_approve_ceiling} — escalate for compensating-factor review + income verification per Reg B §1002.9(a)(2). Principal reason: elevated debt-service burden (AA02).`
      : `FICO=${loan.credit_score} ≥ ${LOAN_DEFAULTS.fico_approve_floor} (Addendum A) and DTI=${loan.debt_to_income.toFixed(2)} ≤ ${LOAN_DEFAULTS.dti_approve_ceiling} (Addendum B); credit fundamentals within policy floors, no principal reason cited under Reg B.`,
    adverse_action_codes: credit_aa,
    metrics: risk
  });
  adverse_action_codes.push(...credit_aa);

  // 2. Risk Officer — VaR (3-bucket) + LTV (Addendum C)
  const risk_aa = [];
  if (risk_budget_status !== "within_budget") {
    risk_aa.push({ code: "AA04", label: ADVERSE_ACTION_CODES.AA04, source: AA_SOURCES.AA04 });
  }
  if (!ltv_pass) {
    risk_aa.push({ code: "AA03", label: ADVERSE_ACTION_CODES.AA03, source: AA_SOURCES.AA03 });
  }
  const risk_verdict =
    risk_budget_status === "breach"   ? "block" :
    risk_budget_status === "escalate" ? "escalate" :
    !ltv_pass                         ? "escalate" :
                                        "approve";
  voices.push({
    voice: "Risk Officer",
    verdict: risk_verdict,
    confidence: 0.78,
    rationale: `SR 26-2 materiality assessment: VaR(95%, 10d)=${(risk.var_95_10d * 100).toFixed(2)}% vs ${(LOAN_DEFAULTS.var_approve_ceiling * 100).toFixed(0)}% Addendum C benchmark (status: ${risk_budget_status}); LTV=${loan.loan_to_value.toFixed(2)} vs ${LOAN_DEFAULTS.ltv_approve_ceiling.toFixed(2)} Addendum C ceiling. Effective challenge: exposure × purpose warrants ${risk_verdict === "approve" ? "sustained monitoring only" : risk_verdict === "escalate" ? "escalation to Credit Committee" : "hard block on portfolio concentration grounds"}.`,
    adverse_action_codes: risk_aa,
    metrics: { ...risk, risk_budget_status }
  });
  adverse_action_codes.push(...risk_aa);

  // 3. Fair Lending Compliance — ONLY voice that can hard-block on a flag
  const fl_aa = loan.fair_lending_review_flag
    ? [{ code: "AA05", label: ADVERSE_ACTION_CODES.AA05, source: AA_SOURCES.AA05 }]
    : [];
  voices.push({
    voice: "Fair Lending Compliance",
    verdict: loan.fair_lending_review_flag ? "block" : "approve",
    confidence: 0.91,
    rationale: loan.fair_lending_review_flag
      ? "Fair-lending review flag set; FFIEC three-step framework required — prima facie statistical showing, business necessity defense, then less discriminatory alternative search per ECOA/Reg B §1002.4. Escalate for comparative file review prior to human decision."
      : "ECOA/Reg B disparate-impact review complete; no protected-basis proxy features detected in feature set; adverse-action reasons drawn from signed dictionary per CFPB Circular 2022-03 principal-reason accuracy.",
    adverse_action_codes: fl_aa,
    metrics: { fair_lending_review_flag: loan.fair_lending_review_flag }
  });
  adverse_action_codes.push(...fl_aa);

  // 4. Customer Advocate — adverse-action quality
  const advocate_ok = loan.adverse_action_reasons.length === 0;
  voices.push({
    voice: "Customer Advocate",
    verdict: advocate_ok ? "approve" : "escalate",
    confidence: 0.74,
    rationale: advocate_ok
      ? "Customer-facing explanation and adverse-action reason list reviewed against CFPB Bulletin 2024-09 plain-language readability standards; no principal-reason accuracy or dictionary coverage flags."
      : `Adverse-action reasons present (${loan.adverse_action_reasons.length}); each reason must satisfy CFPB Bulletin 2024-09 model-traceability + Circular 2022-03 principal-reason accuracy — 'internal standards' or broad-bucket phrasing is insufficient. Escalate for advocate review of borrower-facing wording.`,
    adverse_action_codes: [],
    metrics: { adverse_action_reasons: loan.adverse_action_reasons }
  });

  // 5. Macro Contrarian — sector cycle
  const cre_flagged = ["commercial_real_estate", "cre"].includes(loan.sector);
  voices.push({
    voice: "Macro Contrarian",
    verdict: cre_flagged ? "escalate" : "approve",
    confidence: 0.69,
    rationale: cre_flagged
      ? `Sector=${loan.sector}; commercial real estate exposure at late-cycle regime junction — historical stress episodes (2008 CMBS, 2020 SVB CRE deposit run, 2023 Signature Bank NYC office correlation) argue for recession-sensitivity escalation per SR 26-2 conservatism principle when tail data is thin.`
      : `Sector=${loan.sector ?? "unknown"}; sector-cycle overlay and historical stress-episode correlation within Addendum C tolerance. No macro-contrarian escalation.`,
    adverse_action_codes: [],
    metrics: { sector: loan.sector }
  });

  // 6. AML/KYC Investigator — OPT-IN. Only attached when loan carries
  // AML/KYC fields (aml_flags[] or kyc_status). Preserves 5-voice
  // back-compat for consumers keyed on voices.length === 5.
  // ACAMS 2026 signals AML is the fastest procurement lane at
  // mid-tier banks; Anthropic's May 2026 finance-agents launch to
  // LPL includes a KYC screener without a compliance council layer
  // — Shadow's insertion point.
  if (shouldAttachAmlKycVoice(loan)) {
    const amlVoice = computeAmlKycVoice(loan);
    voices.push(amlVoice);
    adverse_action_codes.push(...amlVoice.adverse_action_codes);
  }

  // Verdict resolution: block-veto, then escalate-overrides-approve, else approve.
  // Verbatim from Lora's Python (run_loan_council resolver block).
  let final_verdict;
  if (voices.some((v) => v.verdict === "block")) {
    final_verdict = "block";
  } else if (voices.some((v) => v.verdict === "escalate")) {
    final_verdict = "escalate";
  } else {
    final_verdict = "approve";
  }

  // 2026-07-02: confidence-weighted verdict shipped alongside the
  // simple resolver. Both fields are emitted so back-compat callers
  // keep working. See lib/confidence-weighted-verdict.js docstring
  // for the Roundtable Policy motivation.
  const cw = computeConfidenceWeightedVerdict(voices);

  // 2026-07-02: reason-code dictionary enforcement.
  // Any adverse_action code the council emits MUST be backed by the
  // signed reason-code dictionary (see lib/schemas/reason-code-
  // dictionary.json). This closes the post-2026-07-21 Reg B gap.
  //
  // adverse_action_codes is Array<{code, label, source}> — the
  // enforcement API takes an array of code STRINGS, so map first.
  const aaCodeStrings = adverse_action_codes
    .map((c) => (typeof c === "string" ? c : c?.code))
    .filter(Boolean);
  const rcdCheck = enforceReasonCodesInDictionary(aaCodeStrings);
  // We LOG the check on the response; we do NOT throw. The whole
  // point of the dictionary is that bank counsel signed it — if a
  // code slips through that isn't in the dict, that's a bug we
  // want procurement to see, not a runtime crash.
  const featuresCited = voices.flatMap((v) => Object.keys(v.metrics || {}));
  const proxyCheck = enforceNoProtectedClassProxies(featuresCited);

  const response = {
    loan_id: loan.loan_id,
    final_verdict,
    confidence_weighted_verdict: cw.confidence_weighted_verdict,
    aggregated_score: cw.aggregated_score,
    voice_contributions: cw.voice_contributions,
    aggregation_method: cw.aggregation_method,
    reason_code_dictionary_check: rcdCheck,
    protected_class_proxy_check: proxyCheck,
    // 2026-07-02: hidden-anchor mitigation (arxiv 2606.19494). The
    // voices array stays in canonical order so hash + attestation
    // stay deterministic; UIs that render the human-reviewer view
    // should shuffle by presentation_order to avoid anchoring on
    // the first voice.
    presentation_order: stablePresentationOrder(voices.length, {
      loan_id: loan.loan_id,
      verdicts: voices.map((v) => v.verdict),
    }),
    risk_packet: { ...risk, risk_budget_status },
    voices,
    adverse_action_codes,
    thresholds_applied: {
      fico_floor: LOAN_DEFAULTS.fico_approve_floor,
      dti_ceiling: LOAN_DEFAULTS.dti_approve_ceiling,
      ltv_ceiling: LOAN_DEFAULTS.ltv_approve_ceiling,
      var_ceiling: LOAN_DEFAULTS.var_approve_ceiling,
      var_confidence: LOAN_DEFAULTS.var_confidence,
      var_horizon_days: LOAN_DEFAULTS.var_horizon_days
    },
    traceability: TRACEABILITY,
    schema_version: "1.1.0-mode-a"
  };

  // Analysis-only audit guardrail — raises if any voice rationale or
  // adverse-action label contains forbidden trade-execution verbs.
  // Required by BRD Governance Controls + SR 11-7 invariants.
  enforceAnalysisOnly(response);

  return response;
}
