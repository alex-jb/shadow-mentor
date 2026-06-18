// GET /api/scenarios
// One-call surface discovery. Lists every persona, scenario, device
// client, provider, and active endpoint so a bank procurement reviewer
// (or an AI crawler indexing the API) can confirm "this is what Shadow
// can do" without curling 8 separate URLs.

import { PERSONA_PROMPTS, SCENARIO_CONTEXTS } from "../lib/prompts.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=3600");

  const personas = Object.keys(PERSONA_PROMPTS).map((id) => ({
    id,
    voices: Object.keys(PERSONA_PROMPTS[id])
  }));

  const scenarios = Object.entries(SCENARIO_CONTEXTS).map(([id, context]) => ({
    id,
    short_context: context.slice(0, 120) + (context.length > 120 ? "..." : "")
  }));

  return res.status(200).json({
    service: "shadow-mentor",
    rubric_version: "0.3.3",
    personas,
    scenarios,
    devices: [
      { id: "desktop", label: "Desktop overlay", capability: "ScreenCaptureKit + on-device LLM" },
      { id: "g2", label: "Even G2", capability: "monocular green HUD, no camera, customer-facing safe" },
      { id: "frame", label: "Brilliant Frame", capability: "color mini HUD, camera + local-only" },
      { id: "xreal", label: "XReal Air 2 Ultra", capability: "6DoF spatial AR, JARVIS 3-panel mode" }
    ],
    providers: [
      { id: "anthropic", model: "claude-sonnet-4-5-20250929", followup_model: "claude-haiku-4-5-20251001" },
      { id: "glm", model: "glm-4.5-air", region_focus: "Mainland China" }
    ],
    endpoints: [
      { path: "/api/deliberate", method: "POST", purpose: "3-voice council deliberation + Haiku follow-up" },
      { path: "/api/recall", method: "GET", purpose: "Cross-session memory recall with Brier calibration" },
      { path: "/api/calibration", method: "GET", purpose: "Per-persona Brier calibration stats (SR 11-7 dashboard)" },
      { path: "/api/health", method: "GET", purpose: "Liveness + provider-key presence + current score" },
      { path: "/api/badge", method: "GET", purpose: "shields.io endpoint for live Shadow Agentic Score" },
      { path: "/api/version", method: "GET", purpose: "Git SHA + branch + deployment region (audit pin)" },
      { path: "/api/scenarios", method: "GET", purpose: "Full surface discovery (this endpoint)" }
    ],
    cells_total: personas.length * scenarios.length,
    rubric_link: "/benchmark/history/SUMMARY.md",
    docs_link: "/llms.txt"
  });
}
