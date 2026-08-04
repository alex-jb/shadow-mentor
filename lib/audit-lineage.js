// lib/audit-lineage.js
// Model 3 (Lora Levitchi, Orallexa Shadow — "Audit Completeness and Evidence Lineage"),
// implemented over the shipped evidence bundle. Converts audit completeness from a
// qualitative statement into a weighted, mathematically measurable quantity, and computes
// the lineage + first-failure diagnostics the Katz proposal's evaluation table calls for.
//
//   A_cov   weighted audit completeness   = Σ w_r · 1[verified_r] / Σ w_r      (§3.4)
//   C_lin   lineage connectivity          = 1 − R_disc
//   R_disc  disconnected-evidence rate     = fraction of the chain with no valid path
//                                            to the sealed decision (everything after the
//                                            first failed link)
//   D_norm  normalized lineage depth       = verified source→decision path length / N
//   P_fail  post-failure invalidation      = proportion of the chain invalidated after the
//                                            first failure
//   first-failure localization             = the exact seq where stored ≠ recomputed hash,
//                                            or prev_hash breaks (from verifyBundle)
//   A_total unified audit-and-lineage score = α A_cov + β C_lin + γ D_norm − δ R_disc − η P_fail
//
// The chain metrics come from the (already tested) verifyBundle — payload rebind + hash
// chain — so a plaintext edit both fails verification AND drops the audit score, and the
// score names where. A_cov needs a required-evidence set; pass one, or it falls back to a
// source-resolution proxy (fraction of events whose inline payload rebinds to its hash).

import { verifyBundle } from "shadow-attest-core/session";

// Default weights emphasize completeness + connectivity; failures are penalized, not zeroed,
// so the score degrades gracefully and remains comparable across bundles. Override via opts.
// Positive weights sum to 1 (α+β+γ) so a fully-covered, fully-connected, untampered bundle
// scores A_total = 1.0; the failure penalties (δ, η) are larger since they only apply when
// the chain breaks, driving a tampered bundle toward 0. All overridable via opts.weights.
export const DEFAULT_WEIGHTS = Object.freeze({ alpha: 0.5, beta: 0.3, gamma: 0.2, delta: 0.3, eta: 0.2 });

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * @param {object} bundle  a Shadow evidence bundle
 * @param {object} [opts]
 * @param {string} [opts.publicKey]  Ed25519 public key (PEM) — required for the integrity + first-failure terms
 * @param {Array<{id:string, weight?:number, verified:boolean}>} [opts.required]
 *        the required-evidence set R with severity weights w_r and whether each is independently
 *        verified. Omit to proxy A_cov from source-resolution (verified inline payloads / N).
 * @param {object} [opts.weights]  override DEFAULT_WEIGHTS
 * @returns {object} the Model 3 metric set + the unified score
 */
export function auditLineageScore(bundle, opts = {}) {
  if (!bundle || typeof bundle !== "object") throw new Error("auditLineageScore: bundle object required");
  const { publicKey = null, required = null, weights = {} } = opts;
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const n = Array.isArray(bundle.events) ? bundle.events.length : 0;

  const verified = verifyBundle(bundle, { publicKey });
  const integrityOk = verified.ok === true;
  const firstFailureSeq = integrityOk ? null
    : (typeof verified.error?.seq === "number" ? verified.error.seq
      : (typeof verified.failedSeq === "number" ? verified.failedSeq : null));
  const firstFailureReason = integrityOk ? null : (verified.reason ?? verified.error?.reason ?? null);

  // A_cov — weighted audit completeness over the required-evidence set R (§3.4).
  let A_cov, A_cov_unweighted, requiredCount, verifiedCount;
  if (Array.isArray(required) && required.length > 0) {
    let num = 0, den = 0, vc = 0;
    for (const r of required) {
      const wr = Number.isFinite(r.weight) ? r.weight : 1;
      den += wr;
      if (r.verified) { num += wr; vc++; }
    }
    A_cov = den > 0 ? num / den : 1;
    A_cov_unweighted = vc / required.length;
    requiredCount = required.length; verifiedCount = vc;
  } else {
    // proxy: fraction of events whose inline plaintext rebinds to its signed hash.
    const withPayload = Array.isArray(bundle.events) ? bundle.events.filter((e) => e && e.payload != null).length : 0;
    A_cov = A_cov_unweighted = (integrityOk && n > 0) ? withPayload / n : 0;
    requiredCount = n; verifiedCount = withPayload;
  }

  // Lineage: a verified chain reaches the sealed decision at full depth; a break at seq k
  // leaves events [0..k-1] connected and everything from k onward disconnected + invalidated.
  const connectedPrefix = integrityOk ? n : (typeof firstFailureSeq === "number" ? firstFailureSeq : 0);
  const C_lin = n > 0 ? connectedPrefix / n : 1;          // lineage connectivity
  const R_disc = 1 - C_lin;                                 // disconnected-evidence rate
  const lineageDepth = connectedPrefix;                    // longest verified source→decision path
  const D_norm = n > 0 ? lineageDepth / n : 0;             // normalized depth
  const P_fail = (!integrityOk && typeof firstFailureSeq === "number" && n > 0)
    ? (n - firstFailureSeq) / n : 0;                       // proportion invalidated after first failure

  // A_total = α A_cov + β C_lin + γ D_norm − δ R_disc − η P_fail   (clamped to [0,1])
  const raw = w.alpha * A_cov + w.beta * C_lin + w.gamma * D_norm - w.delta * R_disc - w.eta * P_fail;
  const unifiedScore = clamp01(raw);

  return {
    integrityOk,
    sourceResolution: verified.sourceResolution ?? null,
    auditCompleteness: A_cov,
    auditCompletenessUnweighted: A_cov_unweighted,
    lineageConnectivity: C_lin,
    disconnectedRate: R_disc,
    lineageDepth,
    lineageDepthNormalized: D_norm,
    firstFailureSeq,
    firstFailureReason,
    failInvalidatedProportion: P_fail,
    unifiedScore,
    requiredCount,
    verifiedCount,
    weights: w,
  };
}
