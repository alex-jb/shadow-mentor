// lib/heterogeneous-debate.js
// ──────────────────────────────────────────────────────────────────
// v1.5.32 (2026-07-08). Enforces min-provider heterogeneity across
// the deliberation council. Flips v1.4.0's diagnostic
// `diversity_score` into a first-class enforcement gate.
//
// Anchor: arXiv:2606.19826 — "Heterogeneous LLM Debate Under
// Adversarial Peers" (Nilayam et al., 2026-06-18). Proves that
// heterogeneity across model providers is a defense against an
// adversarial peer already present in the council: when one voice
// is compromised (silent prompt injection, adversarial-tuning
// backdoor, provider outage substitution), a homogeneous council
// amplifies that voice's error through debate; a heterogeneous
// council structurally weighs against it.
//
// Prior state (v1.4.0 → v1.5.31): provider-diversity.js computed a
// `diversity_score` and surfaced `providers_available_count` in the
// response body. Bank counsel could see it. Nothing enforced it —
// a deployment with `ANTHROPIC_API_KEY` set and nothing else would
// route all 5 voices to Anthropic and produce a score of 0.2 or so,
// then still return a verdict. The paper argues this is precisely
// the fail-open case an adversarial peer exploits.
//
// v1.5.32 flip: enforceHeterogeneousDebate() returns
// `{ ok: false }` when the deployment does not meet the min-provider
// threshold. Callers who wire this into /api/deliberate can choose
// to (a) refuse deliberation, (b) proceed with a warning, or
// (c) escalate to human review — the primitive is policy-agnostic.
// Default policy shipped in Shadow: refuse when strict mode is on.
//
// The attestation binding (heterogeneityCommitmentSha256) prevents
// a bank from silently relaxing the min-providers requirement after
// a decision — the commitment hash covers min_providers, the actual
// unique count, and the sorted set of providers used. Bank counsel
// pins this hash in procurement contracts alongside dictionary_hash.

import { createHash } from "node:crypto";
import { assignProvidersToVoices } from "./provider-diversity.js";


/**
 * Default minimum heterogeneity. Two providers is the arXiv:2606.19826
 * minimum-viable defense against a single-provider adversarial peer.
 * Three would defend against a two-provider collusion; Shadow does not
 * enforce three because most deployments cannot secure three provider
 * accounts on day one.
 */
export const DEFAULT_MIN_PROVIDERS = 2;


/**
 * Enforce that the current deployment meets the min-provider
 * heterogeneity threshold BEFORE calling any LLM. Runs on the same
 * inputs as `assignProvidersToVoices()` so the enforcement result
 * matches what the actual routing would produce.
 *
 * @param {object} params
 * @param {string[]} params.voiceNames — same as provider-diversity
 * @param {string[]} params.availableProviders — same as provider-diversity
 * @param {number} [params.minProviders=DEFAULT_MIN_PROVIDERS] — floor
 * @param {string|object} [params.seed] — same as provider-diversity
 * @returns {{
 *   ok: boolean,
 *   reason: string,
 *   unique_providers_used: number,
 *   providers_available_count: number,
 *   min_required: number,
 *   providers_used_sorted: string[],
 *   assignment: Record<string, string>,
 * }}
 */
export function enforceHeterogeneousDebate({
  voiceNames,
  availableProviders,
  minProviders = DEFAULT_MIN_PROVIDERS,
  seed = "default-seed",
} = {}) {
  if (!Number.isFinite(minProviders) || minProviders < 1) {
    return {
      ok: false,
      reason:
        `min_providers must be a positive integer; got ${minProviders}`,
      unique_providers_used: 0,
      providers_available_count: 0,
      min_required: minProviders,
      providers_used_sorted: [],
      assignment: {},
    };
  }

  const diversity = assignProvidersToVoices(
    voiceNames, availableProviders, seed,
  );

  const providersUsedSorted = [
    ...new Set(Object.values(diversity.assignment).filter(Boolean)),
  ].sort();

  const unique = providersUsedSorted.length;
  const meets = unique >= minProviders;

  if (!meets) {
    return {
      ok: false,
      reason:
        `Heterogeneity floor NOT met. Deliberation requires >= ` +
        `${minProviders} distinct LLM providers to defend against ` +
        `adversarial-peer amplification (arXiv:2606.19826). ` +
        `Current deployment has ${diversity.providers_available_count} ` +
        `configured, ${unique} used in assignment. Configure at ` +
        `least ${minProviders - unique} additional provider(s) ` +
        `(ANTHROPIC_API_KEY / GLM_API_KEY / SHADOW_LOCAL_LLM_URL).`,
      unique_providers_used: unique,
      providers_available_count: diversity.providers_available_count,
      min_required: minProviders,
      providers_used_sorted: providersUsedSorted,
      assignment: diversity.assignment,
    };
  }

  return {
    ok: true,
    reason:
      `Heterogeneity floor met: ${unique} distinct providers used ` +
      `(>= ${minProviders} required).`,
    unique_providers_used: unique,
    providers_available_count: diversity.providers_available_count,
    min_required: minProviders,
    providers_used_sorted: providersUsedSorted,
    assignment: diversity.assignment,
  };
}


