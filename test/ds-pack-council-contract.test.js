// Shadow DS Pack — 5-voice governance council contract tests (v0.2, 2026-07-07).
//
// Pure-JS unit tests on lib/personas/ds-pack/run-ds-council.js. Enforces
// the 5 named invariants documented in run-ds-council.js:
//
//   1. Data Steward — drift_snapshot.psi > 0.25 → REWORK
//   2. Model Validator — calibration.brier > 0.25 → REWORK
//   3. Fair-ML Auditor — disparate_impact.aim_ratio < 0.80 → BLOCK
//                        (EEOC 80% rule, always block)
//   4. Reproducibility Critic — artifact_id or feature_columns missing → REWORK
//   5. Ops Realist — ops_metrics.p95_ms > 1000 → REWORK
//
// Plus verdict resolution: ANY BLOCK → BLOCK; ANY REWORK → REWORK;
// ALL SHIP → SHIP (banking-conservative).

import { test } from "node:test";
import assert from "node:assert/strict";
import { runDSCouncil, DEFAULT_THRESHOLDS } from "../lib/personas/ds-pack/run-ds-council.js";

function baseArtifact(overrides = {}) {
  return {
    artifact_id: "mlflow-run-abc123",
    model_type: "xgboost.XGBClassifier",
    task: "credit_scoring",
    feature_columns: ["fico", "dti", "ltv", "amount", "sector"],
    drift_snapshot: { psi: 0.10 },
    calibration: { brier: 0.15 },
    disparate_impact: { aim_ratio: 0.92 },
    ops_metrics: { p95_ms: 250 },
    ...overrides,
  };
}

test("clean artifact returns SHIP with 5-voice unanimous ship", () => {
  const out = runDSCouncil({ artifact: baseArtifact() });
  assert.equal(out.verdict, "SHIP");
  assert.equal(out.voices.length, 5);
  for (const v of out.voices) {
    assert.equal(v.verdict, "SHIP");
  }
  assert.deepEqual(out.adverse_action_codes, []);
  assert.equal(out.ds_pack_version, "v0.2");
});

test("Contract 1 — Data Steward: high PSI drift triggers REWORK", () => {
  const out = runDSCouncil({
    artifact: baseArtifact({ drift_snapshot: { psi: 0.35 } }),
  });
  const steward = out.voices.find((v) => v.voice === "Data Steward");
  assert.equal(steward.verdict, "REWORK");
  assert.ok(steward.rationale.includes("0.350"));
  assert.equal(out.verdict, "REWORK");
});

test("Contract 2 — Model Validator: high Brier triggers REWORK", () => {
  const out = runDSCouncil({
    artifact: baseArtifact({ calibration: { brier: 0.30 } }),
  });
  const validator = out.voices.find((v) => v.voice === "Model Validator");
  assert.equal(validator.verdict, "REWORK");
  assert.ok(validator.rationale.toLowerCase().includes("brier"));
  assert.equal(out.verdict, "REWORK");
});

test("Contract 3 — Fair-ML Auditor: adverse-impact ratio < 0.80 BLOCKS", () => {
  const out = runDSCouncil({
    artifact: baseArtifact({ disparate_impact: { aim_ratio: 0.65 } }),
  });
  const fairml = out.voices.find((v) => v.voice === "Fair-ML Auditor");
  assert.equal(fairml.verdict, "BLOCK");
  assert.ok(fairml.rationale.includes("80"));
  assert.ok(fairml.adverse_action_codes.includes("AA05"));
  assert.equal(out.verdict, "BLOCK");
});

test("Contract 3 — Fair-ML BLOCK overrides other REWORK/SHIP verdicts", () => {
  // Even with clean drift + Brier + ops + reproducibility, low AIM ratio
  // must yield BLOCK.
  const out = runDSCouncil({
    artifact: baseArtifact({ disparate_impact: { aim_ratio: 0.50 } }),
  });
  assert.equal(out.verdict, "BLOCK");
});

test("Contract 4 — Reproducibility Critic: missing artifact_id triggers REWORK", () => {
  const artifact = baseArtifact();
  delete artifact.artifact_id;
  const out = runDSCouncil({ artifact });
  const critic = out.voices.find((v) => v.voice === "Reproducibility Critic");
  assert.equal(critic.verdict, "REWORK");
  assert.ok(critic.rationale.includes("artifact_id"));
});

test("Contract 4 — Reproducibility Critic: missing feature_columns triggers REWORK", () => {
  const artifact = baseArtifact({ feature_columns: [] });
  const out = runDSCouncil({ artifact });
  const critic = out.voices.find((v) => v.voice === "Reproducibility Critic");
  assert.equal(critic.verdict, "REWORK");
});

test("Contract 5 — Ops Realist: p95 > 1000ms triggers REWORK", () => {
  const out = runDSCouncil({
    artifact: baseArtifact({ ops_metrics: { p95_ms: 1500 } }),
  });
  const ops = out.voices.find((v) => v.voice === "Ops Realist");
  assert.equal(ops.verdict, "REWORK");
  assert.ok(ops.rationale.includes("1500"));
});

test("verdict resolution: ANY BLOCK beats any REWORK", () => {
  const out = runDSCouncil({
    artifact: baseArtifact({
      disparate_impact: { aim_ratio: 0.60 }, // BLOCK
      drift_snapshot: { psi: 0.40 }, // REWORK
      calibration: { brier: 0.30 }, // REWORK
    }),
  });
  assert.equal(out.verdict, "BLOCK");
});

test("verdict resolution: ANY REWORK beats all SHIP", () => {
  const out = runDSCouncil({
    artifact: baseArtifact({ ops_metrics: { p95_ms: 1200 } }),
  });
  assert.equal(out.verdict, "REWORK");
});

test("governance_packet contains all 5 voice statuses", () => {
  const out = runDSCouncil({ artifact: baseArtifact() });
  assert.equal(typeof out.governance_packet, "object");
  assert.equal(out.governance_packet.drift_status, "SHIP");
  assert.equal(out.governance_packet.model_validation_status, "SHIP");
  assert.equal(out.governance_packet.fair_ml_status, "SHIP");
  assert.equal(out.governance_packet.reproducibility_status, "SHIP");
  assert.equal(out.governance_packet.ops_status, "SHIP");
});

test("thresholds override — custom drift threshold changes verdict", () => {
  // Strict threshold: PSI 0.20 now triggers REWORK where default (0.25) wouldn't.
  const out = runDSCouncil(
    { artifact: baseArtifact({ drift_snapshot: { psi: 0.22 } }) },
    { ...DEFAULT_THRESHOLDS, drift_psi_reworkAbove: 0.20 },
  );
  assert.equal(out.voices.find((v) => v.voice === "Data Steward").verdict, "REWORK");
});

test("missing drift_snapshot entirely → Data Steward REWORK", () => {
  const artifact = baseArtifact();
  delete artifact.drift_snapshot;
  const out = runDSCouncil({ artifact });
  assert.equal(out.voices.find((v) => v.voice === "Data Steward").verdict, "REWORK");
});
