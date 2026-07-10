// Adverse-action reason codes for Mode A loan origination.
//
// Codes formalized per Loredana C. Levitchi's Addenda A / B / C
// (Aura Alexa BRD package, Shadow ModeA Complete BRD Addenda, 2026-06-19).
// Aligned with CFPB Circular 2026-03 requirement that adverse-action
// explanations be model-traceable and avoid template phrases.

export const ADVERSE_ACTION_CODES = {
  AA01: "Insufficient credit score for standard approval threshold",
  AA02: "Debt-to-income ratio exceeds standard eligibility threshold",
  AA03: "Collateral coverage / LTV exceeds standard eligibility threshold",
  AA04: "Portfolio / market risk appetite threshold exceeded",
  AA05: "Fair lending review required before final human decision"
};

export const AA_SOURCES = {
  AA01: "Addendum A",
  AA02: "Addendum B",
  AA03: "Addendum C",
  AA04: "Addendum C Risk Appetite Note",
  AA05: "BRD Governance Controls (ECOA / Reg B integration)"
};
