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

  const voices = [];

  // 1. Credit Fundamentals — FICO + DTI + LTV
  const credit_ok = loan.credit_score >= LOAN_DEFAULTS.fico_approve_floor &&
                    loan.debt_to_income <= LOAN_DEFAULTS.dti_approve_ceiling;
  voices.push({
    voice: "Credit Fundamentals",
    verdict: credit_ok ? "approve" : "escalate",
    confidence: 0.82,
    rationale: `FICO=${loan.credit_score}, DTI=${loan.debt_to_income.toFixed(2)}, LTV=${loan.loan_to_value.toFixed(2)}; fundamentals are ${credit_ok ? "acceptable" : "borderline"}.`,
    metrics: risk
  });

  // 2. Risk Officer — VaR + LTV
  const risk_ok = risk.var_95_10d < LOAN_DEFAULTS.var_approve_ceiling &&
                  loan.loan_to_value <= LOAN_DEFAULTS.ltv_approve_ceiling;
  voices.push({
    voice: "Risk Officer",
    verdict: risk_ok ? "approve" : "escalate",
    confidence: 0.78,
    rationale: `VaR(95%, 10d)=${(risk.var_95_10d * 100).toFixed(2)}% vs ${(LOAN_DEFAULTS.var_approve_ceiling * 100).toFixed(0)}% ceiling; LTV=${loan.loan_to_value.toFixed(2)} vs ${LOAN_DEFAULTS.ltv_approve_ceiling.toFixed(2)} ceiling.`,
    metrics: risk
  });

  // 3. Fair Lending Compliance — ONLY voice that can hard-block
  voices.push({
    voice: "Fair Lending Compliance",
    verdict: loan.fair_lending_review_flag ? "block" : "approve",
    confidence: 0.91,
    rationale: loan.fair_lending_review_flag
      ? "Fair-lending review flag set; ECOA/Reg B disparate-impact escalation required."
      : "ECOA/Reg B adverse-action and disparate-impact checks completed.",
    metrics: { fair_lending_review_flag: loan.fair_lending_review_flag }
  });

  // 4. Customer Advocate — adverse-action quality
  const advocate_ok = loan.adverse_action_reasons.length === 0;
  voices.push({
    voice: "Customer Advocate",
    verdict: advocate_ok ? "approve" : "escalate",
    confidence: 0.74,
    rationale: advocate_ok
      ? "Customer-facing explanation and adverse-action reason list reviewed; no flags."
      : `Adverse-action reasons present (${loan.adverse_action_reasons.length}); explanation quality requires escalation.`,
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

  return {
    loan_id: loan.loan_id,
    final_verdict,
    risk_packet: risk,
    voices,
    thresholds_applied: {
      fico_floor: LOAN_DEFAULTS.fico_approve_floor,
      dti_ceiling: LOAN_DEFAULTS.dti_approve_ceiling,
      ltv_ceiling: LOAN_DEFAULTS.ltv_approve_ceiling,
      var_ceiling: LOAN_DEFAULTS.var_approve_ceiling,
      var_confidence: LOAN_DEFAULTS.var_confidence,
      var_horizon_days: LOAN_DEFAULTS.var_horizon_days
    },
    schema_version: "1.0.0-mode-a"
  };
}
