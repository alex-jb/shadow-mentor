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
import { sizePosition } from "../lib/personas/trader-pack/risk-sizer.js";
import { runDSCouncil } from "../lib/personas/ds-pack/run-ds-council.js";
import { defaultStore as chainStore } from "../lib/attestation-chain-store.js";
import { formatForSiem } from "../lib/siem-export.js";
// v1.5.34 wire-in: heterogeneity enforcement + reproducibility manifest
// at the API surface. Both primitives ship in v1.5.32/33; this makes
// them visible to callers (procurement, exam workpaper) without
// changing default behavior when the caller does not opt in.
import {
  enforceAndCommit,
  DEFAULT_MIN_PROVIDERS,
} from "../lib/heterogeneous-debate.js";
import { buildReproducibilityManifest } from "../lib/reproducibility.js";
import { computeDictionaryHash } from "../lib/enforce-reason-code-dictionary.js";

const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";
const CLAUDE_HAIKU_MODEL = "claude-haiku-4-5-20251001";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const body = req.body || {};

  // v0.2 trader-pack dispatch (2026-07-07). When mode === "trading", the
  // caller passes a trade proposal + Kelly params and we run the Risk
  // Sizer voice from lib/personas/trader-pack. No LLM calls — this is
  // the pure-computation trading path so the cross-vertical wire-format
  // claim is testable end-to-end before the LangGraph port lands (v0.3).
  //
  // Contract invariants preserved from Orallexa v1.2.0:
  //   1. Risk Sizer never emits a direction — Judge (upstream) owns it.
  //   2. Position respects max_kelly_cap and volatility scalar.
  //   3. no_op direction → skip verdict, position_usd = null.
  //
  // Not yet included: Bull/Bear/Judge/Critic/Polyseer LLM voices (v0.3
  // HTTP proxy path to Orallexa live deployment).
  if (body.mode === "trading") {
    const t0Trading = Date.now();
    const tradeInput = body.trade;
    if (!tradeInput || typeof tradeInput !== "object") {
      return res.status(400).json({
        error: "mode=trading requires `trade` object with direction, bankroll_usd, volatility_regime, kelly_p_win, kelly_avg_win_pct, kelly_avg_loss_pct",
      });
    }
    const required = ["direction", "bankroll_usd", "volatility_regime", "kelly_p_win", "kelly_avg_win_pct", "kelly_avg_loss_pct"];
    for (const key of required) {
      if (tradeInput[key] === undefined || tradeInput[key] === null) {
        return res.status(400).json({ error: `trade.${key} is required for mode=trading` });
      }
    }
    if (!["long", "short", "no_op"].includes(tradeInput.direction)) {
      return res.status(400).json({ error: `trade.direction must be "long", "short", or "no_op", got "${tradeInput.direction}"` });
    }
    if (!["low", "medium", "high"].includes(tradeInput.volatility_regime)) {
      return res.status(400).json({ error: `trade.volatility_regime must be "low", "medium", or "high"` });
    }
    let sizerOut;
    try {
      sizerOut = sizePosition(tradeInput);
    } catch (err) {
      return res.status(400).json({ error: `Risk Sizer input invalid: ${err.message}` });
    }
    const tradingResponse = {
      mode: "trading",
      voices: [sizerOut],
      verdict: sizerOut.verdict,
      trader_pack_version: "v0.2",
      latency_ms: Date.now() - t0Trading,
    };
    // v0.2.1 attestation (2026-07-07): trading verdicts now sign the same
    // way banking verdicts do, so bank counsel + trading desk audit
    // trails share ONE Ed25519 key + ONE signing-payload format.
    // Cross-vertical hash-chain continuity (single monotone attestation
    // chain across banking + trading) still deferred to v0.4.
    //
    // modelId here is deterministic — trading v0.2 is pure computation
    // (no LLM), so the audit surface pins the risk-sizer version. When
    // v0.3 LangGraph voices ship, this will become a composite id like
    // "anthropic/sonnet-4-6+shadow/trader-pack-risk-sizer@v0.3".
    tradingResponse.attestation = buildAttestation({
      request: body,
      response: tradingResponse,
      modelId: "shadow/trader-pack-risk-sizer@v0.2",
      previousHash: chainStore.getPreviousHash(),
    });
    // v1.5.16 cross-vertical chain — advance the shared head so the
    // next decision (regardless of mode) chains to this one.
    chainStore.recordAttestation(tradingResponse.attestation);
    return res.status(200).json(tradingResponse);
  }

  // v0.2 ds-pack dispatch (2026-07-07). When mode === "ds", the caller
  // passes an MLArtifactRef and the pure-computation 5-voice DS
  // governance council runs. No LLM. Same attestation contract as
  // banking + trading, so a bank SIEM that trusts one trusts them all.
  //
  // Contract invariants:
  //   1. Conservative aggregation — ANY BLOCK → BLOCK, ANY REWORK →
  //      REWORK, ALL SHIP → SHIP.
  //   2. Fair-ML disparate-impact ratio < 0.80 (EEOC 80% rule) always
  //      BLOCKS regardless of other voices.
  //   3. Missing required metadata (artifact_id + feature_columns)
  //      always REWORKS — no ship-review without provenance.
  if (body.mode === "ds") {
    const t0DS = Date.now();
    const dsInput = body.ds ?? {};
    if (!dsInput.artifact || typeof dsInput.artifact !== "object") {
      return res.status(400).json({
        error: "mode=ds requires `ds.artifact` object (MLArtifactRef). See lib/personas/ds-pack/types.js.",
      });
    }
    if (dsInput.lifecycle_stage && !["pre_deploy", "post_deploy_monitor", "decommission"].includes(dsInput.lifecycle_stage)) {
      return res.status(400).json({
        error: `ds.lifecycle_stage must be pre_deploy | post_deploy_monitor | decommission, got "${dsInput.lifecycle_stage}"`,
      });
    }
    let dsOut;
    try {
      dsOut = runDSCouncil(dsInput);
    } catch (err) {
      return res.status(400).json({ error: `DS council input invalid: ${err.message}` });
    }
    const dsResponse = {
      mode: "ds",
      voices: dsOut.voices,
      verdict: dsOut.verdict,
      governance_packet: dsOut.governance_packet,
      adverse_action_codes: dsOut.adverse_action_codes,
      ds_pack_version: dsOut.ds_pack_version,
      latency_ms: Date.now() - t0DS,
    };
    dsResponse.attestation = buildAttestation({
      request: body,
      response: dsResponse,
      modelId: "shadow/ds-pack@v0.2",
      previousHash: chainStore.getPreviousHash(),
    });
    // v1.5.16 cross-vertical chain
    chainStore.recordAttestation(dsResponse.attestation);
    return res.status(200).json(dsResponse);
  }

  const {
    persona = "compliance",
    scenario = "lbo",
    question,
    context,
    provider = "anthropic",
    loan,
    diverse = false,
    // v1.5.34: heterogeneity enforcement opt-in. Default false (back-compat).
    strict_heterogeneity = false,
    min_providers = DEFAULT_MIN_PROVIDERS,
  } = body;

  // v1.5.34: heterogeneity pre-flight gate. When the caller opts into
  // strict mode, refuse deliberation BEFORE any LLM call if the
  // deployment does not meet the min-provider floor. This protects
  // bank-regulated workflows from silently accepting decisions that
  // structurally fail the arXiv:2606.19826 adversarial-peer defense.
  // Non-strict callers see zero behavior change.
  if (strict_heterogeneity === true) {
    const availableForGate = detectAvailableProviders(process.env);
    const gate = enforceAndCommit({
      voiceNames: ["junior", "senior", "third"],
      availableProviders: availableForGate,
      minProviders: min_providers,
      seed: { persona, scenario, provider, strict_heterogeneity: true },
    });
    if (!gate.ok) {
      // HTTP 428 Precondition Required — the deployment failed the
      // caller's declared enforcement precondition. Bank counsel can
      // pin this response class in procurement contracts.
      return res.status(428).json({
        error: "heterogeneity_floor_not_met",
        reason: gate.reason,
        min_required: gate.min_required,
        unique_providers_used: gate.unique_providers_used,
        providers_available_count: gate.providers_available_count,
        anchor: "arXiv:2606.19826",
      });
    }
  }

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

    // v1.5.34: compute heterogeneity commitment for THIS decision so
    // it can be included in the response body AND bound into the
    // attestation. Fires regardless of strict_heterogeneity (gate was
    // already resolved above); this is the audit-trail record.
    const actualProvidersSet = diverseRoutingUsed && diverseRoutingResult
      ? [...new Set(Object.values(diverseRoutingResult.assignment).filter(Boolean))].sort()
      : [provider];
    const heterogeneityEnforcement = enforceAndCommit({
      voiceNames: ["junior", "senior", "third"],
      availableProviders: actualProvidersSet,
      minProviders: min_providers,
      seed: { persona, scenario, provider, actual: true },
    });
    response.heterogeneity_enforcement = {
      ok: heterogeneityEnforcement.ok,
      min_required: heterogeneityEnforcement.min_required,
      unique_providers_used: heterogeneityEnforcement.unique_providers_used,
      providers_used_sorted: heterogeneityEnforcement.providers_used_sorted,
      commitment_sha256: heterogeneityEnforcement.commitment_sha256,
      strict_mode_requested: strict_heterogeneity === true,
      anchor: "arXiv:2606.19826",
    };

    // AEX-style attestation binding request → output → model.
    // 2026-07-02 upgrade. See lib/attestation.js docstring for refs.
    // Unlike /api/loan-council which is pure-compute, /api/deliberate
    // fires actual LLM calls — the model_id here reflects the actual
    // provider/model used so an auditor can detect silent substitution.
    // v1.5.34: bind heterogeneity_commitment_sha256 into attestation
    // so post-hoc relaxation of min_providers breaks Ed25519 verify.
    response.attestation = buildAttestation({
      request: req.body ?? {},
      response,
      modelId: `${provider ?? "unknown"}/${model ?? "unknown"}`,
      previousHash: chainStore.getPreviousHash(),
      heterogeneityCommitmentSha256: heterogeneityEnforcement.commitment_sha256,
    });

    // v1.5.34: reproducibility manifest per arXiv:2606.08285. Composes
    // the existing per-decision hashes into a single 5-axis JSON block
    // bank counsel pins in one line of an exam workpaper. Not signed
    // itself — the manifest_hash is a fingerprint over the input state.
    let dictionaryHashForManifest = null;
    try { dictionaryHashForManifest = computeDictionaryHash(); } catch { /* dict optional */ }
    response.reproducibility_manifest = buildReproducibilityManifest({
      borrowerSnapshotHash: response.attestation.request_commitment,
      decisionTimestampUtc: response.attestation.completed_at_utc,
      modelId: response.attestation.model_id,
      providersUsedSorted: actualProvidersSet,
      nodeVersion: process.version,
      dictionaryHash: dictionaryHashForManifest,
      heterogeneityCommitmentHash: heterogeneityEnforcement.commitment_sha256,
    });
    // v1.5.16 cross-vertical chain — advance the shared head so the
    // next decision (banking / trading / ds) chains to this one. This
    // is what makes the "one Shadow engine, three verticals" claim
    // verifiable via a single POST /api/verify-chain call over the
    // mixed-mode response log.
    chainStore.recordAttestation(response.attestation);

    // v1.5.22 (2026-07-08) — SIEM-native export via query param.
    // ?format=cef → ArcSight CEF plain-text line
    // ?format=cim or ?format=splunk → Splunk CIM Alerts JSON
    // Default → the historical JSON shape (back-compat).
    const siemFormat = (req.query?.format || "").toString();
    if (siemFormat === "cef" || siemFormat === "cim" || siemFormat === "splunk") {
      const { body, contentType } = formatForSiem(response, siemFormat);
      res.setHeader("Content-Type", contentType);
      return res.status(200).send(body);
    }

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
