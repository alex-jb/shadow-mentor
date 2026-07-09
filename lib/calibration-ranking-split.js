// lib/calibration-ranking-split.js
// ──────────────────────────────────────────────────────────────────
// v1.5.42 (2026-07-08). Splits confidence-weighted verdict into two
// orthogonal outputs per arXiv:2605.27712 — "Prefix-Safe Bayesian
// Belief Tracking for LLM Reasoning Reliability: Separating
// Calibration from Ranking" (Song / Li / Liu, 2026-05-26).
//
// The paper's contribution: proves that calibration ≠ ranking.
// Scalar scores optimize ONE dimension. Structure-aware evidence
// scores the OTHER. Systems that conflate them (the current
// `confidence-weighted-verdict.js` in Shadow) cannot simultaneously
// answer "how confident am I?" (calibration) and "which loan is
// more approvable?" (ranking) — they collapse both into a single
// aggregated_score that's often the same for very different loans.
//
// SIVE (v1.5.41) exposed this exact bug at Shadow v1.5.41 —
// obvious_approve and borderline_escalate produce the same
// aggregated_score of 0.6575 despite radically different signal
// strength. See docs/SIVE_BASELINE_FINDINGS.md #3.
//
// v1.5.42 ships the FIX as a new module. The existing
// confidence-weighted-verdict.js is UNTOUCHED (back-compat).
// Callers who want honest Brier reporting migrate to the two-output
// API; legacy callers see zero behavior change.
//
// The 14th append-only attestation field
// (`calibration_ranking_split_sha256`) binds BOTH outputs into
// Ed25519 so a post-hoc swap breaks verification.

import { createHash } from "node:crypto";


/**
 * Verdict → probability-of-approval prior. Approve is high (near 1),
 * escalate is neutral (0.5), block is low (near 0). Different from
 * VERDICT_SCORES in confidence-weighted-verdict.js which is [-1, 1] —
 * that scoring is a RANKING signal not a CALIBRATION signal.
 */
const VERDICT_PROBABILITIES = Object.freeze({
  approve: 0.90,
  escalate: 0.50,
  block: 0.10,
});


/**
 * Compute the CALIBRATED probability the council's aggregate verdict
 * is correct. This is a Bayesian update over per-voice verdict
 * probabilities weighted by persona authority. Returns [0, 1] —
 * Brier-auditable directly.
 *
 * Formula: p_agg = sum(p_i × w_i) / sum(w_i)
 *
 * Where p_i is the verdict-probability of voice i and w_i is the
 * persona weight. This is NOT the same as the aggregated_score in
 * confidence-weighted-verdict.js — that formula sums verdict-scores
 * in [-1, 1] and produces an unbounded signed number that can't be
 * directly Brier-scored.
 *
 * @param {Array<{voice_name: string, verdict: string, confidence?: number}>} voices
 * @param {Record<string, number>} weights — persona name → weight
 * @returns {number} calibrated_p in [0, 1]
 */
export function computeCalibratedProbability(voices, weights = {}) {
  if (!Array.isArray(voices) || voices.length === 0) return 0.5;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const v of voices) {
    const w = weights[v.voice_name] ?? 1.0;
    const p = VERDICT_PROBABILITIES[v.verdict] ?? 0.5;
    // Optional per-voice confidence multiplier — scales weight
    // toward 0 when the voice self-declares low confidence.
    const conf = typeof v.confidence === "number"
      ? Math.max(0, Math.min(1, v.confidence))
      : 1.0;
    weightedSum += p * w * conf;
    totalWeight += w * conf;
  }

  if (totalWeight === 0) return 0.5;
  return weightedSum / totalWeight;
}


/**
 * Compute the RANKING score — structural aggregation for
 * tie-breaking, NOT a probability. Unbounded ordinal. High = more
 * approvable, low = less approvable. Two loans with the same
 * calibrated_p but different underlying signal strength should have
 * different ranking_scores.
 *
 * Formula: rank = sum((p_i - 0.5) × w_i × conf_i × spread_multiplier)
 *
 * Where spread_multiplier is 2 for approve, 1 for escalate, 2 for
 * block — this multiplies the "distance from neutral" so a
 * unanimous strong approve outranks a unanimous weak approve.
 *
 * @param {Array<{voice_name: string, verdict: string, confidence?: number, metrics?: object}>} voices
 * @param {Record<string, number>} weights
 * @returns {number} ranking_score (unbounded, signed)
 */
export function computeRankingScore(voices, weights = {}) {
  if (!Array.isArray(voices) || voices.length === 0) return 0;

  let rank = 0;
  for (const v of voices) {
    const w = weights[v.voice_name] ?? 1.0;
    const p = VERDICT_PROBABILITIES[v.verdict] ?? 0.5;
    const conf = typeof v.confidence === "number"
      ? Math.max(0, Math.min(1, v.confidence))
      : 1.0;
    // Distance from neutral (0.5) scaled by 2 to span [-1, 1].
    const centered = (p - 0.5) * 2;
    // Metric-strength bonus: if the voice cited a metric that's
    // FAR from the threshold (deeply-safe or deeply-blocked), scale
    // by that safety margin. Loans with FICO 780 (far above 700
    // floor) get more rank credit than loans with FICO 705.
    const metricStrength = _extractMetricStrength(v.metrics);
    rank += centered * w * conf * metricStrength;
  }
  return rank;
}


