// lib/persona-probabilities.js
// ─────────────────────────────────────────────────────────────────────────────
// Deterministic per-class probabilities (p_approve / p_escalate / p_block) for
// each council voice, derived from the SAME rule margins that drive the
// verdicts in lib/run-loan-council.js. Closes the benchmark/icaif-2026 "Known
// schema gap": per-persona Brier decomposition needs P(class) per event class,
// not the fixed per-persona `confidence` constant (which is left untouched —
// consumers and lib/confidence-weighted-verdict.js keep working; this field is
// APPENDED, never a replacement).
//
// Design contract (pinned by test/persona-probabilities.test.js):
//   1. argmax(probabilities) === the voice's deterministic verdict, for every
//      input. Probabilities REFINE the rule outcome; they can never contradict
//      it. Guaranteed by construction: the verdict class receives
//      p = 0.5 + 0.49·squash(|margin|)  ∈ (0.5, 0.99), so it is always the
//      strict maximum. No LLM anywhere — same primitive under every surface.
//   2. approve + escalate + block === 1 (±1e-9).
//   3. Monotone in the margin: the further a metric sits from its threshold,
//      the more mass the verdict class gets. At the threshold itself the
//      verdict class holds exactly 0.5 — maximal honest uncertainty for a
//      rule-edge decision.
//   4. Binary rules (fair-lending flag, sector membership) get a saturated
//      but never-certain margin (BINARY_MARGIN) — a flag is decisive policy,
//      not probability-1 truth.
//
// Margin scales are the tuning surface and are exported for the drift test:
// they normalize "distance from threshold" into comparable units per metric.
// Changing a scale changes calibration ONLY (sharpness), never a verdict.

import { LOAN_DEFAULTS } from "./schemas/loan.js";

export const MARGIN_SCALES = Object.freeze({
  fico: 50,        // FICO points for one "unit" of distance from the 700 floor
  dti: 0.08,       // DTI ratio units vs the 0.36 ceiling
  ltv: 0.10,       // LTV units vs the 0.80 ceiling
  var_95_10d: 0.03, // VaR units vs the 0.12 approve ceiling
  aa_reasons: 2,   // adverse-action reason count for advocate escalation
});

export const BINARY_MARGIN = 4; // saturated-but-not-certain: p_top ≈ 0.89

/** squash |m| into (0,1); squash(0)=0, squash(∞)→1, monotone. */
function squash(absMargin) {
  return absMargin / (1 + absMargin);
}

/**
 * Build the distribution given the winning class and its |margin|.
 * `tilt` distributes the remainder between the two losing classes:
 * "near" gets 2/3, "far" gets 1/3 (adjacency on the approve↔escalate↔block
 * ladder); escalate splits evenly unless a tilt is provided.
 */
function distribution(verdict, absMargin, tilt) {
  const pTop = 0.5 + 0.49 * squash(Math.max(0, absMargin));
  const rest = 1 - pTop;
  const p = { approve: 0, escalate: 0, block: 0 };
  p[verdict] = pTop;
  if (verdict === "approve") {
    p.escalate = rest * (2 / 3);
    p.block = rest * (1 / 3);
  } else if (verdict === "block") {
    p.escalate = rest * (2 / 3);
    p.approve = rest * (1 / 3);
  } else {
    const towardBlock = tilt === "block" ? 2 / 3 : tilt === "approve" ? 1 / 3 : 1 / 2;
    p.block = rest * towardBlock;
    p.approve = rest * (1 - towardBlock);
  }
  return p;
}

/** Credit Fundamentals — FICO floor (block) then DTI ceiling (escalate). */
export function creditFundamentalsProbabilities(loan) {
  const mFico = (loan.credit_score - LOAN_DEFAULTS.fico_approve_floor) / MARGIN_SCALES.fico;
  const mDti = (LOAN_DEFAULTS.dti_approve_ceiling - loan.debt_to_income) / MARGIN_SCALES.dti;
  if (mFico < 0) return distribution("block", -mFico);
  if (mDti < 0) return distribution("escalate", -mDti, "block");
  // approve confidence is governed by the weakest passing margin
  return distribution("approve", Math.min(mFico, mDti));
}

/** Risk Officer — 3-bucket VaR classifier then LTV ceiling. */
export function riskOfficerProbabilities(loan, risk, riskBudgetStatus) {
  const mVar = (LOAN_DEFAULTS.var_approve_ceiling - risk.var_95_10d) / MARGIN_SCALES.var_95_10d;
  const mLtv = (LOAN_DEFAULTS.ltv_approve_ceiling - loan.loan_to_value) / MARGIN_SCALES.ltv;
  if (riskBudgetStatus === "breach") return distribution("block", Math.max(-mVar, 0.5));
  if (riskBudgetStatus === "escalate") return distribution("escalate", Math.max(Math.abs(mVar), 0.25), "block");
  if (mLtv < 0) return distribution("escalate", -mLtv, "block");
  return distribution("approve", Math.min(mVar, mLtv));
}

/** Fair Lending Compliance — binary flag, only voice that hard-blocks on it. */
export function fairLendingProbabilities(loan) {
  return loan.fair_lending_review_flag
    ? distribution("block", BINARY_MARGIN)
    : distribution("approve", BINARY_MARGIN);
}

/** Customer Advocate — escalation scales with adverse-action reason count. */
export function customerAdvocateProbabilities(loan) {
  const n = loan.adverse_action_reasons.length;
  if (n === 0) return distribution("approve", BINARY_MARGIN);
  return distribution("escalate", n / MARGIN_SCALES.aa_reasons, "approve");
}

/** Macro Contrarian — binary sector membership (CRE late-cycle overlay). */
export function macroContrarianProbabilities(loan) {
  const cre = ["commercial_real_estate", "cre"].includes(loan.sector);
  return cre
    ? distribution("escalate", BINARY_MARGIN, "block")
    : distribution("approve", BINARY_MARGIN);
}

/** Round for serialization stability (6 dp) while preserving sum === 1. */
export function roundProbabilities(p) {
  const approve = Math.round(p.approve * 1e6) / 1e6;
  const escalate = Math.round(p.escalate * 1e6) / 1e6;
  const block = Math.round((1 - approve - escalate) * 1e6) / 1e6;
  return { approve, escalate, block };
}
