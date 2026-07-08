// test/policy-invariance-score.test.js
// ──────────────────────────────────────────────────────────────────
// v1.5.23 (2026-07-08) — Policy Invariance Score + Judge Card
// contract tests. Anchors arXiv:2605.06161 (Weng et al 2026-05-07).
//
// Pins per-metric semantics so RFP responses citing the Judge Card
// stay reproducible across Shadow upgrades. If any of these fail,
// the Judge Card artifact publicly bound in Ed25519 attestations
// silently drifts, which is a procurement-level integrity failure.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REWRITE_FAMILIES,
  AMBIGUITY_SIGNALS,
  classifyAmbiguity,
  rubricSemanticsScore,
  rubricThresholdScore,
  ambiguityCalibrationScore,
  buildJudgeCard,
  whitespaceRewrite,
  fieldReorderRewrite,
  numericRestatementRewrite,
  synonymPreservedRewrite,
  applyAllRewrites,
} from "../lib/policy-invariance.js";

// ═════════════════════════════════════════════════════════════════
// Ambiguity classifier
// ═════════════════════════════════════════════════════════════════

test("classifyAmbiguity flags rationale mentioning 'close call'", () => {
  const { ambiguous, signals } = classifyAmbiguity(["DTI 0.355 is a close call vs the 0.36 cap"]);
  assert.equal(ambiguous, true);
  assert.deepEqual(signals, ["close call"]);
});

test("classifyAmbiguity flags 'boundary' and 'near threshold' across multiple rationales", () => {
  const { ambiguous, signals } = classifyAmbiguity([
    "Credit voice: on the boundary",
    "Risk voice: near threshold for BBB tranche",
  ]);
  assert.equal(ambiguous, true);
  assert.ok(signals.includes("boundary"));
  assert.ok(signals.includes("near threshold"));
});

test("classifyAmbiguity returns ambiguous=false on unambiguous rationales", () => {
  const { ambiguous, signals } = classifyAmbiguity([
    "DTI 0.20 well below cap; approve",
    "LTV 0.55 below 0.80 policy limit",
  ]);
  assert.equal(ambiguous, false);
  assert.equal(signals.length, 0);
});

test("classifyAmbiguity handles empty and non-string inputs", () => {
  assert.equal(classifyAmbiguity([]).ambiguous, false);
  assert.equal(classifyAmbiguity([""]).ambiguous, false);
  assert.equal(classifyAmbiguity([null, undefined, 42]).ambiguous, false);
});

test("classifyAmbiguity accepts a bare string not just an array", () => {
  assert.equal(classifyAmbiguity("borderline case, DTI right at 0.36").ambiguous, true);
});


// ═════════════════════════════════════════════════════════════════
// Rubric-semantics score
// ═════════════════════════════════════════════════════════════════

test("rubricSemanticsScore returns 1 when every rewrite agrees with baseline", () => {
  const rewrites = [
    { family: "whitespace_perturbation", verdict: "approve" },
    { family: "field_reorder", verdict: "approve" },
    { family: "numeric_restatement", verdict: "approve" },
    { family: "synonym_preserved", verdict: "approve" },
  ];
  assert.equal(rubricSemanticsScore(rewrites, "approve"), 1);
});

test("rubricSemanticsScore returns 0.5 when half agree", () => {
  const rewrites = [
    { family: "whitespace_perturbation", verdict: "approve" },
    { family: "field_reorder", verdict: "block" },
    { family: "numeric_restatement", verdict: "approve" },
    { family: "synonym_preserved", verdict: "block" },
  ];
  assert.equal(rubricSemanticsScore(rewrites, "approve"), 0.5);
});

test("rubricSemanticsScore returns 1 when the rewrite list is empty (no data to fail)", () => {
  assert.equal(rubricSemanticsScore([], "approve"), 1);
});


// ═════════════════════════════════════════════════════════════════
// Rubric-threshold score — DIRECTIONAL invariance under looser policy
// ═════════════════════════════════════════════════════════════════

