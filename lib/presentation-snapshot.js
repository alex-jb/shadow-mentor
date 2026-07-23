// shadow-presentation-snapshot / manifest — a DERIVED VIEW over a Shadow evidence bundle.
//
// This module never touches canonical evidence. It assembles a bounded, deterministic presentation
// snapshot (claims + scene-element bindings + summaries), validates claim bindings, computes a
// semantic hash over the ANALYTICAL content (excluding non-authoritative metadata), builds a
// presentation manifest, and classifies an edit as VISUAL_ONLY / SEMANTIC_PRESENTATION_CHANGE /
// CANONICAL_EVIDENCE_CHANGE. See design/FLOW_SHADOW_RESPONSIBILITY_BOUNDARY.md and
// design/PRESENTATION_EDIT_POLICY.md.
import { createHash } from "node:crypto";
import { canonicalize } from "../packages/attest-core/attestation.js";

export const SNAPSHOT_SCHEMA = "shadow-presentation-snapshot/v1";
export const MANIFEST_SCHEMA = "shadow-presentation-manifest/v1";

const STATUS = new Set(["VERIFIED", "FAILED", "WARNING", "NOT_EVALUATED", "NOT_CHECKED", "NOT_PRESENT",
  "UNSUPPORTED", "FIRST_FAILURE", "AFFECTED_DOWNSTREAM", "REQUIRES_HUMAN_REVIEW", "HUMAN_REVIEW_RECORDED",
  "APPROVAL_NOT_PRESENT", "APPROVAL_PRESENT", "ABSTAINED", "PRESENT"]);
const POSTURE = new Set(["SELF_SIGNED", "TIME_ANCHORED_STRUCTURAL", "TIME_ANCHORED"]);

// The analytical content that the semantic_hash commits to. Everything a SEMANTIC change would touch;
// nothing that a VISUAL_ONLY edit (camera, label position, timing) or non-authoritative metadata
// (snapshot_id, generated_at, adapter_version, semantic_hash itself) would touch.
function semanticContent(s) {
  return {
    evidence_bundle_id: s.evidence_bundle_id,
    evidence_bundle_hash: s.evidence_bundle_hash,
    claims: s.claims,
    scene_elements: (s.scene_elements ?? []).map((e) => ({
      scene_element_id: e.scene_element_id,
      claim_refs: e.claim_refs ?? [],
      visual_role: e.visual_role,
      // encoding.axis/field is analytical (what a dimension MEANS); camera/label position is not.
      encoding: e.encoding ?? {},
      missing_data_behavior: e.missing_data_behavior ?? null,
      not_evaluated_behavior: e.not_evaluated_behavior ?? null,
    })),
    verification_summary: s.verification_summary,
    governance_summary: s.governance_summary,
    story_acts: (s.story?.acts ?? []).map((a) => ({
      act_id: a.act_id,
      steps: (a.steps ?? []).map((st) => ({ step_id: st.step_id, scene_element_refs: st.scene_element_refs ?? [] })),
    })),
  };
}

export function computeSemanticHash(snapshot) {
  return createHash("sha256").update(canonicalize(semanticContent(snapshot))).digest("hex");
}

// Deterministic serialization: canonical (sorted-key) form, stable across machines/runs.
export function serializeSnapshot(snapshot) {
  return canonicalize(snapshot);
}

export function buildPresentationSnapshot(input) {
  const {
    snapshotId, evidenceBundleId, evidenceBundleHash, adapterVersion,
    claims = [], sceneElements = [], story = null,
    verificationSummary, governanceSummary, generatedAt = null,
  } = input;
  const snapshot = {
    schema_version: SNAPSHOT_SCHEMA,
    snapshot_id: snapshotId,
    derived_view: true,
    evidence_bundle_id: evidenceBundleId,
    evidence_bundle_hash: evidenceBundleHash,
    adapter_version: adapterVersion,
    claims,
    scene_elements: sceneElements,
    verification_summary: verificationSummary,
    governance_summary: governanceSummary,
    semantic_hash: "0".repeat(64),
    ...(generatedAt ? { generated_at: generatedAt } : {}),
    ...(story ? { story } : {}),
  };
  snapshot.semantic_hash = computeSemanticHash(snapshot);
  return snapshot;
}

