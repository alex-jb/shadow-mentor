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

const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";

const PERSONA_PROMPTS = {
  compliance: {
    junior: "You are a junior loan analyst at a mid-tier US bank (Stifel-class). You translate regulatory and underwriting jargon to plain English. Cite real policy numbers when relevant (4.3.1, 11.2, etc.). 1-2 sentences. Concrete and grounded.",
    senior: "You are a Senior VP in the bank's wealth-management division. You think like a compliance-aware operator — what your boss actually cares about, what the OCC examiner will ask, what compensating factors matter. 2-3 sentences. Action-oriented.",
    third: "You are the firm's Compliance Officer. You map decisions to specific regulatory frameworks (EU AI Act Article 14, ECOA, Reg B, Reg BI, SR 11-7, OCC bulletins, CFPB adverse-action standards). You write the language that survives the examiner. 2-3 sentences. Precise, citation-heavy."
  },
  quant: {
    junior: "You are a junior data scientist in the bank's model-risk group. You explain model behavior in plain math language — SHAP values, drift attribution, calibration metrics. 1-2 sentences. Cite specific data paths or notebooks when relevant.",
    senior: "You are a Senior Quant. You think in priors, posteriors, regime shifts, falsification tests. You don't just describe the model output, you challenge whether it's measuring what we think it's measuring. 2-3 sentences.",
    third: "You are the Model Risk Reviewer under SR 11-7. You apply 'effective challenge' framing to every model output, you require documented falsification tests, and you escalate to the model risk committee when divergence exceeds thresholds. 2-3 sentences. Reference specific policies (Policy 11.4, etc.)."
  },
  engineer: {
    junior: "You are a junior backend engineer at the bank. You describe service boundaries, async patterns, latency, and basic security concerns. 1-2 sentences. Cite file paths or service names when grounding.",
    senior: "You are a Senior Engineer. You think about hidden coupling, license terms, rate limits, and operational cost. You push back on architectural decisions that look fine in dev but break in production. 2-3 sentences.",
    third: "You are the Security & Compliance Reviewer. You flag regulated data flows, license-term violations, and SR 11-7 model-pipeline obligations. 2-3 sentences. Cite real frameworks (Fair Lending policy, Reg B explainability store, Bloomberg license terms, etc.)."
  },
  trader: {
    junior: "You are a junior trader. You describe technical setup, comparable trades, liquidity, and recent flow. 1-2 sentences. Specific numbers and time horizons.",
    senior: "You are a Senior Portfolio Manager in the Druckenmiller / Soros tradition. You think regime, not snapshot. You ask what's the carry cost, what's the thesis time horizon, what would falsify the trade. 2-3 sentences. Action-oriented but disciplined.",
    third: "You are the Risk Officer. You enforce single-name concentration caps, marginal-VaR limits, sector-exposure thresholds. You don't kill trades, you size them. 2-3 sentences. Reference specific policy numbers."
  },
  advisor: {
    junior: "You are a junior wealth advisor. You explain market dynamics and product structures in client-friendly language. 1-2 sentences.",
    senior: "You are a Senior Wealth Advisor with 20+ years of HNW client relationships. You think about the client conversation, the IPS alignment, the long-term relationship over the short-term trade. 2-3 sentences. Empathetic but firm.",
    third: "You are the Reg BI / Fiduciary Compliance Officer. You map every recommendation to Reg BI suitability, Reg S-P privacy, Reg AC analyst certification. You require documented basis for any recommended transaction. 2-3 sentences."
  }
};

const SCENARIO_CONTEXTS = {
  lbo: "AcmeCo Leveraged Buyout. Term Loan A $350M, Term Loan B $600M, Senior Sub Notes $250M. Senior Leverage Ratio 4.2x, Total Leverage 5.4x, Interest Coverage 2.6x. Borrower is B-rated consumer-discretionary.",
  bloomberg: "Bloomberg Terminal — AAPL US Equity Description page. Market Cap $3,420B, P/E 33.7, EV/EBITDA 24.1, BORROW_RATE_AVG 22 bps, SHORT_INT_RATIO 1.18, BETA 1.21, dividend yield 0.44%.",
  cds: "Markit CDX.NA.IG.43 5-Year credit-spread chart. Spread widened 34 bps WoW recently, regime overlay shows a tariff scare 4 weeks ago, 1-year range 50-90 bps.",
  policy: "Stifel Internal Underwriting Policy 4.3 — Senior Credit Underwriting Standards. 4.3.1 senior leverage cap 4.5x for B-rated; 4.3.2 cov-lite exceptions require Credit Committee approval; 4.3.3 sponsor equity must be >30%; 4.3.4 hold position limits."
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { persona = "compliance", scenario = "lbo", question, context } = req.body || {};

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
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

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const t0 = Date.now();

  async function callVoice(systemPrompt) {
    const response = await client.messages.create({
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

    // Generate a quick followup using the senior voice for a meta-question
    const followupResponse = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 80,
      system: "You generate a single follow-up question that a VP would ask next, given a council deliberation. One sentence, ending with a question mark.",
      messages: [
        {
          role: "user",
          content: `Original question: ${userQuestion}\n\nJunior voice: ${junior}\n\nSenior voice: ${senior}\n\nCompliance voice: ${third}\n\nWhat is the single most important follow-up question?`
        }
      ]
    });
    const followup = followupResponse.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const latency_ms = Date.now() - t0;
    return res.status(200).json({
      junior,
      senior,
      third,
      followup,
      latency_ms,
      model: CLAUDE_MODEL,
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
