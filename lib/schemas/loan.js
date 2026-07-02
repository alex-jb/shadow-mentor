// Loan structured input schema — JS port of Loredana C. Levitchi's loan dict
// from orallexa.agents.run_loan_council. Used by Shadow's compliance × LBO
// cell as the official input contract.
//
// Defaults pulled from Lora's Mode A package (Aura Alexa BR document):
//   FICO ≥ 700  → Credit Fundamentals approve threshold
//   DTI ≤ 0.36  → Credit Fundamentals approve threshold
//   LTV ≤ 0.80  → Risk Officer approve threshold (paired with VaR)
//   VaR < 0.12 (95% conf, 10-day horizon) → Risk Officer approve threshold
//
// These four numbers become the deterministic-rubric "expected terms"
// in shadow-mentor/benchmark/runner.js for the compliance × LBO task.
//
// Reference: BR pp. TBD — pending Loredana confirmation per 2026-06-18 email.

export const LOAN_SCHEMA_VERSION = "1.0.0-mode-a";

export const LOAN_DEFAULTS = {
  fico_approve_floor: 700,
  dti_approve_ceiling: 0.36,
  ltv_approve_ceiling: 0.80,
  var_approve_ceiling: 0.12,
  var_confidence: 0.95,
  var_horizon_days: 10,
  concentration_single_name_cap: 0.80, // Lora's _risk_packet default
  policy_section: "4.3" // Stifel-class senior credit underwriting standards
};

const VALID_SECTORS = [
  "consumer_discretionary", "consumer_staples", "energy", "financials",
  "healthcare", "industrials", "information_technology", "materials",
  "real_estate", "telecom", "utilities", "commercial_real_estate", "cre"
];

const VALID_RATINGS = [
  "AAA", "AA+", "AA", "AA-", "A+", "A", "A-", "BBB+", "BBB", "BBB-",
  "BB+", "BB", "BB-", "B+", "B", "B-", "CCC+", "CCC", "CCC-", "CC", "C", "D"
];

export function validateLoan(loan) {
  const errors = [];
  if (typeof loan !== "object" || loan === null) {
    return { valid: false, errors: ["loan must be an object"] };
  }

  // Required fields
  if (!Number.isFinite(loan.credit_score) || loan.credit_score < 300 || loan.credit_score > 850) {
    errors.push("credit_score must be a finite number in [300, 850]");
  }
  if (!Number.isFinite(loan.debt_to_income) || loan.debt_to_income < 0 || loan.debt_to_income > 2) {
    errors.push("debt_to_income (DTI) must be a finite number in [0, 2]");
  }
  if (!Number.isFinite(loan.loan_to_value) || loan.loan_to_value < 0 || loan.loan_to_value > 2) {
    errors.push("loan_to_value (LTV) must be a finite number in [0, 2]");
  }
  if (!Number.isFinite(loan.amount) || loan.amount <= 0) {
    errors.push("amount must be a positive finite number");
  }

  // Optional but typed
  if (loan.borrower_rating !== undefined && !VALID_RATINGS.includes(loan.borrower_rating)) {
    errors.push(`borrower_rating must be one of ${VALID_RATINGS.join(", ")}`);
  }
  if (loan.sector !== undefined && !VALID_SECTORS.includes(String(loan.sector).toLowerCase())) {
    errors.push(`sector must be one of ${VALID_SECTORS.join(", ")} (case-insensitive)`);
  }
  if (loan.fair_lending_review_flag !== undefined && typeof loan.fair_lending_review_flag !== "boolean") {
    errors.push("fair_lending_review_flag must be a boolean if present");
  }
  if (loan.adverse_action_reasons !== undefined && !Array.isArray(loan.adverse_action_reasons)) {
    errors.push("adverse_action_reasons must be an array if present");
  }
  if (loan.market_proxy_prices !== undefined) {
    if (!Array.isArray(loan.market_proxy_prices) || loan.market_proxy_prices.length < 3) {
      errors.push("market_proxy_prices must be an array of ≥ 3 positive numbers");
    }
  }
  if (loan.collateral_positions !== undefined && !Array.isArray(loan.collateral_positions)) {
    errors.push("collateral_positions must be an array if present");
  }
  if (loan.borrower_exposure_weights !== undefined) {
    if (typeof loan.borrower_exposure_weights !== "object" || loan.borrower_exposure_weights === null) {
      errors.push("borrower_exposure_weights must be an object {name: weight}");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function normalizeLoan(loan) {
  // Apply sensible defaults for optional fields used by run_loan_council.
  return {
    loan_id: loan.loan_id ?? `loan-${Date.now()}`,
    credit_score: loan.credit_score,
    debt_to_income: loan.debt_to_income,
    loan_to_value: loan.loan_to_value,
    amount: loan.amount,
    borrower_rating: loan.borrower_rating ?? null,
    sector: loan.sector ? String(loan.sector).toLowerCase() : null,
    fair_lending_review_flag: loan.fair_lending_review_flag ?? false,
    adverse_action_reasons: loan.adverse_action_reasons ?? [],
    market_proxy_prices: loan.market_proxy_prices ?? [100, 99, 101, 98, 97, 100, 96, 95, 99, 94, 93],
    collateral_positions: loan.collateral_positions ?? [],
    borrower_exposure_weights: loan.borrower_exposure_weights ?? { primary_borrower: 0.7, guarantor: 0.3 },
    // 2026-07-02 AML/KYC fields — opt-in. Only trigger the 6th
    // council voice (AML/KYC Investigator) when present. Preserves
    // 5-voice back-compat when omitted.
    aml_flags: Array.isArray(loan.aml_flags) ? loan.aml_flags : undefined,
    kyc_status: typeof loan.kyc_status === "string" ? loan.kyc_status : undefined,
  };
}
