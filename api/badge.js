// GET /api/badge
// shields.io endpoint serving the live Shadow Agentic Score. README badge
// auto-updates whenever benchmark/report-*.json refreshes in production.
//
// Usage in README:
//   ![](https://img.shields.io/endpoint?url=<vercel-url>/api/badge)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function colorFor(score) {
  if (score >= 90) return "brightgreen";
  if (score >= 75) return "green";
  if (score >= 60) return "yellowgreen";
  if (score >= 40) return "yellow";
  if (score >= 20) return "orange";
  return "red";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=3600");

  let score = 0;
  try {
    const reportPath = join(__dirname, "..", "benchmark", "report-2026-06-18.json");
    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    score = report.aggregate_score;
  } catch {
    // fall through with score=0; shields will still render
  }

  return res.status(200).json({
    schemaVersion: 1,
    label: "shadow agentic score",
    message: `${score}/100`,
    color: colorFor(score),
    namedLogo: "anthropic"
  });
}
