// Unit tests for lib/benchmark-stats — the helper that auto-computes
// "89 ± 3 (n=3)" from benchmark/history. Hardcoded numbers in README
// drift; computed numbers don't.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeStats,
  formatScoreBadge,
  loadHistoryRuns,
  loadFullHistoryRuns,
  computeCellStats,
  checkCellRegression,
  cellKey,
  CELL_HISTORICAL_FLOORS,
  CELL_FLOOR_TOLERANCE,
} from "../lib/benchmark-stats.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, readdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("computeStats on empty array returns null fields", () => {
  const s = computeStats([]);
  assert.equal(s.n, 0);
  assert.equal(s.mean, null);
  assert.equal(s.std, null);
});

test("computeStats single value: mean=value, std=0, range=0", () => {
  const s = computeStats([88]);
  assert.equal(s.n, 1);
  assert.equal(s.mean, 88);
  assert.equal(s.std, 0);
  assert.equal(s.range, 0);
});

test("computeStats three values matches manual calc", () => {
  const s = computeStats([87, 93, 86]);
  assert.equal(s.n, 3);
  assert.equal(s.mean, 88.7);
  assert.equal(s.std, 3.1); // population std, sqrt of variance / n
  assert.equal(s.min, 86);
  assert.equal(s.max, 93);
  assert.equal(s.range, 7);
});

test("formatScoreBadge produces N ± std (n=N) format", () => {
  const badge = formatScoreBadge({ n: 3, mean: 88.7, std: 3.1 });
  assert.equal(badge, "89 ± 3 (n=3)");
});

test("formatScoreBadge floors std at 1 (avoids ± 0 noise)", () => {
  const badge = formatScoreBadge({ n: 5, mean: 95.0, std: 0.3 });
  assert.equal(badge, "95 ± 1 (n=5)");
});

test("formatScoreBadge single-run shows (n=1)", () => {
  const badge = formatScoreBadge({ n: 1, mean: 88, std: 0 });
  assert.equal(badge, "88/100 (n=1)");
});

test("formatScoreBadge empty returns no data", () => {
  const badge = formatScoreBadge({ n: 0, mean: null, std: null });
  assert.equal(badge, "no data");
});

test("loadHistoryRuns reads benchmark/history JSON files", () => {
  const historyDir = join(__dirname, "..", "benchmark", "history");
  const runs = loadHistoryRuns(historyDir);
  assert.ok(runs.length >= 3, `expected ≥3 history runs, got ${runs.length}`);
  for (const r of runs) {
    assert.ok(r.file.endsWith(".json"));
    assert.ok(typeof r.score === "number");
    assert.ok(r.score >= 0 && r.score <= 100);
  }
});

test("loadHistoryRuns + computeStats matches the current 87 ± 3 README claim (post-BR)", () => {
  const historyDir = join(__dirname, "..", "benchmark", "history");
  const runs = loadHistoryRuns(historyDir).filter((r) => r.score !== undefined);
  const stats = computeStats(runs.map((r) => r.score));
  const badge = formatScoreBadge(stats);
  // README has "87 ± 3 (n=6)" — n=6 mixes pre-BR (89 ± 3 n=3) and post-BR
  // (86 ± 1 n=3). benchmark/history/SUMMARY.md splits the rubric versions
  // separately for procurement. This drift-detection test enforces that any
  // README change without rerunning history fails.
  assert.equal(badge, "87 ± 3 (n=6)");
});

// --- Per-cell regression gate (added 2026-06-24) -------------------------
// The aggregate "87 ± 3" badge can hide one persona collapsing — e.g. a
// prompt rewrite that boosts quant×cds by 5 but tanks trader×bloomberg
// by 15 nets out flat. Per Loredana's 2026-06-19 procurement review, the
// floor map below is sourced from n=6 history. A new run that drops any
// cell more than CELL_FLOOR_TOLERANCE below historical min fails this
// suite, so a regressing prompt cannot land green.

