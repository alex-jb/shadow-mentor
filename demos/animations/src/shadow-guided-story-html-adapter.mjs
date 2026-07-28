// HTML/SVG adapter for a compiled shadow-guided-story.
//
// This does NOT redesign the three explainers. It is the convergence layer: it projects a
// compiled guided story (the `semantic` block from tools/compile-shadow-guided-story.mjs) into
// the exact display vocabulary each existing explainer already renders, so a parity test can prove
// the self-contained HTML explainers and the shared contract tell the same story.
//
// The mapping from semantic status → the explainer's on-screen status is explicit here (one place),
// e.g. FIRST_FAILURE → "TAMPERED", AFFECTED_DOWNSTREAM → "NOT_VERIFIED". Pure + deterministic.

// Semantic status → the audit-chain explainer's three-state display vocabulary.
export const CHAIN_DISPLAY = Object.freeze({
  VERIFIED: "VERIFIED",
  FIRST_FAILURE: "TAMPERED",
  AFFECTED_DOWNSTREAM: "NOT_VERIFIED",
});

// Semantic status → the reason-code / persona explainers' pass/flag display vocabulary.
export const CHECK_DISPLAY = Object.freeze({
  VERIFIED: "PASS",
  PRESENT: "PRESENT",
  NOT_PRESENT: "ABSENT",
  FIRST_FAILURE: "FAIL",
  AFFECTED_DOWNSTREAM: "AFFECTED",
  FAILED: "FAIL",
  WARNING: "WARN",
  UNSUPPORTED: "UNSUPPORTED",
  ABSTAINED: "ABSTAIN",
  NOT_EVALUATED: "NOT_EVALUATED",
  REQUIRES_HUMAN_REVIEW: "HUMAN_REVIEW",
  NOT_CHECKED: "NOT_CHECKED",
});

const scenarioOf = (semantic, scenarioId) => {
  const sc = semantic.scenarios.find((s) => s.id === scenarioId);
  if (!sc) throw new Error(`unknown scenario ${scenarioId}`);
  return sc;
};
const bySequence = (semantic) => [...semantic.entities].sort((a, b) => a.sequence - b.sequence);

// audit-chain view: an ordered chain of {id, sequence, status(display)} + firstFailure sequence +
// downstream sequences — exactly what the audit-chain.html SVG renders.
export function toChainView(semantic, scenarioId) {
  const sc = scenarioOf(semantic, scenarioId);
  const nodes = bySequence(semantic).map((e) => {
    const st = sc.entity_status[e.id] ?? "VERIFIED";
    return { id: e.id, sequence: e.sequence, status: CHAIN_DISPLAY[st] ?? st };
  });
  const firstFailureSeq = sc.first_failure
    ? (semantic.entities.find((e) => e.id === sc.first_failure)?.sequence ?? null)
    : null;
  const downstreamSeq = (sc.affected_downstream ?? [])
    .map((id) => semantic.entities.find((e) => e.id === id)?.sequence)
    .filter((n) => n != null)
    .sort((a, b) => a - b);
  return { nodes, firstFailureSeq, downstreamSeq };
}

// reason-code / persona view: per-scenario dimension checks + entity flags in display vocabulary,
// plus the first-failure/first-warning target — what the *-attestation / persona HTML tables render.
export function toCheckView(semantic, scenarioId) {
  const sc = scenarioOf(semantic, scenarioId);
  const checks = semantic.trust_dimensions.map((d) => ({
    dimension: d,
    status: CHECK_DISPLAY[sc.dimension_status[d] ?? "NOT_CHECKED"] ?? sc.dimension_status[d],
  }));
  const entities = bySequence(semantic).map((e) => ({
    id: e.id, kind: e.kind,
    status: CHECK_DISPLAY[sc.entity_status[e.id] ?? "VERIFIED"] ?? sc.entity_status[e.id],
  }));
  return { checks, entities, firstFailure: sc.first_failure ?? null, affectedDownstream: [...(sc.affected_downstream ?? [])] };
}

// A stable, text-safe HTML fragment for a single scenario (used by the docs/demo surfaces if they
// want to render the shared story without the full interactive explainer). No innerHTML sinks:
// callers assign via textContent; this only returns escaped strings + a structured model.
export function escapeText(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
