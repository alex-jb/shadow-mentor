// Compute aggregate stats (mean / std / range) from benchmark/history/*.json
// so the "88 ± 4 (n=3)" number isn't a hardcoded string we forget to
// update. Used by scripts/aggregate-history.mjs to auto-rewrite README
// badges, and by /api/version (future) to expose the live central
// tendency through a deploy URL.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function loadHistoryRuns(historyDir) {
  const files = readdirSync(historyDir).filter((f) => f.endsWith(".json"));
  return files.map((f) => {
    const report = JSON.parse(readFileSync(join(historyDir, f), "utf8"));
    return {
      file: f,
      run_at: report.run_at,
      score: report.aggregate_score,
      n_completed: report.n_completed,
      n_tasks: report.n_tasks
    };
  });
}

export function computeStats(scores) {
  if (scores.length === 0) {
    return { n: 0, mean: null, std: null, min: null, max: null, range: null };
  }
  const n = scores.length;
  const mean = scores.reduce((a, b) => a + b, 0) / n;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  return {
    n,
    mean: Number(mean.toFixed(1)),
    std: Number(std.toFixed(1)),
    min,
    max,
    range: max - min
  };
}

export function formatScoreBadge(stats) {
  if (stats.n === 0) return "no data";
  if (stats.n === 1) return `${stats.mean}/100 (n=1)`;
  // round std up to integer for the ± display, but only when meaningful
  const stdDisplay = Math.max(1, Math.round(stats.std));
  return `${Math.round(stats.mean)} ± ${stdDisplay} (n=${stats.n})`;
}
