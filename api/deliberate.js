// POST /api/deliberate
// Body: { persona, scenario, question, context }
// Returns: { junior, senior, third, followup, latency_ms, model }
//
// Runs three council voices in parallel against Anthropic Claude Sonnet 4.6
// using persona-specific system prompts. The ANTHROPIC_API_KEY env var must
// be set in the Vercel project. No PII leaves the customer environment in
// production — this Vercel demo is intentionally non-production (cloud LLM)
// to prove the council pattern, not to ship enterprise data through it.

import Anthropic from "@anthropic-ai/sdk";
import { callGlm } from "../lib/glm-call.js";
import { callLocalLlm } from "../lib/local-llm-call.js";
import { PERSONA_PROMPTS, SCENARIO_CONTEXTS } from "../lib/prompts.js";
import { runLoanCouncil } from "../lib/run-loan-council.js";
import { validateLoan } from "../lib/schemas/loan.js";
import { buildAttestation } from "../lib/attestation.js";
import {
  assignProvidersToVoices,
  detectAvailableProviders,
} from "../lib/provider-diversity.js";
import { callVoicesDiversely } from "../lib/diverse-caller.js";

const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";
const CLAUDE_HAIKU_MODEL = "claude-haiku-4-5-20251001";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { persona = "compliance", scenario = "lbo", question, context, provider = "anthropic", loan, diverse = false } = req.body || {};

  // 2026-06-30 wire-in: provider="local" routes to Ollama / llama.cpp
  // OpenAI-compat endpoint (default phi4-mini @ http://127.0.0.1:11434/v1).
  // Enables the cold-email "Runs on your laptop, zero data egress" demo
  // cell from the IEEE VR 2027 paper Section 7.2 and the mid-July Y.U.
  // Dean + VP demo. No API key required — caller's local Ollama install
  // is the auth boundary.
  if (provider !== "anthropic" && provider !== "glm" && provider !== "local") {
    return res.status(400).json({ error: `unknown provider: ${provider}. Use "anthropic", "glm", or "local".` });
  }
  if (provider === "anthropic" && !process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }
  if (provider === "glm" && !process.env.GLM_API_KEY) {
    return res.status(500).json({ error: "GLM_API_KEY not configured. Set in Vercel project env." });
  }
  // local provider has no key check — it's an offline endpoint reachable
  // only when the caller has Ollama running. callLocalLlm() throws an
  // actionable "Is Ollama running? Try: ollama serve" message on connect
  // refusal, surfaced to the caller below in the catch block.
  if (!PERSONA_PROMPTS[persona]) {
    return res.status(400).json({ error: `unknown persona: ${persona}` });
  }
  if (!SCENARIO_CONTEXTS[scenario]) {
    return res.status(400).json({ error: `unknown scenario: ${scenario}` });
  }

  const prompts = PERSONA_PROMPTS[persona];
  const scenarioContext = context || SCENARIO_CONTEXTS[scenario];
  const userQuestion = question || `Explain a useful angle on this ${scenario} screen for a ${persona} persona.`;

  const userMessage = `Scenario context:\n${scenarioContext}\n\nUser question: ${userQuestion}\n\nRespond with a single paragraph in your voice. No preamble. Plain prose.`;

  const t0 = Date.now();
  const anthropicClient = provider === "anthropic" ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

  async function callVoice(systemPrompt) {
    if (provider === "glm") {
      const { text } = await callGlm({ systemPrompt, userMessage, maxTokens: 180 });
      return text;
    }
    if (provider === "local") {
      const { text } = await callLocalLlm({ systemPrompt, userMessage, maxTokens: 180 });
      return text;
    }
    const response = await anthropicClient.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 180,
      // v0.2 prompt caching on persona system prompt
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage }]
    });
    return response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
  }

  try {
    // 2026-07-03: per-voice diverse routing wire-in (delivered on
    // the promise from 77aab89). When `diverse: true` in the request
    // body AND at least 2 providers have keys configured, each of
    // the 3 voices routes to a different provider (deterministically
    // assigned based on request seed). Anti-hallucination-
    // amplification defense per corpora.ai + Free-MAD.
    let junior, senior, third;
    let diverseRoutingUsed = false;
    let diverseRoutingResult = null;

    const availableProvidersForDiverse = detectAvailableProviders(process.env);
    const canRouteDiversely = diverse === true && availableProvidersForDiverse.length >= 2;

    if (canRouteDiversely) {
      // Build providerCallers map on the fly. Each caller matches
      // the callProvider({systemPrompt, userMessage, maxTokens}) →
      // {text, model} contract in lib/diverse-caller.js.
      const providerCallers = {};
      if (availableProvidersForDiverse.includes("anthropic")) {
        const ac = anthropicClient || new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        providerCallers.anthropic = async ({ systemPrompt, userMessage, maxTokens }) => {
          const r = await ac.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: maxTokens,
            system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content: userMessage }],
          });
          const text = r.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
          return { text, model: CLAUDE_MODEL };
        };
      }
      if (availableProvidersForDiverse.includes("glm")) {
        providerCallers.glm = async ({ systemPrompt, userMessage, maxTokens }) =>
          callGlm({ systemPrompt, userMessage, maxTokens });
      }
      if (availableProvidersForDiverse.includes("local")) {
        providerCallers.local = async ({ systemPrompt, userMessage, maxTokens }) =>
          callLocalLlm({ systemPrompt, userMessage, maxTokens });
      }

      diverseRoutingResult = await callVoicesDiversely({
        prompts: {
          junior: prompts.junior,
          senior: prompts.senior,
          third: prompts.third,
        },
        userMessage,
        maxTokens: 180,
        availableProviders: availableProvidersForDiverse,
        providerCallers,
        seed: { persona, scenario, provider },
      });
      junior = diverseRoutingResult.voice_results.junior?.text || "";
      senior = diverseRoutingResult.voice_results.senior?.text || "";
      third = diverseRoutingResult.voice_results.third?.text || "";
      diverseRoutingUsed = true;
    } else {
      [junior, senior, third] = await Promise.all([
        callVoice(prompts.junior),
        callVoice(prompts.senior),
        callVoice(prompts.third)
      ]);
    }

    // v0.3 — followup hard-capped 180 chars + forced terminal '?'
    const followupSys = "You generate exactly ONE follow-up question a VP would ask next. HARD LIMIT: MAXIMUM 180 characters total. Must end with a question mark. No preamble. No 'Follow-up:' prefix. Just the question.";
    const followupUser = `Original: ${userQuestion}\n\nJunior: ${junior}\n\nSenior: ${senior}\n\nCompliance: ${third}\n\nThe single most important follow-up question (max 180 chars, ends with ?):`;

    let followup, model;
    if (provider === "glm") {
      const r = await callGlm({ systemPrompt: followupSys, userMessage: followupUser, maxTokens: 50 });
      followup = r.text;
      model = r.model;
    } else if (provider === "local") {
      const r = await callLocalLlm({ systemPrompt: followupSys, userMessage: followupUser, maxTokens: 50 });
      followup = r.text;
      model = r.model;
    } else {
      const followupResponse = await anthropicClient.messages.create({
        model: CLAUDE_HAIKU_MODEL,
        max_tokens: 50,
        system: followupSys,
        messages: [{ role: "user", content: followupUser }]
      });
      followup = followupResponse.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
      model = CLAUDE_MODEL;
    }
    // strip common preambles + force terminal ?
    followup = followup.replace(/^(Follow-up question:|Follow-up:|Question:)\s*/i, "").trim();
    if (!/\?$/.test(followup)) followup = followup.replace(/[.!]+$/, "") + "?";

    const latency_ms = Date.now() - t0;

    // 2026-07-03: provider-diversity now supports ACTUAL routing when
    // `body.diverse === true` + ≥2 providers configured. When diverse
    // routing fires, diversityDiag reflects the assignment that was
    // actually used. Otherwise it's still diagnostic-only (as before).
    const availableProviders = detectAvailableProviders(process.env);
    const diversityDiag = diverseRoutingUsed && diverseRoutingResult
      ? {
          assignment: diverseRoutingResult.assignment,
          diversity_score: diverseRoutingResult.diversity_score,
          unique_providers_used: diverseRoutingResult.unique_providers_used,
          providers_available_count: diverseRoutingResult.providers_available_count,
          assignment_method: "shuffle_and_walk_v1",
        }
      : assignProvidersToVoices(
          ["junior", "senior", "third"],
          availableProviders,
          { persona, scenario, provider },
        );

    const response = {
      junior,
      senior,
      third,
      followup,
      latency_ms,
      model,
      provider,
      persona,
      scenario,
      // Diversity report. When `body.diverse === true` and ≥2
      // providers are configured, `actually_routed_diverse: true`
      // and `per_voice_models` shows the actual model_ids per voice
      // (defense against silent model substitution across the
      // council). Otherwise diagnostic-only.
      provider_diversity: {
        ...diversityDiag,
        actually_routed_diverse: diverseRoutingUsed,
        per_voice_models: diverseRoutingUsed && diverseRoutingResult
          ? diverseRoutingResult.per_voice_models
          : null,
        note: diverseRoutingUsed
          ? "Per-voice routing fired. Each voice ran on a different provider per the assignment map above."
          : "Diagnostic only. All voices ran on the single `provider` field above. Pass `diverse: true` in request body + configure ≥2 provider env vars to enable per-voice routing.",
      },
    };

    // LBO scenario + loan dict → augment with deterministic verdict layer
    // (Loredana's 5-voice rule resolver from Mode A package). Gated to LBO
    // so other scenarios keep advisory tone without a rule verdict.
    if (scenario === "lbo" && loan) {
      const v = validateLoan(loan);
      if (v.valid) {
        const council = runLoanCouncil(loan);
        response.verdict = council.final_verdict;
        response.loan_council = council;
      } else {
        response.verdict_validation_errors = v.errors;
      }
    }

    // AEX-style attestation binding request → output → model.
    // 2026-07-02 upgrade. See lib/attestation.js docstring for refs.
    // Unlike /api/loan-council which is pure-compute, /api/deliberate
    // fires actual LLM calls — the model_id here reflects the actual
    // provider/model used so an auditor can detect silent substitution.
    response.attestation = buildAttestation({
      request: req.body ?? {},
      response,
      modelId: `${provider ?? "unknown"}/${model ?? "unknown"}`,
    });

    return res.status(200).json(response);
  } catch (err) {
    const latency_ms = Date.now() - t0;
    return res.status(500).json({
      error: err?.message ?? String(err),
      latency_ms,
      hint: "Check the ANTHROPIC_API_KEY env var in Vercel project settings"
    });
  }
}