// Validate claim bindings + referential integrity. `known` optionally supplies the bundle's real
// evidence/source IDs so unknown references are rejected against the bundle, not just structurally.
export function validateClaimBindings(snapshot, known = {}) {
  const errors = [];
  const claimIds = new Set();
  const knownEvidence = known.evidence ? new Set(known.evidence) : null;
  const knownSources = known.sources ? new Set(known.sources) : null;
  const knownTransforms = known.transforms ? new Set(known.transforms) : null;

  for (const c of snapshot.claims ?? []) {
    if (claimIds.has(c.claim_id)) errors.push(`duplicate claim_id ${c.claim_id}`);
    claimIds.add(c.claim_id);
    for (const f of ["evaluation_state", "human_review_state", "approval_state"]) {
      if (!STATUS.has(c[f])) errors.push(`${c.claim_id}: bad ${f} "${c[f]}"`);
    }
    // a claim with a numeric value must declare a unit (no unit-less numbers masquerading as facts)
    if (typeof c.value === "number" && !c.unit) errors.push(`${c.claim_id}: numeric value without unit`);
    if (knownEvidence && c.evidence_ref != null && !knownEvidence.has(c.evidence_ref)) errors.push(`${c.claim_id}: unknown evidence_ref ${c.evidence_ref}`);
    if (knownSources && c.source_ref != null && !knownSources.has(c.source_ref)) errors.push(`${c.claim_id}: unknown source_ref ${c.source_ref}`);
    if (knownTransforms && c.transform_ref != null && !knownTransforms.has(c.transform_ref)) errors.push(`${c.claim_id}: unsupported transform_ref ${c.transform_ref}`);
  }

  for (const e of snapshot.scene_elements ?? []) {
    const refs = e.claim_refs ?? [];
    for (const r of refs) if (!claimIds.has(r)) errors.push(`${e.scene_element_id}: unknown claim ref ${r}`);
    // a visual element that ASSERTS a claim (a claim marker) must bind at least one claim_ref
    if (e.visual_role === "claim_marker" && refs.length === 0) errors.push(`${e.scene_element_id}: claim_marker without claim_ref`);
    // presentation must NOT carry its own status field — status is canonical, read from claims only
    if ("status" in e || "evaluation_state" in e) errors.push(`${e.scene_element_id}: scene element carries a status field (presentation cannot override canonical verification)`);
    // unit-mismatch guard: an element declaring a value axis over multiple claims with mixed units
    if (refs.length > 1 && e.encoding?.y?.axis === "value") {
      const units = new Set(refs.map((r) => (snapshot.claims.find((c) => c.claim_id === r) || {}).unit ?? null));
      if (units.size > 1) errors.push(`${e.scene_element_id}: value axis over mixed units ${[...units].join("/")}`);
    }
  }

  // governance/verification summary sanity
  const g = snapshot.governance_summary ?? {};
  if (g.trust_posture && !POSTURE.has(g.trust_posture)) errors.push(`bad trust_posture ${g.trust_posture}`);
  return { ok: errors.length === 0, errors };
}

export function buildPresentationManifest(input) {
  const { snapshot, adapterName, adapterVersion, createdAt = null, externalPresentationRef = null } = input;
  const stepIds = [];
  const sceneElementIds = (snapshot.scene_elements ?? []).map((e) => e.scene_element_id);
  for (const a of snapshot.story?.acts ?? []) for (const st of a.steps ?? []) stepIds.push(st.step_id);
  const manifest = {
    schema_version: MANIFEST_SCHEMA,
    derived_view: true,
    evidence_bundle_id: snapshot.evidence_bundle_id,
    evidence_bundle_hash: snapshot.evidence_bundle_hash,
    presentation_snapshot_hash: createHash("sha256").update(serializeSnapshot(snapshot)).digest("hex"),
    adapter_name: adapterName,
    adapter_version: adapterVersion,
    story_id: snapshot.story?.story_id ?? null,
    step_ids: stepIds,
    scene_element_ids: sceneElementIds,
    trust_posture: snapshot.governance_summary?.trust_posture ?? "SELF_SIGNED",
    ...(createdAt ? { created_at: createdAt } : {}),
    ...(externalPresentationRef ? { external_presentation_ref: externalPresentationRef } : {}),
  };
  return manifest;
}

// Classify a presentation edit. Canonical-evidence fields changing = CANONICAL_EVIDENCE_CHANGE;
// analytical content (semantic_hash) changing = SEMANTIC_PRESENTATION_CHANGE; only non-authoritative
// metadata/layout changing = VISUAL_ONLY.
const CANONICAL_FIELDS = ["evidence_bundle_hash", "evidence_bundle_id"];
export function classifyEdit(before, after) {
  for (const f of CANONICAL_FIELDS) {
    if (before[f] !== after[f]) return { class: "CANONICAL_EVIDENCE_CHANGE", reason: `${f} changed` };
  }
  // approval / source / reason-code bindings live in claims; a change there is canonical, not visual.
  const canonicalClaimShape = (s) => (s.claims ?? []).map((c) => ({
    id: c.claim_id, source: c.source_ref ?? null, evidence: c.evidence_ref ?? null,
    approval: c.approval_state, attest: c.attestation_ref ?? null,
  }));
  if (canonicalize(canonicalClaimShape(before)) !== canonicalize(canonicalClaimShape(after))) {
    return { class: "CANONICAL_EVIDENCE_CHANGE", reason: "claim source/evidence/approval/attestation binding changed" };
  }
  if (computeSemanticHash(before) !== computeSemanticHash(after)) {
    return { class: "SEMANTIC_PRESENTATION_CHANGE", reason: "analytical content (semantic_hash) changed" };
  }
  return { class: "VISUAL_ONLY", reason: "only non-authoritative metadata / layout changed" };
}
