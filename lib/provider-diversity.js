// lib/provider-diversity.js
// ──────────────────────────────────────────────────────────────────
// Provider diversity for the deliberation council — an anti-
// hallucination-amplification enforcer.
//
// Ships 2026-07-02 based on:
// - "Hallucination Amplification in Multi-Agent Debate" (corpora.ai)
//   which warned that debates AMPLIFY hallucinations when all agents
//   share a prior (same base model, same training data).
// - Free-MAD: Consensus-Free Multi-Agent Debate (arXiv:2509.11035)
//   which recommends diverse providers as first-class defense.
// - Zhu et al. "Demystifying Multi-Agent Debate" (arXiv:2601.19921)
//   which showed provider DIVERSITY is one of the two variables
//   (along with confidence calibration) that actually improves
//   aggregation quality.
//
// Design
// ------
// Given a list of voice names + a list of available LLM providers,
// deterministically ASSIGN each voice to a provider such that the
// assignment maximizes provider diversity subject to the constraint
// that each voice is deterministic-per-request (same request →
// same assignment, for audit reproducibility).
//
// If only ONE provider is available (e.g. only ANTHROPIC_API_KEY is
// set), all voices route to that provider and diversity_score = 0.
// The response body should surface this so procurement can see the
// deployment isn't achieving multi-provider defense.
//
// Diversity score
// ---------------
// score = (unique_providers_used / min(nVoices, nProviders))
//
// Examples:
// - 3 voices, 3 providers, all used → 3/3 = 1.0 (best)
// - 3 voices, 2 providers, both used → 2/2 = 1.0 (best given constraint)
// - 3 voices, 3 providers, all Anthropic → 1/3 = 0.33 (bad)
// - 3 voices, 1 provider available → 1/1 = 1.0 (best given constraint;
//   surfaced with a separate `providers_available_count` field so
//   procurement sees the ceiling)
//
// Ref
// ---
// - Hallucination Amplification in Multi-Agent Debate (corpora.ai)
// - arxiv 2509.11035 Free-MAD
// - arxiv 2601.19921 Demystifying Multi-Agent Debate

import { createHash } from "node:crypto";


/**
 * Deterministically assign voice names to providers such that
 * diversity is maximized.
 *
 * @param {string[]} voiceNames — e.g. ["junior", "senior", "third"]
 * @param {string[]} availableProviders — e.g. ["anthropic","glm","local"]
 * @param {string|object} [seed] — request-derived seed for determinism.
 *   Same seed → same assignment (auditable).
 * @returns {{
 *   assignment: {[voiceName: string]: string},
 *   diversity_score: number,          // in [0, 1]
 *   unique_providers_used: number,
 *   providers_available_count: number,
 *   assignment_method: string,
 * }}
 */
export function assignProvidersToVoices(voiceNames, availableProviders,
                                          seed = "default-seed") {
  const providers = Array.isArray(availableProviders)
    ? availableProviders.filter((p) => typeof p === "string" && p.length > 0)
    : [];

  if (!Array.isArray(voiceNames) || voiceNames.length === 0) {
    return {
      assignment: {},
      diversity_score: 0,
      unique_providers_used: 0,
      providers_available_count: providers.length,
      assignment_method: "no_voices_v1",
    };
  }

  if (providers.length === 0) {
    return {
      assignment: Object.fromEntries(voiceNames.map((v) => [v, null])),
      diversity_score: 0,
      unique_providers_used: 0,
      providers_available_count: 0,
      assignment_method: "no_providers_v1",
    };
  }

  // The core insight: if you just do voiceName % nProviders you get
  // deterministic assignment but always the same providers in the
  // same slots. Fine, but not the best for procurement — auditors
  // want to see the assignment vary across requests (audit spread).
  //
  // Better: seed a Fisher-Yates shuffle of the providers list, then
  // walk voices in order, assigning provider[i % nProviders]. The
  // seed makes the shuffle deterministic per request.

  const seedString = typeof seed === "string" ? seed : JSON.stringify(seed);
  const seedHex = createHash("sha256").update(seedString).digest("hex");
  let state = BigInt("0x" + seedHex.slice(0, 16));
  if (state === 0n) state = 1n;
  const nextInt = (max) => {
    state ^= state << 13n;
    state ^= state >> 7n;
    state ^= state << 17n;
    state &= 0xffffffffffffffffn;
    return Number(state % BigInt(max));
  };

  const shuffled = [...providers];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = nextInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const assignment = {};
  const usedProviders = new Set();
  for (let i = 0; i < voiceNames.length; i++) {
    const p = shuffled[i % shuffled.length];
    assignment[voiceNames[i]] = p;
    usedProviders.add(p);
  }

  const diversityCeiling = Math.min(voiceNames.length, providers.length);
  const diversity_score = diversityCeiling > 0
    ? usedProviders.size / diversityCeiling
    : 0;

  return {
    assignment,
    diversity_score: Number(diversity_score.toFixed(4)),
    unique_providers_used: usedProviders.size,
    providers_available_count: providers.length,
    assignment_method: "shuffle_and_walk_v1",
  };
}


/**
 * Detect which providers are configured via env vars. Read once per
 * request — the deploy env is stable per process but this is a cheap
 * check so we don't cache.
 *
 * @param {object} [env] — override for tests. Defaults to process.env.
 * @returns {string[]} — subset of ["anthropic", "glm", "local"] that
 *   have the required env vars set. "local" is always assumed
 *   available if SHADOW_LOCAL_LLM_URL is set (local Ollama).
 */
export function detectAvailableProviders(env = process.env) {
  const available = [];
  if (env.ANTHROPIC_API_KEY) available.push("anthropic");
  if (env.GLM_API_KEY) available.push("glm");
  if (env.SHADOW_LOCAL_LLM_URL || env.OLLAMA_HOST) available.push("local");
  return available;
}


/**
 * Compute a diversity report for a set of voices — used by callers
 * that want to log or surface the diversity outcome even if they
 * aren't actually routing across providers.
 */
export function diversityReport(voiceNames, availableProviders, seed) {
  return assignProvidersToVoices(voiceNames, availableProviders, seed);
}
