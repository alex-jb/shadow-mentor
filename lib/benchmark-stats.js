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

// Per-cell (persona × scenario) historical floors derived from
// benchmark/history n=6 (3 pre-BR + 3 post-BR). A new run that
// drops any cell more than CELL_FLOOR_TOLERANCE below the
// historical minimum trips a regression and fails CI before the
// PR can merge. This is the prompt-edit guardrail Loredana asked
// for in the 2026-06-19 procurement-defensibility review: aggregate
// score 87±3 can hide one persona collapsing (e.g. a prompt rewrite
// that improves quant×cds by 5 but tanks trader×bloomberg by 15).
//
// Historical mins (n=6) from benchmark/history/SUMMARY.md analysis:
//   advisor × lbo         min=76
//   compliance × lbo      min=86
//   compliance × policy   min=92
//   engineer × lbo        min=84
//   quant × cds           min=87
//   quant × lbo           min=74
//   trader × bloomberg    min=59  (consistently weakest cell)
//   trader × cds          min=71
export const CELL_HISTORICAL_FLOORS = Object.freeze({
  "advisor x lbo": 76,
  "compliance x lbo": 86,
  "compliance x policy": 92,
  "engineer x lbo": 84,
  "quant x cds": 87,
  "quant x lbo": 74,
  "trader x bloomberg": 59,
  "trader x cds": 71,
});

// 5-point tolerance keeps the gate sensitive without flagging
// every stochastic Sonnet shrug. A 10-point cell collapse is
// a real prompt regression; a 5-point dip is normal variance.
export const CELL_FLOOR_TOLERANCE = 5;

export function cellKey(persona, scenario) {
  return `${persona} x ${scenario}`;
}

export function checkCellRegression(report, floors = CELL_HISTORICAL_FLOORS, tolerance = CELL_FLOOR_TOLERANCE) {
  const violations = [];
  for (const r of report.results || []) {
    if (typeof r.score !== "number") continue;
    const key = cellKey(r.task.persona, r.task.scenario);
    const floor = floors[key];
    if (floor === undefined) {
      violations.push({ cell: key, kind: "unknown-cell", score: r.score });
      continue;
    }
    const minAllowed = floor - tolerance;
    if (r.score < minAllowed) {
      violations.push({
        cell: key,
        kind: "regression",
        score: r.score,
        floor,
        min_allowed: minAllowed,
        delta: r.score - minAllowed,
      });
    }
  }
  return { passed: violations.length === 0, violations };
}

export function computeCellStats(runs) {
  // runs is an array of full report objects loaded from history
  const byCell = {};
  for (const r of runs) {
    for (const t of r.results || []) {
      if (typeof t.score !== "number") continue;
      const key = cellKey(t.task.persona, t.task.scenario);
      if (!byCell[key]) byCell[key] = [];
      byCell[key].push(t.score);
    }
  }
  const out = {};
  for (const [key, scores] of Object.entries(byCell)) {
    out[key] = computeStats(scores);
  }
  return out;
}

export function loadFullHistoryRuns(historyDir) {
  // unlike loadHistoryRuns (which only pulls aggregate score), this returns
  // the full report so checkCellRegression / computeCellStats can use it
  const files = readdirSync(historyDir).filter((f) => f.endsWith(".json"));
  return files.map((f) => JSON.parse(readFileSync(join(historyDir, f), "utf8")));
}