function _extractMetricStrength(metrics) {
  if (!metrics || typeof metrics !== "object") return 1.0;
  // FICO ratio: how far above / below 700 (roughly). Values well
  // above 700 give strength > 1; values near 700 give strength ~ 1.
  if (typeof metrics.credit_score === "number") {
    const distance = Math.abs(metrics.credit_score - 700);
    return Math.max(0.5, Math.min(2.0, 1.0 + distance / 200));
  }
  return 1.0;
}


/**
 * Compute both outputs in one call. Return shape lets bank counsel
 * pin the split explicitly.
 *
 * @param {Array} voices
 * @param {object} weights
 * @returns {{calibrated_p: number, ranking_score: number}}
 */
export function computeCalibrationRankingSplit(voices, weights = {}) {
  return {
    calibrated_p: computeCalibratedProbability(voices, weights),
    ranking_score: computeRankingScore(voices, weights),
  };
}


/**
 * SHA-256 commitment over BOTH outputs + the input voices +
 * persona weights snapshot. Bound into aex-attestation/v1 as the
 * 14th append-only field. Silent swap of either output (e.g.
 * quietly lowering calibrated_p to skirt a Brier audit threshold)
 * breaks Ed25519 verification.
 *
 * @param {object} split — { calibrated_p, ranking_score }
 * @param {Array} voices — canonical voice list at decision time
 * @param {object} weights — persona weight snapshot
 * @returns {string} 64-char hex
 */
export function calibrationRankingSplitCommitment(split, voices = [], weights = {}) {
  const canonical = JSON.stringify({
    spec_version: "shadow-calibration-ranking-split/v1",
    anchor: "arXiv:2605.27712",
    calibrated_p: Number(split.calibrated_p?.toFixed(6) ?? 0.5),
    ranking_score: Number(split.ranking_score?.toFixed(6) ?? 0),
    voice_count: voices.length,
    voice_verdicts: voices.map((v) => ({
      name: v.voice_name,
      verdict: v.verdict,
    })),
    weight_snapshot: weights,
  });
  return createHash("sha256").update(canonical).digest("hex");
}


/**
 * Diagnose whether the confidence-weighted-verdict layer is
 * conflating calibration with ranking. Returns true when both
 * outputs move in lockstep (bug) OR when calibrated_p is far from
 * derived-from-ranking-score (bug).
 *
 * Used at test time to detect when a code change accidentally
 * re-introduced the conflation.
 *
 * @param {Array<{calibrated_p, ranking_score}>} decisions — sample of past decisions
 * @returns {{ok: boolean, reason: string}}
 */
export function auditNoConflation(decisions) {
  if (!Array.isArray(decisions) || decisions.length < 2) {
    return { ok: true, reason: "not enough samples to audit" };
  }
  // If EVERY decision has the SAME calibrated_p but DIFFERENT
  // ranking_score, that's the ideal case — the split is working.
  // If EVERY decision has the SAME calibrated_p AND the SAME
  // ranking_score, that's the Haiku uniform-0.5 collapse
  // (v1.5.41 SIVE Finding #3 pathology).
  const uniqueCal = new Set(decisions.map((d) => d.calibrated_p?.toFixed(3)));
  const uniqueRank = new Set(decisions.map((d) => d.ranking_score?.toFixed(3)));
  if (uniqueCal.size === 1 && uniqueRank.size === 1) {
    return {
      ok: false,
      reason:
        "Variance collapse detected: every decision has identical " +
        "calibrated_p AND identical ranking_score. Likely Haiku " +
        "uniform-0.5 pathology or council prompt-anchor bug.",
    };
  }
  // Check that at least ONE pair of decisions has same calibrated_p
  // but different ranking_score OR vice versa — that proves the
  // two outputs are actually orthogonal.
  let independent = false;
  for (let i = 0; i < decisions.length; i++) {
    for (let j = i + 1; j < decisions.length; j++) {
      const dCal = Math.abs(decisions[i].calibrated_p - decisions[j].calibrated_p);
      const dRank = Math.abs(decisions[i].ranking_score - decisions[j].ranking_score);
      if ((dCal < 0.01 && dRank > 0.1) || (dCal > 0.01 && dRank < 0.01)) {
        independent = true;
        break;
      }
    }
    if (independent) break;
  }
  return {
    ok: independent,
    reason: independent
      ? "Two outputs vary independently at least once — split is working."
      : "Two outputs move in lockstep — conflation may still exist.",
  };
}
