// test/presentation-order.test.js
// ──────────────────────────────────────────────────────────────────
// Pins the hidden-anchor mitigation contract shipped 2026-07-02.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  stablePresentationOrder,
  attachPresentationOrder,
} from "../lib/presentation-order.js";


// ═══════════════════════════════════════════════════════════════
// Determinism + coverage
// ═══════════════════════════════════════════════════════════════

test("stablePresentationOrder returns a permutation of 0..n-1", () => {
  const order = stablePresentationOrder(5, "seed-1");
  assert.equal(order.length, 5);
  assert.deepEqual([...order].sort((a, b) => a - b), [0, 1, 2, 3, 4]);
});


test("same seed produces the same order (auditable)", () => {
  const a = stablePresentationOrder(5, "seed-abc");
  const b = stablePresentationOrder(5, "seed-abc");
  assert.deepEqual(a, b);
});


test("different seed produces different order", () => {
  const a = stablePresentationOrder(5, "seed-abc");
  const b = stablePresentationOrder(5, "seed-xyz");
  assert.notDeepEqual(a, b);
});


test("object seed is stringified same way each time", () => {
  const a = stablePresentationOrder(5, { loan_id: "L1", verdicts: ["approve"] });
  const b = stablePresentationOrder(5, { loan_id: "L1", verdicts: ["approve"] });
  assert.deepEqual(a, b);
});


test("n=1 returns [0] (nothing to shuffle)", () => {
  assert.deepEqual(stablePresentationOrder(1, "any"), [0]);
});


test("n=0 returns []", () => {
  assert.deepEqual(stablePresentationOrder(0, "any"), []);
});


test("non-integer n returns []", () => {
  assert.deepEqual(stablePresentationOrder(3.5, "any"), []);
  assert.deepEqual(stablePresentationOrder(-1, "any"), []);
});


// ═══════════════════════════════════════════════════════════════
// Anchor bias mitigation — the actual point
// ═══════════════════════════════════════════════════════════════

test("shuffle spreads first-position occurrences across all voices", () => {
  // Simulate 50 different loans; first position (order[0]) should
  // land on many different indices, not always 0.
  const firstIndexCounts = new Map();
  for (let i = 0; i < 50; i++) {
    const order = stablePresentationOrder(5, `loan-${i}`);
    firstIndexCounts.set(order[0], (firstIndexCounts.get(order[0]) || 0) + 1);
  }
  // No single voice should own more than 60% of first-position slots.
  // With 50 seeds and 5 voices, uniform would be 10 each — we're
  // asserting we don't have degenerate anchor-preserving output.
  for (const [_, count] of firstIndexCounts) {
    assert.ok(count < 30,
      `first-position count ${count} suggests anchor bias not spread`);
  }
  // And we saw multiple different first-positions across seeds
  assert.ok(firstIndexCounts.size >= 3);
});


// ═══════════════════════════════════════════════════════════════
// attachPresentationOrder helper
// ═══════════════════════════════════════════════════════════════

test("attachPresentationOrder adds field to response", () => {
  const response = {
    loan_id: "TEST-001",
    voices: [
      { voice: "Credit", verdict: "approve" },
      { voice: "Risk", verdict: "approve" },
      { voice: "Compliance", verdict: "escalate" },
    ],
  };
  const withOrder = attachPresentationOrder(response);
  assert.ok(Array.isArray(withOrder.presentation_order));
  assert.equal(withOrder.presentation_order.length, 3);
});


test("attachPresentationOrder leaves voices untouched", () => {
  const original = [
    { voice: "Credit", verdict: "approve" },
    { voice: "Risk", verdict: "approve" },
  ];
  const response = { loan_id: "L1", voices: original };
  attachPresentationOrder(response);
  // Same reference, same order — voices should not be mutated
  assert.equal(response.voices, original);
  assert.equal(response.voices[0].voice, "Credit");
});


test("attachPresentationOrder is a no-op for malformed input", () => {
  assert.equal(attachPresentationOrder(null), null);
  assert.equal(attachPresentationOrder(undefined), undefined);
  assert.deepEqual(attachPresentationOrder({ no_voices: true }), { no_voices: true });
});


test("custom seed content overrides default derivation", () => {
  const response = {
    loan_id: "L1",
    voices: [{ voice: "A", verdict: "approve" }, { voice: "B", verdict: "approve" }],
  };
  const a = attachPresentationOrder({ ...response, voices: response.voices }, "seed-A");
  const b = attachPresentationOrder({ ...response, voices: response.voices }, "seed-B");
  // Different seed → potentially different order (with 2 voices, may
  // still coincide; assert length + permutation, not necessarily distinct)
  assert.equal(a.presentation_order.length, 2);
  assert.equal(b.presentation_order.length, 2);
});
