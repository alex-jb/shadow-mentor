// test/disparity.test.js — contract tests for lib/disparity (SolasAI-aligned).

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  adverseImpactRatio,
  standardizedMeanDifference,
  segmentedAIR,
} from "../lib/disparity/index.js";

// ── AIR — the 4/5ths rule ────────────────────────────────

test("AIR · identical approval rates yield air = 1.0 (no disparity)", () => {
  const p = [1, 1, 0, 0];   // 50% approval
  const r = [1, 1, 0, 0];   // 50% approval
  const { air, four_fifths_violation } = adverseImpactRatio(p, r);
  assert.equal(air, 1.0);
  assert.equal(four_fifths_violation, false);
});

test("AIR · protected 60% / reference 80% → air 0.75, VIOLATES 4/5ths", () => {
  // Protected: 6 approvals out of 10.
  const p = [1, 1, 1, 1, 1, 1, 0, 0, 0, 0];
  // Reference: 8 approvals out of 10.
  const r = [1, 1, 1, 1, 1, 1, 1, 1, 0, 0];
  const { air, four_fifths_violation } = adverseImpactRatio(p, r);
  assert.ok(Math.abs(air - 0.75) < 1e-9, `expected 0.75, got ${air}`);
  assert.equal(four_fifths_violation, true,
    "0.75 < 0.80 → per EEOC UGSEP 1978 §1607.4(D), this is a prima facie disparate-impact case");
});

test("AIR · zero reference-group approvals throws", () => {
  const p = [1, 0];
  const r = [0, 0];
  assert.throws(() => adverseImpactRatio(p, r), /AIR undefined/);
});

test("AIR · empty array throws", () => {
  assert.throws(() => adverseImpactRatio([], [1, 0]), /at least one observation/);
});


// ── SMD — Cohen's d style for continuous outcomes ────────

test("SMD · identical means → smd = 0, not concerning", () => {
  const p = [100, 200, 300];
  const r = [100, 200, 300];
  const { smd, concerning } = standardizedMeanDifference(p, r);
  assert.equal(smd, 0);
  assert.equal(concerning, false);
});

test("SMD · magnitude > 0.20 flagged as concerning", () => {
  const p = [10, 12, 11, 13, 10];   // mean ~11.2
  const r = [15, 17, 16, 18, 15];   // mean ~16.2
  const { smd, concerning } = standardizedMeanDifference(p, r);
  assert.ok(Math.abs(smd) > 0.20, "expected non-trivial disparity");
  assert.equal(concerning, true);
});


// ── Segmented AIR — reveals aggregate-hides-slice ────────

test("segmentedAIR · reveals per-segment violation hidden by aggregate", () => {
  // Aggregate: 8 protected approvals / 10 = 80%, 10 reference / 12 = 83%.
  // Aggregate AIR would look "fine" at 0.96.
  // But if you slice by FICO bucket, the low-FICO bucket shows severe disparity.
  const rows = [
    // FICO 700+: parity
    { outcome: 1, is_protected: true,  segment: "fico_700_plus" },
    { outcome: 1, is_protected: true,  segment: "fico_700_plus" },
    { outcome: 1, is_protected: true,  segment: "fico_700_plus" },
    { outcome: 1, is_protected: true,  segment: "fico_700_plus" },
    { outcome: 1, is_protected: false, segment: "fico_700_plus" },
    { outcome: 1, is_protected: false, segment: "fico_700_plus" },
    { outcome: 1, is_protected: false, segment: "fico_700_plus" },
    { outcome: 1, is_protected: false, segment: "fico_700_plus" },
    // FICO 620-699: disparity — protected 4/6 = 67%, reference 6/8 = 75%.
    { outcome: 1, is_protected: true,  segment: "fico_620_699" },
    { outcome: 1, is_protected: true,  segment: "fico_620_699" },
    { outcome: 1, is_protected: true,  segment: "fico_620_699" },
    { outcome: 1, is_protected: true,  segment: "fico_620_699" },
    { outcome: 0, is_protected: true,  segment: "fico_620_699" },
    { outcome: 0, is_protected: true,  segment: "fico_620_699" },
    { outcome: 1, is_protected: false, segment: "fico_620_699" },
    { outcome: 1, is_protected: false, segment: "fico_620_699" },
    { outcome: 1, is_protected: false, segment: "fico_620_699" },
    { outcome: 1, is_protected: false, segment: "fico_620_699" },
    { outcome: 1, is_protected: false, segment: "fico_620_699" },
    { outcome: 1, is_protected: false, segment: "fico_620_699" },
    { outcome: 0, is_protected: false, segment: "fico_620_699" },
    { outcome: 0, is_protected: false, segment: "fico_620_699" },
  ];

  const seg = segmentedAIR(rows);
  assert.ok(seg.fico_700_plus.air > 0.99, "fico_700_plus should show parity");
  assert.ok(seg.fico_620_699.air < 0.90, "fico_620_699 should surface disparity hidden by aggregate");
});

test("segmentedAIR · handles insufficient-data segments", () => {
  const rows = [
    { outcome: 1, is_protected: true,  segment: "only_protected" },
    // no reference rows in this segment
  ];
  const seg = segmentedAIR(rows);
  assert.equal(seg.only_protected.air, null);
  assert.equal(seg.only_protected.reason, "insufficient_data");
});