test("rubricThresholdScore returns 1 when lenient shifts stay monotone", () => {
  const shifts = [
    { strictVerdict: "block", lenientVerdict: "escalate" },
    { strictVerdict: "block", lenientVerdict: "approve" },
    { strictVerdict: "escalate", lenientVerdict: "approve" },
    { strictVerdict: "approve", lenientVerdict: "approve" },
  ];
  assert.equal(rubricThresholdScore(shifts), 1);
});

test("rubricThresholdScore counts approve→block as a violation (looser rule got tighter verdict)", () => {
  const shifts = [
    { strictVerdict: "approve", lenientVerdict: "block" },  // violation
    { strictVerdict: "approve", lenientVerdict: "approve" }, // OK
  ];
  assert.equal(rubricThresholdScore(shifts), 0.5);
});

test("rubricThresholdScore counts escalate→block as a violation", () => {
  const shifts = [{ strictVerdict: "escalate", lenientVerdict: "block" }];
  assert.equal(rubricThresholdScore(shifts), 0);
});

test("rubricThresholdScore treats unknown verdicts as violations", () => {
  const shifts = [{ strictVerdict: "wat", lenientVerdict: "approve" }];
  assert.equal(rubricThresholdScore(shifts), 0);
});


// ═════════════════════════════════════════════════════════════════
// Ambiguity-aware calibration score
// ═════════════════════════════════════════════════════════════════

test("ambiguityCalibrationScore excludes ambiguous cases from denominator", () => {
  // 2 unambiguous cases, both agree. 1 ambiguous case disagrees.
  // Score should be 2/2 = 1.0, NOT 2/3.
  const cases = [
    { ambiguous: false, agree: true },
    { ambiguous: false, agree: true },
    { ambiguous: true, agree: false }, // excluded
  ];
  assert.equal(ambiguityCalibrationScore(cases), 1);
});

test("ambiguityCalibrationScore penalizes unambiguous flips", () => {
  const cases = [
    { ambiguous: false, agree: true },
    { ambiguous: false, agree: false }, // 1 unambiguous flip
    { ambiguous: false, agree: true },
    { ambiguous: true, agree: false },
  ];
  // 2 agree of 3 unambiguous = 0.6667
  assert.ok(Math.abs(ambiguityCalibrationScore(cases) - 2 / 3) < 1e-9);
});

test("ambiguityCalibrationScore returns 1 when all cases are ambiguous (nothing to fail)", () => {
  const cases = [
    { ambiguous: true, agree: false },
    { ambiguous: true, agree: true },
  ];
  assert.equal(ambiguityCalibrationScore(cases), 1);
});


// ═════════════════════════════════════════════════════════════════
// Judge Card end-to-end
// ═════════════════════════════════════════════════════════════════

const BASELINE_APPROVE = {
  final_verdict: "approve",
  voices: [
    { voice: "credit", rationale: "DTI 0.20 well below cap, approve" },
    { voice: "compliance", rationale: "All required disclosures present" },
  ],
};
const REWRITE_APPROVE = {
  final_verdict: "approve",
  voices: [{ voice: "credit", rationale: "DTI 0.20 well below cap, authorize" }],
};

test("buildJudgeCard emits protocol + reference + all three scores", () => {
  const card = buildJudgeCard({
    baseline: BASELINE_APPROVE,
    rewriteResponses: [
      { family: "whitespace_perturbation", response: REWRITE_APPROVE },
      { family: "synonym_preserved", response: REWRITE_APPROVE },
    ],
    thresholdShifts: [{ strictResponse: BASELINE_APPROVE, lenientResponse: BASELINE_APPROVE }],
  });
  assert.equal(card.protocol, "policy-invariance");
  assert.equal(card.reference, "arXiv:2605.06161");
  assert.equal(card.rubric_semantics_score, 1);
  assert.equal(card.rubric_threshold_score, 1);
  assert.equal(card.ambiguity_calibration_score, 1);
  assert.ok(Math.abs(card.overall - 1) < 1e-9);
});

