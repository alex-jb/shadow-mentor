#!/usr/bin/env node
// Aggregate benchmark/history/*.json into one-line summary.
// Usage:
//   node scripts/aggregate-history.mjs                # print summary
//   node scripts/aggregate-history.mjs --badge        # print "88 ± 4 (n=3)"
//   node scripts/aggregate-history.mjs --json         # JSON for tooling

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadHistoryRuns, computeStats, formatScoreBadge } from "../lib/benchmark-stats.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const historyDir = join(__dirname, "..", "benchmark", "history");

const runs = loadHistoryRuns(historyDir).filter((r) => r.score !== undefined);
const scores = runs.map((r) => r.score);
const stats = computeStats(scores);
const badge = formatScoreBadge(stats);

const flag = process.argv[2];

if (flag === "--badge") {
  process.stdout.write(badge + "\n");
} else if (flag === "--json") {
  process.stdout.write(JSON.stringify({ runs, stats, badge }, null, 2) + "\n");
} else {
  process.stdout.write(`Shadow Agentic Score history\n`);
  process.stdout.write(`============================\n`);
  for (const r of runs) {
    process.stdout.write(`  ${r.file}: ${r.score}/100 (${r.run_at})\n`);
  }
  process.stdout.write(`\nAggregate: ${badge}\n`);
  process.stdout.write(`  mean=${stats.mean}, std=${stats.std}, range=${stats.min}-${stats.max}\n`);
}
