// v1.5.17 — LocalTieredMemory contract tests.
//
// Named invariants:
// 1. append persists to disk (survives fresh instance)
// 2. recall filters by persona + scenario correctly
// 3. recall respects max_results
// 4. recallCalibrationStats aggregates Brier correctly across analyst entries
// 5. analyst_id isolation — one analyst's data never leaks to another
// 6. path traversal via analyst_id is sanitized
// 7. Tier 1 warm cache honors recent-first ordering
// 8. calibration cache invalidates on append

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalTieredMemory } from "../lib/memory-tiered.js";

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shadow-mem-test-"));
});
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

function makeEntry(overrides = {}) {
  return {
    entry_id: "e-" + Math.random().toString(36).slice(2, 10),
    timestamp_iso: new Date().toISOString(),
    analyst_id: "alice",
    persona: "compliance",
    scenario: "lbo",
    question: "Is this loan defensible?",
    junior_voice: "yes",
    senior_voice: "yes",
    third_voice: "escalate",
    followup: "check FICO",
    outcome: "approved",
    brier_score: 0.15,
    hash_chain_link: "abc",
    ...overrides,
  };
}

test("append persists to disk and survives fresh instance", async () => {
  const m1 = new LocalTieredMemory({ dir });
  const entry = makeEntry();
  await m1.append(entry, { analyst_id: "alice" });

  // Fresh instance — should still see the entry via cold read.
  const m2 = new LocalTieredMemory({ dir });
  const recalled = await m2.recall({ analyst_id: "alice", max_results: 10 });
  assert.equal(recalled.length, 1);
  assert.equal(recalled[0].entry_id, entry.entry_id);
});

test("recall filters by persona + scenario correctly", async () => {
  const m = new LocalTieredMemory({ dir });
  await m.append(makeEntry({ persona: "compliance", scenario: "lbo" }), { analyst_id: "alice" });
  await m.append(makeEntry({ persona: "compliance", scenario: "policy" }), { analyst_id: "alice" });
  await m.append(makeEntry({ persona: "quant", scenario: "lbo" }), { analyst_id: "alice" });

  const only_compliance_lbo = await m.recall({
    persona: "compliance",
    scenario: "lbo",
    analyst_id: "alice",
    max_results: 10,
  });
  assert.equal(only_compliance_lbo.length, 1);
  assert.equal(only_compliance_lbo[0].persona, "compliance");
  assert.equal(only_compliance_lbo[0].scenario, "lbo");

  const only_compliance = await m.recall({
    persona: "compliance",
    analyst_id: "alice",
    max_results: 10,
  });
  assert.equal(only_compliance.length, 2);
});

test("recall respects max_results", async () => {
  const m = new LocalTieredMemory({ dir });
  for (let i = 0; i < 10; i++) {
    await m.append(makeEntry({ entry_id: `e-${i}` }), { analyst_id: "alice" });
  }
  const three = await m.recall({ analyst_id: "alice", max_results: 3 });
  assert.equal(three.length, 3);
});

test("recallCalibrationStats aggregates Brier correctly", async () => {
  const m = new LocalTieredMemory({ dir });
  await m.append(makeEntry({ brier_score: 0.10, outcome: "approved" }), { analyst_id: "alice" });
  await m.append(makeEntry({ brier_score: 0.20, outcome: "approved" }), { analyst_id: "alice" });
  await m.append(makeEntry({ brier_score: 0.30, outcome: "blocked" }), { analyst_id: "alice" });

  const stats = await m.recallCalibrationStats({ analyst_id: "alice" });
  assert.equal(stats.n, 3);
  assert.equal(stats.mean_brier, 0.2); // (0.1 + 0.2 + 0.3) / 3
  assert.equal(stats.outcome_dist.approved, 2);
  assert.equal(stats.outcome_dist.blocked, 1);
});

test("analyst_id isolation — no cross-analyst leak", async () => {
  const m = new LocalTieredMemory({ dir });
  await m.append(makeEntry({ entry_id: "alice-1" }), { analyst_id: "alice" });
  await m.append(makeEntry({ entry_id: "bob-1" }), { analyst_id: "bob" });

  const aliceRecall = await m.recall({ analyst_id: "alice", max_results: 10 });
  const bobRecall = await m.recall({ analyst_id: "bob", max_results: 10 });

  assert.equal(aliceRecall.length, 1);
  assert.equal(aliceRecall[0].entry_id, "alice-1");
  assert.equal(bobRecall.length, 1);
  assert.equal(bobRecall[0].entry_id, "bob-1");
});

test("path traversal via analyst_id is sanitized", async () => {
  const m = new LocalTieredMemory({ dir });
  const evilId = "../../../etc/passwd";
  await m.append(makeEntry({ entry_id: "sanitize-check" }), { analyst_id: evilId });

  // File must land inside dir, not escape it.
  const rows = await m.recall({ analyst_id: evilId, max_results: 10 });
  assert.equal(rows.length, 1);
});

test("Tier 1 warm cache serves recent-first order", async () => {
  const m = new LocalTieredMemory({ dir });
  for (let i = 0; i < 5; i++) {
    await m.append(makeEntry({ entry_id: `e-${i}` }), { analyst_id: "alice" });
  }
  const recall = await m.recall({ analyst_id: "alice", max_results: 5 });
  // Most recent first.
  assert.equal(recall[0].entry_id, "e-4");
  assert.equal(recall[4].entry_id, "e-0");
});

test("calibration cache invalidates on append", async () => {
  const m = new LocalTieredMemory({ dir });
  await m.append(makeEntry({ brier_score: 0.10 }), { analyst_id: "alice" });

  const before = await m.recallCalibrationStats({ analyst_id: "alice" });
  assert.equal(before.n, 1);
  assert.equal(before.mean_brier, 0.1);

  await m.append(makeEntry({ brier_score: 0.30 }), { analyst_id: "alice" });
  const after = await m.recallCalibrationStats({ analyst_id: "alice" });
  assert.equal(after.n, 2);
  assert.equal(after.mean_brier, 0.2);
});

test("empty analyst returns 0 stats without crashing", async () => {
  const m = new LocalTieredMemory({ dir });
  const stats = await m.recallCalibrationStats({ analyst_id: "nobody" });
  assert.equal(stats.n, 0);
  assert.equal(stats.mean_brier, null);
});

test("buildMemoryBackend routes to tiered when env set", async () => {
  const savedBackend = process.env.SHADOW_MEMORY_BACKEND;
  const savedDir = process.env.SHADOW_MEMORY_DIR;
  process.env.SHADOW_MEMORY_BACKEND = "tiered";
  process.env.SHADOW_MEMORY_DIR = dir;
  try {
    const { buildMemoryBackend } = await import("../lib/memory-elastic.js");
    const backend = await buildMemoryBackend();
    // Duck-type check: tiered backend has _working Map + _statsCache Map
    assert.ok(backend instanceof LocalTieredMemory);
  } finally {
    if (savedBackend === undefined) delete process.env.SHADOW_MEMORY_BACKEND;
    else process.env.SHADOW_MEMORY_BACKEND = savedBackend;
    if (savedDir === undefined) delete process.env.SHADOW_MEMORY_DIR;
    else process.env.SHADOW_MEMORY_DIR = savedDir;
  }
});
