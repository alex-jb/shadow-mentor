import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryMemory, memorySingleton } from "../lib/memory.js";

test("InMemoryMemory seeds with 30 entries", () => {
  const m = new InMemoryMemory();
  assert.equal(m.entries.length, 30);
});

test("recall filters by persona", () => {
  const m = new InMemoryMemory();
  const compliance = m.recall({ persona: "compliance", max_results: 100 });
  for (const entry of compliance) assert.equal(entry.persona, "compliance");
  assert.ok(compliance.length >= 10, "should have at least 10 compliance seeds");
});

test("recall filters by persona + scenario", () => {
  const m = new InMemoryMemory();
  const complianceLbo = m.recall({ persona: "compliance", scenario: "lbo", max_results: 100 });
  for (const entry of complianceLbo) {
    assert.equal(entry.persona, "compliance");
    assert.equal(entry.scenario, "lbo");
  }
  assert.ok(complianceLbo.length >= 3);
});

test("recall returns most recent first", () => {
  const m = new InMemoryMemory();
  const all = m.recall({ persona: "compliance", max_results: 5 });
  for (let i = 0; i + 1 < all.length; i++) {
    const t0 = new Date(all[i].timestamp_iso).getTime();
    const t1 = new Date(all[i + 1].timestamp_iso).getTime();
    assert.ok(t0 >= t1, "results should be ordered newest first");
  }
});

test("recall caps at max_results", () => {
  const m = new InMemoryMemory();
  const three = m.recall({ persona: "compliance", max_results: 3 });
  assert.equal(three.length, 3);
});

test("calibration_stats returns valid mean Brier", () => {
  const m = new InMemoryMemory();
  const stats = m.recallCalibrationStats({ persona: "compliance" });
  assert.ok(stats !== null);
  assert.ok(stats.n >= 10);
  assert.ok(stats.mean_brier >= 0 && stats.mean_brier <= 1);
  assert.ok(typeof stats.outcome_dist === "object");
});

test("calibration_stats counts outcome distribution", () => {
  const m = new InMemoryMemory();
  const stats = m.recallCalibrationStats({ persona: "compliance" });
  const total = Object.values(stats.outcome_dist).reduce((acc, n) => acc + n, 0);
  assert.equal(total, stats.n);
});

test("calibration_stats returns null for empty persona", () => {
  const m = new InMemoryMemory();
  const stats = m.recallCalibrationStats({ persona: "non-existent-persona" });
  assert.equal(stats, null);
});

test("append adds entry and increases count", () => {
  const m = new InMemoryMemory();
  const before = m.entries.length;
  m.append({
    entry_id: "test-001",
    timestamp_iso: new Date().toISOString(),
    analyst_id: "test-analyst",
    persona: "compliance",
    scenario: "lbo",
    question: "test question",
    junior_voice: "test", senior_voice: "test", third_voice: "test", followup: "test?",
    outcome: null, brier_score: null, hash_chain_link: "abc123"
  });
  assert.equal(m.entries.length, before + 1);
});

test("memorySingleton is shared across imports", () => {
  assert.ok(memorySingleton instanceof InMemoryMemory);
  assert.ok(memorySingleton.entries.length >= 30);
});

test("each seed entry has all required fields", () => {
  const required = ["entry_id", "timestamp_iso", "analyst_id", "persona", "scenario", "question", "junior_voice", "senior_voice", "third_voice", "followup", "outcome", "brier_score", "hash_chain_link"];
  for (const entry of memorySingleton.entries) {
    for (const field of required) {
      assert.ok(entry.hasOwnProperty(field), `seed entry missing field: ${field}`);
    }
  }
});

test("seed Brier scores are in [0, 1]", () => {
  for (const entry of memorySingleton.entries) {
    if (entry.brier_score !== null) {
      assert.ok(entry.brier_score >= 0 && entry.brier_score <= 1, `bad Brier score ${entry.brier_score}`);
    }
  }
});