/**
 * Compute a SHA-256 commitment binding the min-providers requirement
 * to the actual providers used, so the attestation locks the
 * enforcement outcome. Any post-hoc relaxation (silently lowering
 * min_providers, silently expanding the "used" set to claim
 * heterogeneity that wasn't there) breaks verification.
 *
 * The canonical form sorts the providers array so two decisions that
 * used the same set in different orders produce the same commitment.
 *
 * @param {object} params
 * @param {number} params.minProviders
 * @param {number} params.uniqueProvidersUsed
 * @param {string[]} params.providersUsedSorted — sorted set
 * @returns {string} SHA-256 hex
 */
export function heterogeneityCommitment({
  minProviders,
  uniqueProvidersUsed,
  providersUsedSorted,
}) {
  const canonical = JSON.stringify({
    min_providers: minProviders,
    unique_providers_used: uniqueProvidersUsed,
    providers_used_sorted: [...(providersUsedSorted || [])].sort(),
  });
  return createHash("sha256").update(canonical).digest("hex");
}


/**
 * Convenience: enforce + compute commitment in one call. Callers
 * that always want both get a single result object.
 *
 * @param {object} params — same as enforceHeterogeneousDebate
 * @returns {ReturnType<typeof enforceHeterogeneousDebate> & {commitment_sha256: string}}
 */
export function enforceAndCommit(params) {
  const enforcement = enforceHeterogeneousDebate(params);
  const commitment_sha256 = heterogeneityCommitment({
    minProviders: enforcement.min_required,
    uniqueProvidersUsed: enforcement.unique_providers_used,
    providersUsedSorted: enforcement.providers_used_sorted,
  });
  return { ...enforcement, commitment_sha256 };
}


/**
 * Detect a simulated adversarial-peer scenario for tests + audits.
 * If one provider produces text that structurally differs from all
 * others (approximated here by whether the assignment shows one
 * provider dominating >= 60% of voices while other providers exist),
 * flag it as a heterogeneity-collapse risk.
 *
 * This is a shape check, not a semantic adversarial detector. Real
 * adversarial-peer detection requires output-level analysis, which
 * runs in `test/adversarial/*.test.js` for named attack patterns.
 *
 * @param {Record<string, string>} assignment
 * @param {number} [dominanceThreshold=0.6]
 * @returns {{ dominant_provider: string|null, dominance_ratio: number, at_risk: boolean }}
 */
export function detectDominanceRisk(assignment, dominanceThreshold = 0.6) {
  const values = Object.values(assignment || {}).filter(Boolean);
  const total = values.length;
  if (total === 0) {
    return { dominant_provider: null, dominance_ratio: 0, at_risk: false };
  }
  const counts = {};
  for (const p of values) counts[p] = (counts[p] || 0) + 1;
  let dominant = null;
  let maxCount = 0;
  for (const [p, c] of Object.entries(counts)) {
    if (c > maxCount) { dominant = p; maxCount = c; }
  }
  const ratio = maxCount / total;
  const uniqueProviders = Object.keys(counts).length;
  return {
    dominant_provider: dominant,
    dominance_ratio: Number(ratio.toFixed(4)),
    at_risk: uniqueProviders > 1 && ratio >= dominanceThreshold,
  };
}