test("buildJudgeCard overall is geometric mean (single low score can't be masked)", () => {
  const card = buildJudgeCard({
    baseline: BASELINE_APPROVE,
    rewriteResponses: [
      { family: "whitespace_perturbation", response: BASELINE_APPROVE },
      { family: "synonym_preserved", response: { ...BASELINE_APPROVE, final_verdict: "block" } },
    ],
    thresholdShifts: [{ strictResponse: BASELINE_APPROVE, lenientResponse: BASELINE_APPROVE }],
  });
  // rubric_semantics_score = 0.5 (1 of 2 agrees), threshold = 1, ambig-calib = 0.5
  // geoMean(0.5, 1, 0.5) = 0.62996...
  assert.ok(card.overall < 0.7, `expected overall < 0.7, got ${card.overall}`);
  assert.ok(card.overall > 0.5, `expected overall > 0.5, got ${card.overall}`);
});

test("buildJudgeCard reports per-rewrite-family breakdown", () => {
  const card = buildJudgeCard({
    baseline: BASELINE_APPROVE,
    rewriteResponses: [
      { family: "whitespace_perturbation", response: BASELINE_APPROVE },
      { family: "synonym_preserved", response: { ...BASELINE_APPROVE, final_verdict: "block" } },
    ],
    thresholdShifts: [],
  });
  assert.deepEqual(Object.keys(card.rubric_semantics_by_family).sort(), [...REWRITE_FAMILIES].sort());
  assert.equal(card.rubric_semantics_by_family.whitespace_perturbation, 1);
  assert.equal(card.rubric_semantics_by_family.synonym_preserved, 0);
});

test("buildJudgeCard baseline_ambiguous field is derived from voice rationales", () => {
  const boundary = {
    final_verdict: "block",
    voices: [{ voice: "credit", rationale: "close call, DTI 0.361 just above 0.36 cap" }],
  };
  const card = buildJudgeCard({ baseline: boundary, rewriteResponses: [] });
  assert.equal(card.baseline_ambiguous, true);
  assert.ok(card.baseline_ambiguity_signals.length > 0);
});

test("buildJudgeCard throws on missing baseline", () => {
  assert.throws(() => buildJudgeCard({ baseline: null }), /baseline required/);
});


// ═════════════════════════════════════════════════════════════════
// Certified-equivalent rewrite generators
// ═════════════════════════════════════════════════════════════════

test("whitespaceRewrite is functionally identical", () => {
  const input = { a: 1, b: "hi", c: { d: 2 } };
  const output = whitespaceRewrite(input);
  assert.deepEqual(output, input);
  // But it's a new object (round-tripped), not the same reference.
  assert.notEqual(output, input);
});

test("fieldReorderRewrite reverses top-level keys", () => {
  const input = { alpha: 1, beta: 2, gamma: 3 };
  const output = fieldReorderRewrite(input);
  assert.deepEqual(Object.keys(output), ["gamma", "beta", "alpha"]);
  assert.equal(output.alpha, 1);
});

test("numericRestatementRewrite bumps numbers by float epsilon", () => {
  const input = { dti: 0.20, ltv: 0.55, name: "acme" };
  const output = numericRestatementRewrite(input);
  assert.ok(Math.abs(output.dti - 0.20) < 1e-12);
  assert.notEqual(output.dti, 0.20);
  assert.equal(output.name, "acme");
});

test("synonymPreservedRewrite replaces high/low/approve/block/customer synonyms", () => {
  const input = {
    rationale: "customer risk high; recommend approve if low DTI else block",
  };
  const output = synonymPreservedRewrite(input);
  assert.match(output.rationale, /borrower risk elevated/);
  assert.match(output.rationale, /authorize/);
  assert.match(output.rationale, /reduced DTI/);
  assert.match(output.rationale, /reject/);
});

test("applyAllRewrites returns exactly 4 family entries in canonical order", () => {
  const rewrites = applyAllRewrites({ x: 1 });
  assert.equal(rewrites.length, 4);
  assert.deepEqual(rewrites.map((r) => r.family), REWRITE_FAMILIES);
});
