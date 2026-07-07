// Shadow DS Pack — deterministic 5-voice governance council (v0.2, 2026-07-07).
//
// Pure computation. No LLM calls. Each voice applies a declarative scorer
// to the MLArtifactRef and returns a verdict from {SHIP, REWORK, BLOCK}.
// Aggregation is conservative: ANY BLOCK → BLOCK, ANY REWORK → REWORK,
// ALL SHIP → SHIP. Mirrors banking-side block > escalate > approve.
//
// Voices + their triggers (v0.2 pins):
//
//   Data Steward         — drift_snapshot.psi > 0.25 → REWORK
//   Model Validator      — calibration.brier > 0.25 → REWORK
//   Fair-ML Auditor      — disparate_impact.aim_ratio < 0.80 → BLOCK
//                          (Equal Employment Opportunity 80% rule / EEOC
//                          adverse-impact ratio; adopted as ML fairness
//                          proxy in Barocas & Selbst 2016 + widely used)
//   Reproducibility Critic — artifact_id or feature_columns missing → REWORK
//   Ops Realist          — ops_metrics.p95_ms > 1000 → REWORK
//
// Attestation: cross-vertical wire-format identical to banking + trader-pack.
// Ed25519 signature happens at /api/deliberate?mode=ds dispatch — this
// module returns the raw council output; the endpoint wraps + signs.

const DEFAULT_THRESHOLDS = Object.freeze({
  drift_psi_reworkAbove: 0.25,
  brier_reworkAbove: 0.25,
  disparate_impact_blockBelow: 0.80,
  ops_p95_ms_reworkAbove: 1000,
});

/**
 * Data Steward — data lineage + drift owner.
 * Reads drift_snapshot; if PSI exceeds the drift_psi_reworkAbove threshold,
 * returns REWORK with the specific PSI value in metrics.
 *
 * @param {import("./types.js").MLArtifactRef} artifact
 * @param {typeof DEFAULT_THRESHOLDS} thresh
 */
function dataStewardVoice(artifact, thresh) {
  const psi = artifact.drift_snapshot?.psi;
  if (psi === undefined || psi === null) {
    return {
      voice: "Data Steward",
      verdict: "REWORK",
      confidence: 1.0,
      rationale:
        "drift_snapshot.psi missing; drift monitoring must be attached before this artifact enters review.",
      adverse_action_codes: [],
      metrics: { psi: null },
    };
  }
  if (psi > thresh.drift_psi_reworkAbove) {
    return {
      voice: "Data Steward",
      verdict: "REWORK",
      confidence: 0.9,
      rationale: `PSI ${psi.toFixed(3)} exceeds the ${thresh.drift_psi_reworkAbove} rework threshold. Retrain on refreshed data before ship review.`,
      adverse_action_codes: [],
      metrics: { psi, threshold: thresh.drift_psi_reworkAbove },
    };
  }
  return {
    voice: "Data Steward",
    verdict: "SHIP",
    confidence: 0.85,
    rationale: `PSI ${psi.toFixed(3)} within the ${thresh.drift_psi_reworkAbove} rework threshold; drift is acceptable.`,
    adverse_action_codes: [],
    metrics: { psi, threshold: thresh.drift_psi_reworkAbove },
  };
}

/**
 * Model Validator — SR 26-2 effective challenge for the ML artifact.
 * Reads calibration.brier; if it exceeds the brier_reworkAbove threshold,
 * REWORK.
 */
function modelValidatorVoice(artifact, thresh) {
  const brier = artifact.calibration?.brier;
  if (brier === undefined || brier === null) {
    return {
      voice: "Model Validator",
      verdict: "REWORK",
      confidence: 1.0,
      rationale:
        "calibration.brier missing; effective challenge under SR 26-2 requires an out-of-sample Brier score before ship review.",
      adverse_action_codes: [],
      metrics: { brier: null },
    };
  }
  if (brier > thresh.brier_reworkAbove) {
    return {
      voice: "Model Validator",
      verdict: "REWORK",
      confidence: 0.9,
      rationale: `Brier ${brier.toFixed(3)} exceeds the ${thresh.brier_reworkAbove} rework threshold. Recalibrate before ship.`,
      adverse_action_codes: [],
      metrics: { brier, threshold: thresh.brier_reworkAbove },
    };
  }
  return {
    voice: "Model Validator",
    verdict: "SHIP",
    confidence: 0.85,
    rationale: `Brier ${brier.toFixed(3)} within the ${thresh.brier_reworkAbove} rework threshold; calibration is acceptable.`,
    adverse_action_codes: [],
    metrics: { brier, threshold: thresh.brier_reworkAbove },
  };
}

/**
 * Fair-ML Auditor — disparate-impact + parity metrics.
 * Reads disparate_impact.aim_ratio; if below the 80% rule threshold,
 * BLOCK.
 */
