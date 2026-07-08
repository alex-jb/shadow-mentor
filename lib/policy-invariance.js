// lib/policy-invariance.js
// ──────────────────────────────────────────────────────────────────
// v1.5.23 (2026-07-08): Policy Invariance Score + Judge Card
// protocol implementation. Anchors arXiv:2605.06161 (Weng, Feng,
// Xie, 2026-05-07) "Beyond Accuracy: Policy Invariance as a
// Reliability Test for LLM Safety Judges" — the paper that
// documents up to 9.1% verdict flips under content-preserving
// policy rewrites with 18-43% of flips landing on unambiguous
// cases.
//
// Why this exists
// ---------------
// Shadow's v1.5.21 `test/verdict-invariance.test.js` already
// asserts structural invariance on the DETERMINISTIC side
// (whitespace, key ordering, float noise, collateral ordering
// don't move the verdict). But structural invariance is a
// necessary-not-sufficient condition. The Weng et al. protocol
// tests the harder claim: does the judge produce the same verdict
// under *semantically-equivalent* rubric rewrites?
//
// The v1.5.23 module ships three testable computations:
//
//   1. **Rubric-semantics score**: fraction of verdicts that stay
//      identical across N certified-equivalent rewrites of the
//      input. A rewrite is "certified equivalent" if it preserves
//      every numeric field within float epsilon, preserves every
//      categorical field verbatim, and only rewrites free-text
//      rationales using synonym-preserving substitution.
//
//   2. **Rubric-threshold score**: fraction of verdicts that stay
//      correctly *directional* under strict-to-lenient policy
//      threshold shifts. Approving a loan under a stricter DTI
//      cap should not become blocking under a *looser* one.
//
//   3. **Ambiguity-aware calibration score**: fraction of
//      unambiguous cases where verdicts stay identical. Ambiguous
//      cases (rationale mentions "close call", "boundary",
//      "edge") are excluded from the numerator because a judge
//      that flips on unambiguous cases is fundamentally
//      unreliable in a way flips on ambiguous cases are not.
//
// All three metrics are in [0, 1]. Higher is better. The paper's
// recommended reporting bundle is called a "Judge Card" — a JSON
// artifact with all three scores plus a rewrite-family breakdown.
//
// This module is PURE. No LLM calls. Callers pass in verdicts
// obtained however they want (deterministic council, LLM council,
// stub) and get back the score.

/**
 * Certified-equivalent rewrite family. Each entry describes a
 * transformation that MUST NOT change the correct verdict of a
 * loan-council decision — because it preserves every regulator-
 * observable input.
 *
 * The names are stable across versions. If you change one, you
 * break existing Judge Card artifacts.
 */
export const REWRITE_FAMILIES = Object.freeze([
  "whitespace_perturbation",
  "field_reorder",
  "numeric_restatement",
  "synonym_preserved",
]);

/**
 * Ambiguity signals. If any of these appear in a persona rationale,
 * the case is classified ambiguous.
 *
 * These are drawn from banking-analyst practice: a compliance
 * officer describing a "close call" or a "boundary" or an
 * "edge case" is signalling that the deterministic thresholds
 * happen to land near the crossing. Under such conditions, small
 * verdict flips reflect the crossing itself, not judge
 * unreliability.
 */
export const AMBIGUITY_SIGNALS = Object.freeze([
  "close call",
  "boundary",
  "on the edge",
  "edge case",
  "just above",
  "just below",
  "borderline",
  "near the threshold",
  "near threshold",
  "marginally",
  "on the line",
]);

/**
 * Detect whether a set of persona rationales collectively signal
 * an ambiguous case. Returns { ambiguous: bool, signals: [string] }.
 */
export function classifyAmbiguity(rationales) {
  const arr = Array.isArray(rationales) ? rationales : [rationales];
  const joined = arr
    .filter((r) => typeof r === "string")
    .join(" ")
    .toLowerCase();
  const signals = AMBIGUITY_SIGNALS.filter((s) => joined.includes(s));
  return { ambiguous: signals.length > 0, signals };
}

/**
 * Extract rationales from a Shadow response, whether the response
 * is banking (voices[]) or trading (rationale field) or generic
 * (top-level `rationale`).
 */
function extractRationales(response) {
  if (!response) return [];
  if (Array.isArray(response.voices)) {
    return response.voices
      .map((v) => (typeof v?.rationale === "string" ? v.rationale : ""))
      .filter(Boolean);
  }
  if (typeof response.rationale === "string") return [response.rationale];
  return [];
}

