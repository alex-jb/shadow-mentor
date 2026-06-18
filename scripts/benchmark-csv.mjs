#!/usr/bin/env node
// Convert benchmark JSON report → CSV for procurement Excel pivot.
// Usage: node scripts/benchmark-csv.mjs [path/to/report.json] > out.csv
//   default input: benchmark/report-YYYY-MM-DD.json (today)

import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const today = new Date().toISOString().slice(0, 10);
const argInput = process.argv[2];
const inputPath = argInput
  ? resolve(argInput)
  : join(__dirname, "..", "benchmark", `report-${today}.json`);

const report = JSON.parse(readFileSync(inputPath, "utf8"));

const headers = [
  "persona",
  "scenario",
  "score",
  "junior_length_ok",
  "senior_length_ok",
  "third_length_ok",
  "followup_is_question",
  "followup_length_ok",
  "junior_term_coverage",
  "senior_term_coverage",
  "third_term_coverage",
  "latency_ok",
  "latency_ms",
  "model",
  "expected_terms"
];

process.stdout.write(`# Shadow Agentic Score CSV — ${report.run_at}\n`);
process.stdout.write(`# aggregate: ${report.aggregate_score}/100 across ${report.n_completed}/${report.n_tasks} tasks\n`);
process.stdout.write(headers.join(",") + "\n");

for (const r of report.results) {
  if (r.error) {
    process.stdout.write([r.task.persona, r.task.scenario, "ERROR"].concat(Array(headers.length - 3).fill("")).join(",") + "\n");
    continue;
  }
  const row = [
    r.task.persona,
    r.task.scenario,
    r.score,
    r.checks.junior_length,
    r.checks.senior_length,
    r.checks.third_length,
    r.checks.followup_is_question,
    r.checks.followup_length,
    r.checks.junior_term_coverage.toFixed(3),
    r.checks.senior_term_coverage.toFixed(3),
    r.checks.third_term_coverage.toFixed(3),
    r.checks.latency_ok,
    r.result_meta.latency_ms,
    r.result_meta.model,
    `"${r.task.expected_terms.join(" | ")}"`
  ];
  process.stdout.write(row.join(",") + "\n");
}
