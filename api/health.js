// GET /api/health
// Procurement-deck table-stakes: bank security reviewers ping this to verify
// the demo is up + which provider keys are wired before they spend a meeting
// on it.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  let score = null;
  try {
    const reportPath = join(__dirname, "..", "benchmark", "report-2026-06-18.json");
    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    score = report.aggregate_score;
  } catch {
    // benchmark file missing or corrupt — health still reports up
  }

  return res.status(200).json({
    status: "ok",
    service: "shadow-mentor",
    version: "1.5.10",
    providers_wired: {
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      glm: Boolean(process.env.GLM_API_KEY)
    },
    shadow_agentic_score: score,
    rubric_version: "0.3.3",
    timestamp: new Date().toISOString()
  });
}
