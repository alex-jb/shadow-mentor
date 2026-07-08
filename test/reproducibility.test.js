// test/reproducibility.test.js
// ──────────────────────────────────────────────────────────────────
// v1.5.33 contract tests for the reproducibility manifest per
// arXiv:2606.08285.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildReproducibilityManifest,
  manifestHash,
  REPRODUCIBILITY_AXES,
  auditManifestCompleteness,
} from "../lib/reproducibility.js";


const MINIMAL_INPUT = {
  borrowerSnapshotHash: "a".repeat(64),
  decisionTimestampUtc: "2026-07-08T20:00:00.000Z",
  modelId: "claude-sonnet-4-6",
};

const FULL_INPUT = {
  ...MINIMAL_INPUT,
  providersUsedSorted: ["anthropic", "glm"],
  nodeVersion: "v20.10.0",
  dictionaryHash: "b".repeat(64),
  loanDefaultsHash: "c".repeat(64),
  citationRegistryHash: "d".repeat(64),
  proxySchemaHash: "e".repeat(64),
  evidencePartitionSchemeHash: "f".repeat(64),
  personaPromptsRegistryHash: "0".repeat(64),
  heterogeneityCommitmentHash: "1".repeat(64),
};


test("REPRODUCIBILITY_AXES contains 5 axes named per Yao/Zheng", () => {
  assert.equal(REPRODUCIBILITY_AXES.length, 5);
  assert.deepEqual([...REPRODUCIBILITY_AXES], [
    "data_provenance",
    "temporal_split",
    "execution_environment",
    "threshold_configuration",
    "prompt_configuration",
  ]);
});


test("buildReproducibilityManifest: minimal input still produces valid manifest", () => {
  const m = buildReproducibilityManifest(MINIMAL_INPUT);
  assert.equal(m.spec_version, "shadow-reproducibility/v1");
  assert.equal(m.anchor, "arXiv:2606.08285");
  assert.equal(m.attestation_version, "aex-attestation/v1");
  assert.equal(m.manifest_hash_sha256.length, 64);
  assert.match(m.manifest_hash_sha256, /^[0-9a-f]{64}$/);
});


test("buildReproducibilityManifest: full input populates all 5 axes", () => {
  const m = buildReproducibilityManifest(FULL_INPUT);
  for (const axis of REPRODUCIBILITY_AXES) {
    assert.ok(m.axes[axis], `axis ${axis} present`);
  }
  assert.equal(
    m.axes.data_provenance.borrower_snapshot_hash,
    FULL_INPUT.borrowerSnapshotHash,
  );
  assert.equal(
    m.axes.temporal_split.decision_timestamp_utc,
    FULL_INPUT.decisionTimestampUtc,
  );
  assert.equal(m.axes.execution_environment.model_id, FULL_INPUT.modelId);
  assert.equal(
    m.axes.threshold_configuration.loan_defaults_hash,
    FULL_INPUT.loanDefaultsHash,
  );
  assert.equal(
    m.axes.prompt_configuration.heterogeneity_commitment_hash,
    FULL_INPUT.heterogeneityCommitmentHash,
  );
});


test("buildReproducibilityManifest: providers array is sorted", () => {
  const m = buildReproducibilityManifest({
    ...MINIMAL_INPUT,
    providersUsedSorted: ["glm", "anthropic", "local"],
  });
  assert.deepEqual(
    m.axes.execution_environment.providers_used_sorted,
    ["anthropic", "glm", "local"],
  );
});


test("manifestHash: deterministic across calls", () => {
  const m1 = buildReproducibilityManifest(FULL_INPUT);
  const m2 = buildReproducibilityManifest(FULL_INPUT);
  assert.equal(m1.manifest_hash_sha256, m2.manifest_hash_sha256);
});


test("manifestHash: changes when any axis field changes", () => {
  const m1 = buildReproducibilityManifest(FULL_INPUT);
  const m2 = buildReproducibilityManifest({
    ...FULL_INPUT,
    dictionaryHash: "z".repeat(64),
  });
  assert.notEqual(m1.manifest_hash_sha256, m2.manifest_hash_sha256);
});


test("manifestHash: changes when providers set changes", () => {
  const m1 = buildReproducibilityManifest({
    ...MINIMAL_INPUT,
    providersUsedSorted: ["anthropic"],
  });
  const m2 = buildReproducibilityManifest({
    ...MINIMAL_INPUT,
    providersUsedSorted: ["anthropic", "glm"],
  });
  assert.notEqual(m1.manifest_hash_sha256, m2.manifest_hash_sha256);
});


test("manifestHash: order-insensitive on providers (sorted internally)", () => {
  const m1 = buildReproducibilityManifest({
    ...MINIMAL_INPUT,
    providersUsedSorted: ["anthropic", "glm"],
  });
  const m2 = buildReproducibilityManifest({
    ...MINIMAL_INPUT,
    providersUsedSorted: ["glm", "anthropic"],
  });
  assert.equal(m1.manifest_hash_sha256, m2.manifest_hash_sha256);
});


test("auditManifestCompleteness: FAIL when input to buildManifest is minimal (only axis 1-3 populated)", () => {
  const m = buildReproducibilityManifest(MINIMAL_INPUT);
  const audit = auditManifestCompleteness(m);
  assert.equal(audit.ok, false);
  assert.deepEqual(audit.empty_axes.sort(), [
    "prompt_configuration",
    "threshold_configuration",
  ]);
});


test("auditManifestCompleteness: PASS when input is full", () => {
  const m = buildReproducibilityManifest(FULL_INPUT);
  const audit = auditManifestCompleteness(m);
  assert.equal(audit.ok, true);
  assert.deepEqual(audit.empty_axes, []);
});


test("auditManifestCompleteness: FAIL on malformed manifest", () => {
  const audit = auditManifestCompleteness(null);
  assert.equal(audit.ok, false);
  assert.deepEqual(audit.empty_axes.sort(), [...REPRODUCIBILITY_AXES].sort());
});


test("auditManifestCompleteness: FAIL when only providers axis populated in execution_environment", () => {
  const m = buildReproducibilityManifest({
    ...MINIMAL_INPUT,
    providersUsedSorted: ["anthropic", "glm"],
  });
  const audit = auditManifestCompleteness(m);
  // data_provenance + temporal_split + execution_environment populated;
  // threshold + prompt still empty → audit fails.
  assert.equal(audit.ok, false);
  assert.equal(audit.empty_axes.length, 2);
});


test("EXAM WORKPAPER USE CASE: one hash answers 5 audit questions", () => {
  // Simulates bank counsel pinning one value in an exam workpaper and
  // getting back all 5 axes on rehash. If any axis was silently changed
  // post-decision, the pinned manifest_hash no longer matches.
  const original = buildReproducibilityManifest(FULL_INPUT);
  const pinnedHash = original.manifest_hash_sha256;

  // Bank keeps the FULL_INPUT ingredients + rebuilds → should match.
  const rehash = buildReproducibilityManifest(FULL_INPUT);
  assert.equal(rehash.manifest_hash_sha256, pinnedHash);

  // Malicious post-hoc: silently swap the dictionary. Rehash != pinned.
  const tampered = buildReproducibilityManifest({
    ...FULL_INPUT,
    dictionaryHash: "9".repeat(64),
  });
  assert.notEqual(tampered.manifest_hash_sha256, pinnedHash);
});
