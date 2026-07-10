// Shadow DS Pack — types (v0.1 scaffold, 2026-07-07)
//
// Byte-identical wire format to the trader-pack + banking pack so a bank
// SIEM that consumes one Shadow attestation consumes them all.
//
// See lib/personas/ds-pack/README.md for the port strategy + persona
// mapping across the three verticals.

/**
 * A single data-science-vertical voice's contribution to the debate.
 * Same wire shape as TradingVoice (`../trader-pack/types.js`) so
 * cross-vertical attestation validation is one code path.
 *
 * @typedef {Object} DSVoice
 * @property {string} voice
 *   One of "Data Steward", "Model Validator", "Fair-ML Auditor",
 *   "Reproducibility Critic", "Ops Realist", or "ML Attribution Auditor" (opt-in).
 * @property {"SHIP"|"BLOCK"|"REWORK"} verdict
 *   The three-verdict enum for data-science governance. Mirrors banking
 *   approve/escalate/block. Conservative aggregation: ANY BLOCK → BLOCK;
 *   ANY REWORK → REWORK; ALL SHIP → SHIP.
 * @property {number} confidence
 *   0.0 to 1.0; the confidence-weighted-verdict aggregator uses this.
 * @property {string} rationale
 *   Short paragraph with regulatory-anchor citations if applicable
 *   (Reg B disparate-impact, SR 26-2 (GenAI/agentic AI carved out by footnote 3), ECOA §1002.6, GDPR Art. 22
 *   for EU-touching pipelines).
 * @property {string[]} adverse_action_codes
 *   For consumer-facing ML (credit-scoring, insurance underwriting),
 *   AA01-AA06 mapped through `../../schemas/reason-code-dictionary.json`.
 *   Empty for non-consumer-facing pipelines.
 * @property {Object} metrics
 *   Free-form dict of raw signals (drift KS-stat, PSI, disparate-impact
 *   ratio, calibration slope, feature-importance rank correlation).
 */

/**
 * Reference to the ML artifact under governance. In v0.1 this is the
 * caller's responsibility to populate; v0.4 will read directly from
 * MLflow tracking server + Great Expectations suite results.
 *
 * @typedef {Object} MLArtifactRef
 * @property {string} artifact_id
 *   Stable identifier (MLflow run_id, Weights & Biases run URL, etc).
 * @property {string} model_type
 *   e.g. "xgboost.XGBClassifier", "sklearn.ensemble.RandomForestClassifier",
 *   "lightgbm.LGBMRegressor", "statsmodels.GLM".
 * @property {string} task
 *   e.g. "credit_scoring", "fraud_detection", "insurance_underwriting",
 *   "marketing_propensity", "churn_prediction".
 * @property {string[]} feature_columns
 * @property {Object} drift_snapshot
 *   Optional. PSI + KS + population-shift metrics vs a reference window.
 * @property {Object} disparate_impact
 *   Optional. Adverse-impact ratios by protected class per the ECOA
 *   §1002.6 list.
 * @property {Object} calibration
 *   Optional. Brier + reliability-slope + ECE.
 * @property {Object} ops_metrics
 *   Optional. p50/p95 inference latency, memory, cost/1M inferences.
 */

/**
 * Input to run_ds_council(). Mirrors banking-side normalizeLoan() but
 * for a model-governance review instead of a loan.
 *
 * @typedef {Object} DSDebateInput
 * @property {MLArtifactRef} artifact
 * @property {string} governance_question
 *   The specific question the council is being asked to opine on. E.g.
 *   "Does this scorecard clear Reg B disparate-impact for approval-in-
 *    principle?" or "Should this fraud-detection model be retrained
 *    given the drift snapshot?"
 * @property {"pre_deploy"|"post_deploy_monitor"|"decommission"} lifecycle_stage
 * @property {Object} deployment_context
 *   Optional. Where the model runs (prod / staging / shadow), traffic
 *   share, downstream consumers.
 */

/**
 * Output of run_ds_council(). Mirrors banking runLoanCouncil() +
 * trader-pack run_trading_council().
 *
 * @typedef {Object} DSDebateOutput
 * @property {DSVoice[]} voices
 * @property {"SHIP"|"BLOCK"|"REWORK"} verdict
 *   Deterministic resolver: ANY BLOCK → BLOCK; ANY REWORK → REWORK;
 *   ALL SHIP → SHIP. Same conservatism as banking-side block > escalate > approve.
 * @property {Object} governance_packet
 *   Model-risk aggregate: drift status + disparate-impact status +
 *   reproducibility status + ops status.
 * @property {string} attestation_signing_payload
 *   Pipe-delimited byte-identical to banking + trader-pack. See README §
 *   "Cross-language attestation invariant".
 * @property {string[]} adverse_action_codes
 *   Populated for consumer-facing ML pipelines (credit scorecards,
 *   insurance underwriting); empty otherwise.
 */

// No runtime exports — this is a types-only module.
export const _TYPES_VERSION = "ds-pack/v0.1.0";
