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
import { PERSONA_PROMPTS, SCENARIO_CONTEXTS } from "../lib/prompts.js";

const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";
const CLAUDE_HAIKU_MODEL = "claude-haiku-4-5-20251001";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { persona = "compliance", scenario = "lbo", question, context, provider = "anthropic" } = req.body || {};

  if (provider !== "anthropic" && provider !== "glm") {
    return res.status(400).json({ error: `unknown provider: ${provider}. Use "anthropic" or "glm".` });
  }
  if (provider === "anthropic" && !process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }
  if (provider === "glm" && !process.env.GLM_API_KEY) {
    return res.status(500).json({ error: "GLM_API_KEY not configured. Set in Vercel project env." });
  }
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
    const [junior, senior, third] = await Promise.all([
      callVoice(prompts.junior),
      callVoice(prompts.senior),
      callVoice(prompts.third)
    ]);

    // v0.3 — followup hard-capped 180 chars + forced terminal '?'
    const followupSys = "You generate exactly ONE follow-up question a VP would ask next. HARD LIMIT: MAXIMUM 180 characters total. Must end with a question mark. No preamble. No 'Follow-up:' prefix. Just the question.";
    const followupUser = `Original: ${userQuestion}\n\nJunior: ${junior}\n\nSenior: ${senior}\n\nCompliance: ${third}\n\nThe single most important follow-up question (max 180 chars, ends with ?):`;

    let followup, model;
    if (provider === "glm") {
      const r = await callGlm({ systemPrompt: followupSys, userMessage: followupUser, maxTokens: 50 });
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
    return res.status(200).json({
      junior,
      senior,
      third,
      followup,
      latency_ms,
      model,
      provider,
      persona,
      scenario
    });
  } catch (err) {
    const latency_ms = Date.now() - t0;
    return res.status(500).json({
      error: err?.message ?? String(err),
      latency_ms,
      hint: "Check the ANTHROPIC_API_KEY env var in Vercel project settings"
    });
  }
}
