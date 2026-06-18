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
      const { text } = await callGlm({ systemPrompt, userMessage, maxTokens: 220 });
      return text;
    }
    const response = await anthropicClient.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 220,
      system: systemPrompt,
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

    const followupSys = "You generate a single follow-up question that a VP would ask next, given a council deliberation. One sentence, ending with a question mark.";
    const followupUser = `Original question: ${userQuestion}\n\nJunior voice: ${junior}\n\nSenior voice: ${senior}\n\nCompliance voice: ${third}\n\nWhat is the single most important follow-up question?`;

    let followup, model;
    if (provider === "glm") {
      const r = await callGlm({ systemPrompt: followupSys, userMessage: followupUser, maxTokens: 80 });
      followup = r.text;
      model = r.model;
    } else {
      const followupResponse = await anthropicClient.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 80,
        system: followupSys,
        messages: [{ role: "user", content: followupUser }]
      });
      followup = followupResponse.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
      model = CLAUDE_MODEL;
    }

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
