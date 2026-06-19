// Citation traceability for Shadow Mode A loan origination.
//
// Returned inline in every /api/deliberate response so procurement
// auditors see the source chain without separate documentation.
// Sources separated per Loredana C. Levitchi's 2026-06-19 BRD vs
// Addenda guidance:
//
//   BRD       = institutional risk framework (board-approved, version-
//               controlled). Provides math + governance + horizons.
//   Addenda   = product-line policy thresholds (product team owned,
//               revisable quarterly). Provide loan underwriting cutoffs.
//   Risk Appetite Note = benchmark calibration parameter (model team
//                        owned, revisable per validation cycle).
//
// Conflating these three layers is the classic procurement-audit failure
// mode. Examiners discount the entire citation chain when sources are
// mis-attributed. This map keeps every claim at the correct provenance
// depth.

export const TRACEABILITY = {
  "FICO >= 700":      "Addendum A - Loan Origination Credit Policy",
  "DTI <= 0.36":      "Addendum B - Debt-to-Income Eligibility Policy",
  "LTV <= 0.80":      "Addendum C - Collateral / LTV Policy",
  "VaR <= 0.12":      "Addendum C - Risk Appetite Note (benchmark calibration)",
  "VaR/ES Framework": "BRD Risk Core Specification",
  "10-Day Horizon":   "BRD Risk Packet Methodology",
  "Confidence 95%":   "BRD Risk Packet Methodology",
  "Analysis Only":    "BRD Governance Controls",
  "ECOA / Reg B":     "CFPB Bulletin 2024-09 + BRD Governance Controls",
  "SR 11-7":          "Federal Reserve Model Risk Management Guidance"
};

/**
 * Classify a 10-day 95% VaR against the standard risk appetite bucket.
 * Source: Addendum C Risk Appetite Note (benchmark calibration; not BRD).
 *
 *   var_horizon <= 0.12         within_budget
 *   0.12 < var_horizon <= 0.15  escalate
 *   var_horizon > 0.15          breach
 */
export function classifyVarStatus(var_horizon, threshold = 0.12) {
  if (var_horizon <= threshold)        return "within_budget";
  if (var_horizon <= threshold + 0.03) return "escalate";
  return "breach";
}