function fairMLAuditorVoice(artifact, thresh) {
  const aim = artifact.disparate_impact?.aim_ratio;
  if (aim === undefined || aim === null) {
    return {
      voice: "Fair-ML Auditor",
      verdict: "REWORK",
      confidence: 1.0,
      rationale:
        "disparate_impact.aim_ratio missing; Fair-ML review under FFIEC + EEOC 80% rule cannot proceed without an adverse-impact ratio.",
      adverse_action_codes: ["AA05"],
      metrics: { aim_ratio: null },
    };
  }
  if (aim < thresh.disparate_impact_blockBelow) {
    return {
      voice: "Fair-ML Auditor",
      verdict: "BLOCK",
      confidence: 0.95,
      rationale: `Adverse-impact ratio ${aim.toFixed(3)} falls below the EEOC 80% rule threshold (${thresh.disparate_impact_blockBelow}). Model must not ship without a documented less-discriminatory-alternative analysis per FFIEC three-step framework.`,
      adverse_action_codes: ["AA05"],
      metrics: { aim_ratio: aim, threshold: thresh.disparate_impact_blockBelow },
    };
  }
  return {
    voice: "Fair-ML Auditor",
    verdict: "SHIP",
    confidence: 0.85,
    rationale: `Adverse-impact ratio ${aim.toFixed(3)} clears the EEOC 80% rule threshold; no Fair-ML block signal.`,
    adverse_action_codes: [],
    metrics: { aim_ratio: aim, threshold: thresh.disparate_impact_blockBelow },
  };
}

/**
 * Reproducibility Critic — can this pipeline be re-run 3 years from now?
 * Requires artifact_id + feature_columns[] both present.
 */
function reproducibilityCriticVoice(artifact) {
  const missing = [];
  if (!artifact.artifact_id) missing.push("artifact_id");
  if (!Array.isArray(artifact.feature_columns) || artifact.feature_columns.length === 0) {
    missing.push("feature_columns");
  }
  if (missing.length > 0) {
    return {
      voice: "Reproducibility Critic",
      verdict: "REWORK",
      confidence: 1.0,
      rationale: `Missing fields required for 3-year reproducibility: ${missing.join(", ")}. Cannot re-run this pipeline from persisted metadata alone.`,
      adverse_action_codes: [],
      metrics: { missing_fields: missing },
    };
  }
  return {
    voice: "Reproducibility Critic",
    verdict: "SHIP",
    confidence: 0.85,
    rationale: `artifact_id + ${artifact.feature_columns.length} feature_columns present; 3-year reproducibility is technically feasible from persisted metadata.`,
    adverse_action_codes: [],
    metrics: { feature_count: artifact.feature_columns.length },
  };
}

/**
 * Ops Realist — production-latency + memory + cost sanity.
 * Reads ops_metrics.p95_ms; if too high, REWORK.
 */
function opsRealistVoice(artifact, thresh) {
  const p95 = artifact.ops_metrics?.p95_ms;
  if (p95 === undefined || p95 === null) {
    return {
      voice: "Ops Realist",
      verdict: "REWORK",
      confidence: 0.8,
      rationale:
        "ops_metrics.p95_ms missing; production readiness cannot be assessed without inference-latency data.",
      adverse_action_codes: [],
      metrics: { p95_ms: null },
    };
  }
  if (p95 > thresh.ops_p95_ms_reworkAbove) {
    return {
      voice: "Ops Realist",
      verdict: "REWORK",
      confidence: 0.9,
      rationale: `p95 inference latency ${p95}ms exceeds the ${thresh.ops_p95_ms_reworkAbove}ms rework threshold; SLA at this latency will fail under load.`,
      adverse_action_codes: [],
      metrics: { p95_ms: p95, threshold: thresh.ops_p95_ms_reworkAbove },
    };
  }
  return {
    voice: "Ops Realist",
    verdict: "SHIP",
    confidence: 0.85,
    rationale: `p95 latency ${p95}ms within the ${thresh.ops_p95_ms_reworkAbove}ms rework threshold; SLA achievable.`,
    adverse_action_codes: [],
    metrics: { p95_ms: p95, threshold: thresh.ops_p95_ms_reworkAbove },
  };
}

/**
 * Resolve council verdicts using banking-conservative precedence.
 * ANY BLOCK → BLOCK; ANY REWORK → REWORK; ALL SHIP → SHIP.
 */
function resolveVerdict(voices) {
  const verdicts = voices.map((v) => v.verdict);
  if (verdicts.includes("BLOCK")) return "BLOCK";
  if (verdicts.includes("REWORK")) return "REWORK";
  return "SHIP";
}

/**
 * Run the 5-voice DS governance council on an MLArtifactRef.
 *
 * @param {import("./types.js").DSDebateInput} input
 * @param {typeof DEFAULT_THRESHOLDS} [thresholds]
 * @returns {import("./types.js").DSDebateOutput}
 */
export function runDSCouncil(input, thresholds = DEFAULT_THRESHOLDS) {
  const artifact = input.artifact ?? {};
  const voices = [
    dataStewardVoice(artifact, thresholds),
    modelValidatorVoice(artifact, thresholds),
    fairMLAuditorVoice(artifact, thresholds),
    reproducibilityCriticVoice(artifact),
    opsRealistVoice(artifact, thresholds),
  ];

  const verdict = resolveVerdict(voices);
  const allAA = new Set();
  for (const v of voices) {
    for (const code of v.adverse_action_codes ?? []) allAA.add(code);
  }

  return {
    voices,
    verdict,
    governance_packet: {
      drift_status: voices[0].verdict,
      model_validation_status: voices[1].verdict,
      fair_ml_status: voices[2].verdict,
      reproducibility_status: voices[3].verdict,
      ops_status: voices[4].verdict,
    },
    adverse_action_codes: [...allAA],
    ds_pack_version: "v0.2",
  };
}

export { DEFAULT_THRESHOLDS };
