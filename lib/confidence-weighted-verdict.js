// lib/confidence-weighted-verdict.js
// ──────────────────────────────────────────────────────────────────
// Confidence-weighted verdict aggregation for the 5-voice council.
//
// Ships 2026-07-02 based on Roundtable Policy (arXiv:2509.16839,
// Sept 2025) which shows confidence-weighted-consensus provably
// reduces hallucination vs majority vote on heterogeneous tasks.
//
// Also draws on Zhu et al. "Demystifying Multi-Agent Debate: The Role
// of Confidence and Diversity" (arXiv:2601.19921) — diversity of
// panel + confidence calibration are the two variables that actually
// matter for aggregation quality.
//
// Why alongside, not instead
// --------------------------
// The existing simple resolver in run-loan-council.js is safe by
// design: any block → block, any escalate → escalate, else approve.
// That's the correct behavior for the FICO/DTI/LTV/VaR hard-block
// layer (Lora's 2026-06-19 binding decision) — those are policy
// floors, not opinions to be weighted.
//
// The confidence-weighted verdict is USEFUL for the seniority-and-
// signal-strength cases *above* the hard-block floor: when Credit,
// Compliance, and Risk all pass but the two Advisor voices disagree
// on approve vs escalate. In that case we want confidence to break
// the tie, not just voice count.
//
// So this module emits a `confidence_weighted_verdict` field
// alongside `final_verdict`. The response body carries both. Callers
// currently keyed on `final_verdict` continue working; callers who
// want the weighted signal can migrate at their own pace.

// Persona base weights — each voice's institutional authority in the
// council. These are prior weights before calibration; a Brier-based
// re-weighting layer (per calibration.js) can update them per bank.
//
// Compliance is the highest fixed weight because Reg B / AA-notice
// obligations are non-negotiable AND their misfires are the most
// expensive class of error (regulatory sanctions).
//
// Credit fundamentals get the next-highest weight because they're
// the operational load-bearing voice (FICO floor, DTI ceiling).
//
// Risk Officer, Trader, Advisor get equal medium weights — they
// contribute skill judgment above the policy floor.
const DEFAULT_PERSONA_WEIGHTS = Object.freeze({
  "Compliance Officer": 1.20,
  "Credit Fundamentals": 1.10,
  "Risk Officer": 1.00,
  "Advocate": 0.85,
  "Macro Contrarian": 0.85,
});

// Verdict → numeric score for aggregation. Approve is positive,
// escalate is neutral, block is strongly negative. Distance from
// zero encodes the strength of the vote.
const VERDICT_SCORES = Object.freeze({
  approve: 1.0,
  escalate: 0.0,
  block: -1.0,
});

// Threshold on aggregated score for the final label. Symmetric
// around 0.0. Chosen conservative — we want to say "escalate" not
// "approve" when the weighted opinion is uncertain (~ 0).
const AGGREGATION_THRESHOLDS = Object.freeze({
  approveMin: 0.35,   // aggregated score >= 0.35 → approve
  blockMax: -0.35,    // aggregated score <= -0.35 → block
  // Middle band [-0.35, 0.35] → escalate (human review)
});

/**
 * Compute the confidence-weighted verdict for a list of voice
 * objects.
 *
 * @param {Array<{voice: string, verdict: string, confidence?: number}>} voices
 * @param {object} [options]
 * @param {object} [options.personaWeights] override persona base
 *   weights. Missing personas fall back to 1.0.
 * @returns {{
 *   confidence_weighted_verdict: 'approve'|'escalate'|'block',
 *   aggregated_score: number,
 *   voice_contributions: Array<{voice: string, weight: number, confidence: number, score: number}>,
 *   aggregation_method: 'confidence_weighted_v1',
 *   any_block: boolean,
 * }}
 */
export function computeConfidenceWeightedVerdict(voices, options = {}) {
  const personaWeights = options.personaWeights || DEFAULT_PERSONA_WEIGHTS;

  // Safety-in-depth: if any voice says block, the weighted verdict
  // MUST also say block. Compliance/Credit hard floors are not
  // negotiable — you cannot outvote a policy floor via confidence.
  const anyBlock = voices.some((v) => v.verdict === "block");
  if (anyBlock) {
    return {
      confidence_weighted_verdict: "block",
      aggregated_score: -1.0,
      voice_contributions: voices.map((v) => ({
        voice: v.voice,
        weight: personaWeights[v.voice] ?? 1.0,
        confidence: v.confidence ?? 0.5,
        score: VERDICT_SCORES[v.verdict] ?? 0.0,
      })),
      aggregation_method: "confidence_weighted_v1",
      any_block: true,
    };
  }

  let totalWeighted = 0.0;
  let totalWeight = 0.0;
  const contributions = [];

  for (const v of voices) {
    const weight = personaWeights[v.voice] ?? 1.0;
    // Missing confidence defaults to 0.5 (neutral). The prompts.js
    // update in this ship makes confidence mandatory, but we default
    // graceful for back-compat.
    const confidence = Math.max(0.0, Math.min(1.0,
      typeof v.confidence === "number" ? v.confidence : 0.5,
    ));
    const score = VERDICT_SCORES[v.verdict] ?? 0.0;
    const weighted = weight * confidence * score;
    totalWeighted += weighted;
    totalWeight += weight * confidence;
    contributions.push({ voice: v.voice, weight, confidence, score });
  }

  const aggregated = totalWeight > 0 ? totalWeighted / totalWeight : 0.0;

  let verdict;
  if (aggregated >= AGGREGATION_THRESHOLDS.approveMin) {
    verdict = "approve";
  } else if (aggregated <= AGGREGATION_THRESHOLDS.blockMax) {
    verdict = "block";
  } else {
    verdict = "escalate";
  }

  return {
    confidence_weighted_verdict: verdict,
    aggregated_score: Number(aggregated.toFixed(4)),
    voice_contributions: contributions,
    aggregation_method: "confidence_weighted_v1",
    any_block: false,
  };
}

export { DEFAULT_PERSONA_WEIGHTS, VERDICT_SCORES, AGGREGATION_THRESHOLDS };
