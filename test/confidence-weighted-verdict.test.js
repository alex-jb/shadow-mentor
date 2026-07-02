// test/confidence-weighted-verdict.test.js
// ──────────────────────────────────────────────────────────────────
// Pins the confidence-weighted verdict aggregation contract shipped
// 2026-07-02 based on Roundtable Policy (arxiv 2509.16839).

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeConfidenceWeightedVerdict,
  DEFAULT_PERSONA_WEIGHTS,
  AGGREGATION_THRESHOLDS,
} from "../lib/confidence-weighted-verdict.js";


// ═══════════════════════════════════════════════════════════════
// Safety-in-depth: any block wins
// ═══════════════════════════════════════════════════════════════

test("any_block short-circuits to block regardless of confidence", () => {
  const voices = [
    { voice: "Credit Fundamentals", verdict: "block", confidence: 0.55 },
    { voice: "Risk Officer", verdict: "approve", confidence: 0.99 },
    { voice: "Compliance Officer", verdict: "approve", confidence: 0.99 },
    { voice: "Advocate", verdict: "approve", confidence: 0.99 },
    { voice: "Macro Contrarian", verdict: "approve", confidence: 0.99 },
  ];
  const result = computeConfidenceWeightedVerdict(voices);
  assert.equal(result.confidence_weighted_verdict, "block");
  assert.equal(result.any_block, true);
  assert.equal(result.aggregated_score, -1.0);
});


// ═══════════════════════════════════════════════════════════════
// Aggregation math
// ═══════════════════════════════════════════════════════════════

test("all approve with high confidence → approve", () => {
  const voices = [
    { voice: "Credit Fundamentals", verdict: "approve", confidence: 0.9 },
    { voice: "Risk Officer", verdict: "approve", confidence: 0.85 },
    { voice: "Compliance Officer", verdict: "approve", confidence: 0.9 },
    { voice: "Advocate", verdict: "approve", confidence: 0.75 },
    { voice: "Macro Contrarian", verdict: "approve", confidence: 0.7 },
  ];
  const result = computeConfidenceWeightedVerdict(voices);
  assert.equal(result.confidence_weighted_verdict, "approve");
  assert.equal(result.any_block, false);
  assert.ok(result.aggregated_score > AGGREGATION_THRESHOLDS.approveMin);
});


test("all escalate at moderate confidence → escalate", () => {
  const voices = [
    { voice: "Credit Fundamentals", verdict: "escalate", confidence: 0.65 },
    { voice: "Risk Officer", verdict: "escalate", confidence: 0.65 },
    { voice: "Compliance Officer", verdict: "escalate", confidence: 0.65 },
    { voice: "Advocate", verdict: "escalate", confidence: 0.65 },
    { voice: "Macro Contrarian", verdict: "escalate", confidence: 0.65 },
  ];
  const result = computeConfidenceWeightedVerdict(voices);
  assert.equal(result.confidence_weighted_verdict, "escalate");
  // Symmetric around zero (all escalate = score 0)
  assert.equal(result.aggregated_score, 0);
});


test("mixed approve+escalate with high approve confidence → approve", () => {
  // 3 approve at 0.9 vs 2 escalate at 0.6 → weighted approve should win
  const voices = [
    { voice: "Credit Fundamentals", verdict: "approve", confidence: 0.90 },
    { voice: "Risk Officer", verdict: "approve", confidence: 0.90 },
    { voice: "Compliance Officer", verdict: "approve", confidence: 0.90 },
    { voice: "Advocate", verdict: "escalate", confidence: 0.60 },
    { voice: "Macro Contrarian", verdict: "escalate", confidence: 0.60 },
  ];
  const result = computeConfidenceWeightedVerdict(voices);
  assert.equal(result.confidence_weighted_verdict, "approve");
});


test("2 approve low + 3 escalate high → escalate", () => {
  // 2 approve at 0.30 (weak yes) vs 3 escalate at 0.90 (strong maybe).
  // Aggregated score should sit near escalate threshold, not approve.
  const voices = [
    { voice: "Credit Fundamentals", verdict: "approve", confidence: 0.30 },
    { voice: "Risk Officer", verdict: "approve", confidence: 0.30 },
    { voice: "Compliance Officer", verdict: "escalate", confidence: 0.90 },
    { voice: "Advocate", verdict: "escalate", confidence: 0.90 },
    { voice: "Macro Contrarian", verdict: "escalate", confidence: 0.90 },
  ];
  const result = computeConfidenceWeightedVerdict(voices);
  // Weighted score should be well below approve threshold — escalate.
  assert.equal(result.confidence_weighted_verdict, "escalate");
  assert.ok(result.aggregated_score < AGGREGATION_THRESHOLDS.approveMin);
});


// ═══════════════════════════════════════════════════════════════
// Persona weights
// ═══════════════════════════════════════════════════════════════

test("Compliance Officer has the highest default weight", () => {
  const compliance = DEFAULT_PERSONA_WEIGHTS["Compliance Officer"];
  for (const [voice, weight] of Object.entries(DEFAULT_PERSONA_WEIGHTS)) {
    if (voice === "Compliance Officer") continue;
    assert.ok(compliance >= weight,
      `Compliance (${compliance}) should be >= ${voice} (${weight})`);
  }
});


test("custom persona weights are respected", () => {
  const voices = [
    { voice: "Credit Fundamentals", verdict: "approve", confidence: 0.9 },
    { voice: "Compliance Officer", verdict: "escalate", confidence: 0.9 },
  ];
  // Boost Compliance Officer to 5.0 — should tip escalate
  const result = computeConfidenceWeightedVerdict(voices, {
    personaWeights: {
      "Credit Fundamentals": 1.0,
      "Compliance Officer": 5.0,
    },
  });
  assert.equal(result.confidence_weighted_verdict, "escalate");
});


// ═══════════════════════════════════════════════════════════════
// Robustness
// ═══════════════════════════════════════════════════════════════

test("missing confidence defaults to 0.5", () => {
  const voices = [
    { voice: "Credit Fundamentals", verdict: "approve" },  // no confidence
    { voice: "Risk Officer", verdict: "approve", confidence: 0.9 },
  ];
  const result = computeConfidenceWeightedVerdict(voices);
  // Should not crash + first voice contributes with confidence 0.5
  assert.equal(result.voice_contributions[0].confidence, 0.5);
});


test("confidence out of [0,1] gets clamped", () => {
  const voices = [
    { voice: "Credit Fundamentals", verdict: "approve", confidence: 1.5 },  // over
    { voice: "Risk Officer", verdict: "approve", confidence: -0.3 },       // under
  ];
  const result = computeConfidenceWeightedVerdict(voices);
  assert.equal(result.voice_contributions[0].confidence, 1.0);
  assert.equal(result.voice_contributions[1].confidence, 0.0);
});


test("unknown persona defaults to weight 1.0", () => {
  const voices = [
    { voice: "SomeNewPersona", verdict: "approve", confidence: 0.8 },
  ];
  const result = computeConfidenceWeightedVerdict(voices);
  assert.equal(result.voice_contributions[0].weight, 1.0);
});


test("empty voice list returns escalate with 0 score", () => {
  const result = computeConfidenceWeightedVerdict([]);
  assert.equal(result.confidence_weighted_verdict, "escalate");
  assert.equal(result.aggregated_score, 0);
});


test("response shape includes aggregation_method for audit", () => {
  const voices = [
    { voice: "Credit Fundamentals", verdict: "approve", confidence: 0.9 },
  ];
  const result = computeConfidenceWeightedVerdict(voices);
  assert.equal(result.aggregation_method, "confidence_weighted_v1");
});