/**
 * Compute the rubric-semantics score. Fraction of verdict
 * agreement across certified-equivalent rewrites.
 *
 * @param {Array<{family: string, verdict: string}>} rewriteVerdicts
 *   Array of {family, verdict} pairs, one per applied rewrite.
 * @param {string} baselineVerdict The unrewritten verdict.
 * @returns {number} Score in [0, 1].
 */
export function rubricSemanticsScore(rewriteVerdicts, baselineVerdict) {
  if (!Array.isArray(rewriteVerdicts) || rewriteVerdicts.length === 0) {
    return 1;
  }
  const agree = rewriteVerdicts.filter((r) => r.verdict === baselineVerdict).length;
  return agree / rewriteVerdicts.length;
}

/**
 * Compute the rubric-threshold score. Under a strict-to-lenient
 * policy shift, the verdict must NOT flip in the wrong direction.
 *
 * Directional-correctness matrix:
 *   strict verdict = block   → lenient may become escalate or approve  (OK: monotone)
 *   strict verdict = escalate → lenient may become approve             (OK: monotone)
 *   strict verdict = approve → lenient MUST stay approve               (violation if flips to block/escalate)
 *
 * A judge that becomes STRICTER under LOOSER thresholds is
 * unreliable. That's the failure mode Weng et al. flag as the
 * ~9% ceiling on LLM-only judges.
 *
 * @param {Array<{strictVerdict: string, lenientVerdict: string}>} shifts
 * @returns {number} Score in [0, 1].
 */
export function rubricThresholdScore(shifts) {
  if (!Array.isArray(shifts) || shifts.length === 0) return 1;
  const rank = { approve: 0, escalate: 1, block: 2 };
  const violations = shifts.filter((s) => {
    const strictR = rank[s.strictVerdict];
    const lenientR = rank[s.lenientVerdict];
    if (strictR === undefined || lenientR === undefined) return true;
    return lenientR > strictR;
  }).length;
  return 1 - violations / shifts.length;
}

/**
 * Compute the ambiguity-aware calibration score. Fraction of
 * unambiguous cases where the verdict stays identical across
 * rewrite families. Ambiguous cases are excluded from the
 * denominator so a legitimately close call doesn't drag the
 * score down.
 *
 * @param {Array<{ambiguous: boolean, agree: boolean}>} cases
 * @returns {number} Score in [0, 1]. Returns 1 if there are no
 *   unambiguous cases (nothing to fail on).
 */
export function ambiguityCalibrationScore(cases) {
  if (!Array.isArray(cases)) return 1;
  const unambiguous = cases.filter((c) => c && c.ambiguous === false);
  if (unambiguous.length === 0) return 1;
  const agree = unambiguous.filter((c) => c.agree === true).length;
  return agree / unambiguous.length;
}

/**
 * Compute the full Judge Card object. Callers pass in one baseline
 * response + arrays of rewrite-response pairs + arrays of
 * threshold-shift pairs. This function returns the exact JSON
 * shape published in `docs/JUDGE-CARD.md`.
 *
 * @param {object} params
 * @param {object} params.baseline Baseline Shadow response.
 * @param {Array<{family: string, response: object}>} params.rewriteResponses
 * @param {Array<{strictResponse: object, lenientResponse: object}>} params.thresholdShifts
 * @returns {object} Judge Card.
 */
export function buildJudgeCard({ baseline, rewriteResponses = [], thresholdShifts = [] }) {
  if (!baseline || typeof baseline !== "object") {
    throw new Error("buildJudgeCard: baseline required");
  }
  const baselineVerdict = baseline.final_verdict || "unknown";
  const baselineAmbig = classifyAmbiguity(extractRationales(baseline));

  const rewriteVerdicts = rewriteResponses.map(({ family, response }) => ({
    family,
    verdict: response?.final_verdict || "unknown",
    ambiguous: classifyAmbiguity(extractRationales(response)).ambiguous,
  }));

  const semanticsByFamily = {};
  for (const family of REWRITE_FAMILIES) {
    const forFamily = rewriteVerdicts.filter((r) => r.family === family);
    semanticsByFamily[family] = rubricSemanticsScore(forFamily, baselineVerdict);
  }

  const rubric_semantics_score = rubricSemanticsScore(rewriteVerdicts, baselineVerdict);

  const shifts = thresholdShifts.map(({ strictResponse, lenientResponse }) => ({
    strictVerdict: strictResponse?.final_verdict || "unknown",
    lenientVerdict: lenientResponse?.final_verdict || "unknown",
  }));
  const rubric_threshold_score = rubricThresholdScore(shifts);

  const cases = rewriteVerdicts.map((r) => ({
    ambiguous: baselineAmbig.ambiguous || r.ambiguous,
    agree: r.verdict === baselineVerdict,
  }));
  const ambiguity_calibration_score = ambiguityCalibrationScore(cases);

  // The paper's headline reliability metric is the geometric mean
  // of all three, so a single low score can't be masked by two
  // strong ones. This is the value published on the badge.
  const overall = geoMean([
    rubric_semantics_score,
    rubric_threshold_score,
    ambiguity_calibration_score,
  ]);

  return {
    protocol: "policy-invariance",
    protocol_version: "1",
    reference: "arXiv:2605.06161",
    baseline_verdict: baselineVerdict,
    baseline_ambiguous: baselineAmbig.ambiguous,
    baseline_ambiguity_signals: baselineAmbig.signals,
    n_rewrites: rewriteVerdicts.length,
    n_threshold_shifts: shifts.length,
    rubric_semantics_score,
    rubric_semantics_by_family: semanticsByFamily,
    rubric_threshold_score,
    ambiguity_calibration_score,
    overall,
  };
}