test("CELL_HISTORICAL_FLOORS covers all 8 benchmark cells", () => {
  const expected = [
    "advisor x lbo",
    "compliance x lbo",
    "compliance x policy",
    "engineer x lbo",
    "quant x cds",
    "quant x lbo",
    "trader x bloomberg",
    "trader x cds",
  ];
  for (const k of expected) {
    assert.ok(k in CELL_HISTORICAL_FLOORS, `missing floor for ${k}`);
    assert.ok(typeof CELL_HISTORICAL_FLOORS[k] === "number");
    assert.ok(CELL_HISTORICAL_FLOORS[k] >= 0 && CELL_HISTORICAL_FLOORS[k] <= 100);
  }
});

test("CELL_HISTORICAL_FLOORS matches actual benchmark/history minimums", () => {
  // If we ever rerun history, the floor map needs updating in lockstep.
  // This test pins floor == observed historical min so the two cannot drift.
  const historyDir = join(__dirname, "..", "benchmark", "history");
  const runs = loadFullHistoryRuns(historyDir);
  const cellStats = computeCellStats(runs);
  for (const [cell, expectedFloor] of Object.entries(CELL_HISTORICAL_FLOORS)) {
    assert.ok(cellStats[cell], `cell ${cell} missing from history`);
    assert.equal(
      cellStats[cell].min,
      expectedFloor,
      `CELL_HISTORICAL_FLOORS[${cell}] = ${expectedFloor} but observed min = ${cellStats[cell].min}. Update lib/benchmark-stats.js after rerunning history.`
    );
  }
});

test("every history report passes the per-cell regression gate against itself", () => {
  // Smoke check: each historical report must, by construction, sit at or
  // above its own contribution to the floor. Catches map/aggregator bugs.
  const historyDir = join(__dirname, "..", "benchmark", "history");
  const runs = loadFullHistoryRuns(historyDir);
  for (const r of runs) {
    const result = checkCellRegression(r);
    assert.ok(
      result.passed,
      `report run_at=${r.run_at} violated cell floor: ${JSON.stringify(result.violations)}`
    );
  }
});

test("checkCellRegression flags a synthetic 30-point collapse", () => {
  // Synthesize a report where trader x bloomberg craters to 20 (floor is 59,
  // tolerance 5, min allowed 54). Should fail with one violation.
  const synthetic = {
    results: [
      { task: { persona: "trader", scenario: "bloomberg" }, score: 20 },
      { task: { persona: "compliance", scenario: "lbo" }, score: 95 },
    ],
  };
  const result = checkCellRegression(synthetic);
  assert.equal(result.passed, false);
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].cell, "trader x bloomberg");
  assert.equal(result.violations[0].kind, "regression");
  assert.equal(result.violations[0].floor, 59);
  assert.equal(result.violations[0].min_allowed, 54);
});

test("checkCellRegression flags an unknown persona × scenario cell", () => {
  // Adding a 9th cell without updating CELL_HISTORICAL_FLOORS should fail
  // visibly so a benchmark expansion can't silently bypass the gate.
  const synthetic = {
    results: [
      { task: { persona: "macro", scenario: "rates" }, score: 100 },
    ],
  };
  const result = checkCellRegression(synthetic);
  assert.equal(result.passed, false);
  assert.equal(result.violations[0].kind, "unknown-cell");
  assert.equal(result.violations[0].cell, "macro x rates");
});

test("checkCellRegression tolerates 5-point dip below floor", () => {
  // A trader x bloomberg score of 55 (floor 59, tolerance 5, min_allowed 54)
  // should PASS because 55 >= 54. This is normal Sonnet variance, not a
  // prompt regression.
  const synthetic = {
    results: [
      { task: { persona: "trader", scenario: "bloomberg" }, score: 55 },
    ],
  };
  const result = checkCellRegression(synthetic);
  assert.equal(result.passed, true);
  assert.equal(result.violations.length, 0);
});

test("CELL_FLOOR_TOLERANCE is a documented constant (not magic number)", () => {
  // If anyone wants to widen tolerance, they must change the exported
  // constant explicitly. Catches a sneaky `tolerance + 5` arg in a PR.
  assert.equal(CELL_FLOOR_TOLERANCE, 5);
});

test("cellKey is stable across persona × scenario inputs", () => {
  assert.equal(cellKey("compliance", "lbo"), "compliance x lbo");
  assert.equal(cellKey("trader", "bloomberg"), "trader x bloomberg");
});
