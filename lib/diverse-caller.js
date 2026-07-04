// lib/diverse-caller.js
// ──────────────────────────────────────────────────────────────────
// Per-voice diverse LLM routing for /api/deliberate.
//
// Completes the "per-voice diverse ROUTING" ship promised in commit
// 77aab89 (which shipped the diagnostic-only provider-diversity
// primitive). This module actually routes different voices to
// different providers when `diverse: true` is requested.
//
// Design: dependency injection
// ----------------------------
// The module doesn't import Anthropic / GLM / local clients directly
// — it accepts a `providerCallers` map at call time. Tests inject
// fakes that return canned text without needing live API keys. The
// production caller (api/deliberate.js) wires real Anthropic /
// callGlm / callLocalLlm calls into the same shape.
//
// The provider-caller contract
// ----------------------------
// Each entry in the `providerCallers` map is an async function:
//
//     async function callProvider({ systemPrompt, userMessage,
//                                    maxTokens }) {
//       return { text: string, model: string };
//     }
//
// The provider names are the keys ('anthropic', 'glm', 'local').
//
// Anti-amplification defense
// --------------------------
// Refs corpora.ai Hallucination Amplification in Multi-Agent Debate
// + Free-MAD arxiv 2509.11035 + Zhu et al. arxiv 2601.19921 — when
// all voices share a base model + training data, debates AMPLIFY
// hallucinations. Routing each voice to a different provider is the
// first-class defense.

import { assignProvidersToVoices } from "./provider-diversity.js";


/**
 * Call each voice against its assigned provider in parallel.
 *
 * @param {object} params
 * @param {Record<string, string>} params.prompts — { voiceName: systemPrompt }
 * @param {string} params.userMessage
 * @param {number} [params.maxTokens=180]
 * @param {string[]} params.availableProviders — e.g. ["anthropic","glm"]
 * @param {Record<string, Function>} params.providerCallers — see contract above
 * @param {string|object} params.seed — for deterministic assignment
 * @returns {Promise<{
 *   voice_results: Record<string, {text, model, provider}>,
 *   assignment: Record<string, string>,
 *   diversity_score: number,
 *   unique_providers_used: number,
 *   providers_available_count: number,
 *   per_voice_models: Record<string, string>,
 * }>}
 */
export async function callVoicesDiversely({
  prompts,
  userMessage,
  maxTokens = 180,
  availableProviders,
  providerCallers,
  seed = "default-seed",
}) {
  const voiceNames = Object.keys(prompts || {});
  if (voiceNames.length === 0) {
    return {
      voice_results: {},
      assignment: {},
      diversity_score: 0,
      unique_providers_used: 0,
      providers_available_count: 0,
      per_voice_models: {},
    };
  }

  const diversity = assignProvidersToVoices(voiceNames, availableProviders, seed);

  const voiceResults = {};
  const perVoiceModels = {};

  // Fire all voice calls in parallel. Each dispatches to the
  // assigned provider's caller. If a provider is unavailable
  // (missing key + missing fallback), the caller is expected to
  // throw — we DON'T silently substitute a different provider
  // because that would defeat the whole point of diverse routing.
  await Promise.all(voiceNames.map(async (voiceName) => {
    const provider = diversity.assignment[voiceName];
    if (!provider) {
      voiceResults[voiceName] = {
        text: null, model: null, provider: null,
        error: "no provider assigned",
      };
      return;
    }
    const caller = providerCallers[provider];
    if (typeof caller !== "function") {
      voiceResults[voiceName] = {
        text: null, model: null, provider,
        error: `no caller for provider "${provider}"`,
      };
      return;
    }
    try {
      const { text, model } = await caller({
        systemPrompt: prompts[voiceName],
        userMessage,
        maxTokens,
      });
      voiceResults[voiceName] = { text, model, provider };
      perVoiceModels[voiceName] = `${provider}/${model ?? "unknown"}`;
    } catch (err) {
      voiceResults[voiceName] = {
        text: null, model: null, provider,
        error: err?.message ?? String(err),
      };
    }
  }));

  return {
    voice_results: voiceResults,
    assignment: diversity.assignment,
    diversity_score: diversity.diversity_score,
    unique_providers_used: diversity.unique_providers_used,
    providers_available_count: diversity.providers_available_count,
    per_voice_models: perVoiceModels,
  };
}
