// lib/reproducibility.js
// ──────────────────────────────────────────────────────────────────
// v1.5.33 (2026-07-08). Assembles a reproducibility manifest per
// arXiv:2606.08285 (Yao/Zheng, 2026-06-06) 5-axis discipline. The
// paper documents that 30 published LLM-based trading systems failed
// reproducibility along the same 5 axes; the fix is a manifest that
// pins each axis in a single JSON block bank auditors quote in an
// exam workpaper.
//
// Banking translation of the 5 axes:
//   1. Data provenance         → borrower snapshot hash
//   2. Temporal split          → decision timestamp
//   3. Execution environment   → model id + provider set + Node/SDK
//   4. Threshold configuration → dictionary hash + LOAN_DEFAULTS hash
//   5. Prompt configuration    → persona prompt registry hash
//
// All 5 axes are already covered by hashes bound in aex-attestation/v1
// (dictionary_hash + citation_registry + proxy_schema + evidence_
// partition + policy_invariance + heterogeneity). This module does
// NOT introduce a new signed field — it composes the existing hashes
// plus runtime environment data into a single manifest that bank
// counsel can pin in one line of an exam workpaper instead of
// chasing 8 fields across the attestation object.
//
// Anchor: arXiv:2606.08285 — "Beyond Agent Architecture: Execution
// Assumptions and Reproducibility in LLM-Based Trading Systems"
// (Yao/Zheng, 2026-06-06).

import { createHash } from "node:crypto";

/**
 * Canonicalize the manifest for hashing. Sorted keys guarantee stable
 * bytes across environments so `manifest_hash_sha256` is auditable.
 */
function canonicalize(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) =>
    JSON.stringify(k) + ":" + canonicalize(value[k]),
  ).join(",") + "}";
}


/**
 * Compute the SHA-256 of a canonicalized manifest.
 * @param {object} manifest
 * @returns {string} 64-char hex
 */
export function manifestHash(manifest) {
  return createHash("sha256").update(canonicalize(manifest)).digest("hex");
}


/**
 * Build the reproducibility manifest for a single Shadow decision.
 *
 * Callers pass the request commitment + response commitment + attestation
 * fields already computed by lib/attestation.js. This function does NOT
 * recompute those — it composes them into the axis-aligned block. Keeps
 * responsibility narrow and prevents drift.
 *
 * @param {object} params
 * @param {string} params.borrowerSnapshotHash — request_commitment
 * @param {string} params.decisionTimestampUtc — completed_at_utc
 * @param {string} params.modelId — "claude-sonnet-4-6" etc.
 * @param {string[]} [params.providersUsedSorted] — from heterogeneous-debate enforcement
 * @param {string} [params.nodeVersion] — process.version, for exec env
 * @param {string} [params.dictionaryHash] — reason-code dictionary
 * @param {string} [params.loanDefaultsHash] — LOAN_DEFAULTS threshold set
 * @param {string} [params.citationRegistryHash] — CFR citation registry
 * @param {string} [params.proxySchemaHash] — ECOA §701 protected-class schema
 * @param {string} [params.evidencePartitionSchemeHash] — InfoDelphi scheme
 * @param {string} [params.personaPromptsRegistryHash] — active persona prompts
 * @param {string} [params.heterogeneityCommitmentHash] — provider heterogeneity
 * @param {string} [params.attestationVersion="aex-attestation/v1"]
 * @returns {object} manifest with `manifest_hash_sha256` at top level
 */
export function buildReproducibilityManifest({
  borrowerSnapshotHash,
  decisionTimestampUtc,
  modelId,
  providersUsedSorted = [],
  nodeVersion = null,
  dictionaryHash = null,
  loanDefaultsHash = null,
  citationRegistryHash = null,
  proxySchemaHash = null,
  evidencePartitionSchemeHash = null,
  personaPromptsRegistryHash = null,
  heterogeneityCommitmentHash = null,
  attestationVersion = "aex-attestation/v1",
} = {}) {
  const manifest = {
    spec_version: "shadow-reproducibility/v1",
    anchor: "arXiv:2606.08285",
    attestation_version: attestationVersion,
    axes: {
      // Axis 1: data provenance — what borrower data was on the table
      data_provenance: {
        borrower_snapshot_hash: borrowerSnapshotHash,
      },
      // Axis 2: temporal split — when the decision was made
      temporal_split: {
        decision_timestamp_utc: decisionTimestampUtc,
      },
      // Axis 3: execution environment — model + providers + runtime
      execution_environment: {
        model_id: modelId,
        providers_used_sorted: [...providersUsedSorted].sort(),
        node_version: nodeVersion,
      },
      // Axis 4: threshold configuration — dictionary + LOAN_DEFAULTS
      threshold_configuration: {
        dictionary_hash: dictionaryHash,
        loan_defaults_hash: loanDefaultsHash,
        citation_registry_hash: citationRegistryHash,
        proxy_schema_hash: proxySchemaHash,
      },
      // Axis 5: prompt configuration — persona prompts + partition
      prompt_configuration: {
        persona_prompts_registry_hash: personaPromptsRegistryHash,
        evidence_partition_scheme_hash: evidencePartitionSchemeHash,
        heterogeneity_commitment_hash: heterogeneityCommitmentHash,
      },
    },
  };
  // manifest_hash covers all 5 axes at once. Pin this in the exam
  // workpaper and all 5 reproducibility questions are answered.
  manifest.manifest_hash_sha256 = manifestHash(manifest);
  return manifest;
}


/**
 * Enumerate the 5 axes as constants so tests + docs stay in sync.
 */
export const REPRODUCIBILITY_AXES = Object.freeze([
  "data_provenance",
  "temporal_split",
  "execution_environment",
  "threshold_configuration",
  "prompt_configuration",
]);


/**
 * Audit helper: given a manifest, verify every declared axis has at
 * least one populated (non-null) sub-field. A manifest with an empty
 * axis is technically valid JSON but useless for reproducibility.
 * Bank counsel runs this to catch silent axis omission.
 *
 * @param {object} manifest — output of buildReproducibilityManifest
 * @returns {{ok: boolean, empty_axes: string[]}}
 */
export function auditManifestCompleteness(manifest) {
  const emptyAxes = [];
  if (!manifest || typeof manifest !== "object" || !manifest.axes) {
    return { ok: false, empty_axes: [...REPRODUCIBILITY_AXES] };
  }
  for (const axis of REPRODUCIBILITY_AXES) {
    const block = manifest.axes[axis];
    if (!block || typeof block !== "object") {
      emptyAxes.push(axis);
      continue;
    }
    const anyPopulated = Object.values(block).some((v) => {
      if (v === null || v === undefined) return false;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === "string") return v.length > 0;
      return true;
    });
    if (!anyPopulated) emptyAxes.push(axis);
  }
  return { ok: emptyAxes.length === 0, empty_axes: emptyAxes };
}
