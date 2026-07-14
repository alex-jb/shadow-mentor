// lib/disparity/index.js — Fair-Lending disparity math (Solas-aligned methodology)
//
// v2.0.3 (draft) — Node.js port of the AIR / SMD / Segmented-AIR statistics
// documented by SolasAI (github.com/SolasAI/solas-ai-disparity, Apache-2.0),
// wrapped as Shadow's `shadow_disparity` MCP tool.
//
// Why native JS instead of shelling out to SolasAI Python:
//   1. Zero Python runtime dependency for Shadow deployers (Node-only bank SIEMs).
//   2. Disparity math is simple stats; no ML dependency.
//   3. Preserves SolasAI methodology as the citation anchor for procurement
//      ("Shadow uses SolasAI methodology, native JS implementation, MIT").
//
// Coverage:
//   - adverseImpactRatio    (AIR, 4/5ths rule per EEOC UGSEP 1978 §1607.4(D))
//   - standardizedMeanDifference   (SMD, Cohen's d style)
//   - segmentedAIR         (AIR sliced by a control variable, e.g. FICO bucket)
//
// These are the three metrics a Fair-Lending examiner asks for. Anything
// beyond this is an application-specific extension.

/**
 * Adverse Impact Ratio (AIR) per EEOC UGSEP 1978 §1607.4(D) "four-fifths rule".
 *
 * @param {number[]} protectedOutcomes  Binary outcomes for the protected class (1 = approved, 0 = denied).
 * @param {number[]} referenceOutcomes  Binary outcomes for the reference class.
 * @returns {{air: number, protected_rate: number, reference_rate: number, four_fifths_violation: boolean}}
 */
export function adverseImpactRatio(protectedOutcomes, referenceOutcomes) {
  if (!Array.isArray(protectedOutcomes) || !Array.isArray(referenceOutcomes)) {
    throw new TypeError("adverseImpactRatio: both arguments must be arrays of binary outcomes");
  }
  if (protectedOutcomes.length === 0 || referenceOutcomes.length === 0) {
    throw new RangeError("adverseImpactRatio: both groups must have at least one observation");
  }
  const protected_rate = mean(protectedOutcomes);
  const reference_rate = mean(referenceOutcomes);
  if (reference_rate === 0) {
    throw new RangeError("adverseImpactRatio: reference-group approval rate is zero; AIR undefined");
  }
  const air = protected_rate / reference_rate;
  return {
    air,
    protected_rate,
    reference_rate,
    four_fifths_violation: air < 0.80,
  };
}

/**
 * Standardized Mean Difference (SMD, aka Cohen's d style).
 * Used when the outcome is continuous (e.g. approved credit limit, not just binary approval).
 *
 * @param {number[]} protectedValues
 * @param {number[]} referenceValues
 * @returns {{smd: number, protected_mean: number, reference_mean: number, pooled_stdev: number, concerning: boolean}}
 */
export function standardizedMeanDifference(protectedValues, referenceValues) {
  const pMean = mean(protectedValues);
  const rMean = mean(referenceValues);
  const pooled = pooledStdev(protectedValues, referenceValues);
  if (pooled === 0) {
    throw new RangeError("standardizedMeanDifference: pooled stdev is zero; SMD undefined");
  }
  const smd = (pMean - rMean) / pooled;
  return {
    smd,
    protected_mean: pMean,
    reference_mean: rMean,
    pooled_stdev: pooled,
    concerning: Math.abs(smd) > 0.20,
  };
}

/**
 * Segmented Adverse Impact Ratio — AIR sliced by a control variable.
 * Reveals whether an aggregate AIR of 0.85 (looks fine) masks per-slice
 * AIRs below 0.80 (violation).
 *
 * @param {{outcome: 0|1, is_protected: boolean, segment: string}[]} rows
 * @returns {{[segment: string]: ReturnType<typeof adverseImpactRatio>}}
 */
export function segmentedAIR(rows) {
  const buckets = new Map();
  for (const r of rows) {
    if (!buckets.has(r.segment)) {
      buckets.set(r.segment, { protected: [], reference: [] });
    }
    const b = buckets.get(r.segment);
    (r.is_protected ? b.protected : b.reference).push(r.outcome);
  }
  const out = {};
  for (const [seg, { protected: p, reference: ref }] of buckets) {
    if (p.length === 0 || ref.length === 0) {
      out[seg] = { air: null, reason: "insufficient_data" };
      continue;
    }
    try {
      out[seg] = adverseImpactRatio(p, ref);
    } catch (err) {
      out[seg] = { air: null, reason: err.message };
    }
  }
  return out;
}

// ── internals ─────────────────────────────────────────────

function mean(xs) {
  if (xs.length === 0) return NaN;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function stdev(xs) {
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) ** 2;
  return Math.sqrt(s / xs.length);
}

function pooledStdev(a, b) {
  const na = a.length, nb = b.length;
  const va = stdev(a) ** 2, vb = stdev(b) ** 2;
  return Math.sqrt(((na - 1) * va + (nb - 1) * vb) / (na + nb - 2));
}
