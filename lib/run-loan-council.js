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

  // 1. Credit Fundamentals — FICO + DTI + LTV
  const fico_pass = loan.credit_score >= LOAN_DEFAULTS.fico_approve_floor;
  const dti_pass  = loan.debt_to_income <= LOAN_DEFAULTS.dti_approve_ceiling;
  const ltv_pass  = loan.loan_to_value <= LOAN_DEFAULTS.ltv_approve_ceiling;
  const credit_aa = [];
  if (!fico_pass) credit_aa.push({ code: "AA01", label: ADVERSE_ACTION_CODES.AA01, source: AA_SOURCES.AA01 });
  if (!dti_pass)  credit_aa.push({ code: "AA02", label: ADVERSE_ACTION_CODES.AA02, source: AA_SOURCES.AA02 });
  voices.push({
    voice: "Credit Fundamentals",
    verdict: fico_pass && dti_pass ? "approve" : "escalate",
    confidence: 0.82,
    rationale: `FICO=${loan.credit_score} (Addendum A floor ${LOAN_DEFAULTS.fico_approve_floor}), DTI=${loan.debt_to_income.toFixed(2)} (Addendum B ceiling ${LOAN_DEFAULTS.dti_approve_ceiling}); fundamentals are ${fico_pass && dti_pass ? "acceptable" : "borderline"}.`,
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
    rationale: `VaR(95%, 10d)=${(risk.var_95_10d * 100).toFixed(2)}% vs ${(LOAN_DEFAULTS.var_approve_ceiling * 100).toFixed(0)}% Addendum C cutoff (status: ${risk_budget_status}); LTV=${loan.loan_to_value.toFixed(2)} vs ${LOAN_DEFAULTS.ltv_approve_ceiling.toFixed(2)} Addendum C ceiling.`,
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
      ? "Fair-lending review flag set; ECOA/Reg B disparate-impact escalation required prior to human review."
      : "ECOA/Reg B adverse-action and disparate-impact checks completed.",
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
      ? "Customer-facing explanation and adverse-action reason list reviewed; no flags."
      : `Adverse-action reasons present (${loan.adverse_action_reasons.length}); explanation quality requires escalation per CFPB 2024-09 model-traceability guidance.`,
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
      ? `Sector=${loan.sector}; commercial real estate cycle requires recession-sensitivity escalation.`
      : `Sector=${loan.sector ?? "unknown"}; macro stress within tolerance.`,
    adverse_action_codes: [],
    metrics: { sector: loan.sector }
  });

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

  const response = {
    loan_id: loan.loan_id,
    final_verdict,
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
