// Unit tests for lib/benchmark-stats — the helper that auto-computes
// "89 ± 3 (n=3)" from benchmark/history. Hardcoded numbers in README
// drift; computed numbers don't.

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStats, formatScoreBadge, loadHistoryRuns } from "../lib/benchmark-stats.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

test("loadHistoryRuns + computeStats matches the current 89 ± 3 README claim", () => {
  const historyDir = join(__dirname, "..", "benchmark", "history");
  const runs = loadHistoryRuns(historyDir).filter((r) => r.score !== undefined);
  const stats = computeStats(runs.map((r) => r.score));
  const badge = formatScoreBadge(stats);
  // README has "89 ± 3 (n=3)" — this test enforces drift detection.
  assert.equal(badge, "89 ± 3 (n=3)");
});