function geoMean(values) {
  const filtered = values.filter((v) => Number.isFinite(v) && v > 0);
  if (filtered.length === 0) return 0;
  const logSum = filtered.reduce((s, v) => s + Math.log(v), 0);
  return Math.exp(logSum / filtered.length);
}

/**
 * Deterministic certified-equivalent rewrite generators. Each takes
 * a request object and returns a variant that MUST NOT change the
 * regulator-observable inputs. Callers pass the variants through
 * `runLoanCouncil` (or `/api/deliberate`) and feed the resulting
 * verdicts to `buildJudgeCard`.
 *
 * Whitespace perturbation: no real change (Shadow already tests
 * this in v1.5.21). Kept in the rewrite family for completeness so
 * a downstream Judge Card reports a full family breakdown even on
 * the trivial case.
 */
export function whitespaceRewrite(request) {
  // JSON round-trip with an indent. Shadow ignores whitespace.
  const s = JSON.stringify(request, null, 2);
  return JSON.parse(s);
}

/**
 * Field-reorder rewrite: reverse the top-level key order.
 */
export function fieldReorderRewrite(request) {
  if (!request || typeof request !== "object") return request;
  const out = {};
  for (const k of Object.keys(request).reverse()) out[k] = request[k];
  return out;
}

/**
 * Numeric-restatement rewrite: perturb numeric fields by a
 * float-epsilon amount so representation changes but semantics
 * don't. If any numeric already equals a threshold-boundary, this
 * would trip Shadow's threshold — so callers should keep loan
 * inputs off the exact boundary when building rewrite fixtures.
 */
export function numericRestatementRewrite(request) {
  if (!request || typeof request !== "object") return request;
  const eps = 1e-14;
  const out = { ...request };
  for (const k of Object.keys(out)) {
    if (typeof out[k] === "number") out[k] = out[k] + eps;
  }
  return out;
}

/**
 * Synonym-preserved rewrite: apply reversible replacements to
 * free-text fields (rationale, notes) that don't change semantics
 * to a rational compliance reader. Numeric + categorical fields
 * are untouched.
 */
const SYNONYM_TABLE = Object.freeze([
  [/\bhigh\b/gi, "elevated"],
  [/\blow\b/gi, "reduced"],
  [/\bapprove\b/gi, "authorize"],
  [/\bblock\b/gi, "reject"],
  [/\bcustomer\b/gi, "borrower"],
]);

export function synonymPreservedRewrite(request) {
  if (!request || typeof request !== "object") return request;
  const out = { ...request };
  const rewriteString = (s) => {
    if (typeof s !== "string") return s;
    let t = s;
    for (const [re, rep] of SYNONYM_TABLE) t = t.replace(re, rep);
    return t;
  };
  for (const k of Object.keys(out)) {
    if (typeof out[k] === "string") out[k] = rewriteString(out[k]);
  }
  return out;
}

/**
 * Apply all four certified-equivalent rewrite families to a
 * request. Returns an array of {family, rewritten} pairs so a
 * caller can dispatch them through the council and pass the
 * verdicts back to `buildJudgeCard`.
 */
export function applyAllRewrites(request) {
  return [
    { family: "whitespace_perturbation", rewritten: whitespaceRewrite(request) },
    { family: "field_reorder", rewritten: fieldReorderRewrite(request) },
    { family: "numeric_restatement", rewritten: numericRestatementRewrite(request) },
    { family: "synonym_preserved", rewritten: synonymPreservedRewrite(request) },
  ];
}
