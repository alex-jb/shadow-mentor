// apps/shadow-lens/web/spatial-agent/scene-graph.mjs
// §4 — Convert a signed Shadow Lens session into a spatial evidence scene graph
// (shadow-evidence-scene-v1). EVERYTHING here is derived from REAL contract/session data:
// object ids, source ids, evidence sequences, verification state, and document source-box
// coordinates all come from the session — the model NEVER invents them. The screenshot is
// secondary visual context; this structured graph + the source map are the source of truth.
// Profile-agnostic core + per-profile audit lanes (banking / data-science / coding).

export const SCENE_VERSION = "shadow-evidence-scene-v1";

// Per-profile ordered audit lane (§7). Each stage binds to a real piece of the session.
const LANES = {
  "banking-v1": ["capture", "ocr", "sources", "claims", "reviewers", "human", "signature", "verify"],
  "data-science-v1": ["dataset", "cleaning", "features", "candidates", "evaluation", "selected", "human", "verify"],
  "coding-agent-v1": ["issue", "files", "commands", "diffs", "tests", "security", "human", "commit"],
  generic: ["sources", "claims", "human", "signature", "verify"],
};

const statusOf = (v) => {
  const ri = v?.record_integrity;
  if (ri === "failed") return "failed";
  if (ri === "verified") return "verified";
  return "pending";
};

/**
 * @param {object} session - a Shadow Lens session (any profile)
 * @returns {{scene_version, session_id, profile_id, objects:[], relations:[]}}
 */
export function sessionToSceneGraph(session) {
  const profile_id = session?.profile?.name ?? "generic";
  const objects = [];
  const relations = [];
  const put = (o) => { objects.push(o); return o.id; };
  const pos = (lane, i) => [lane * 1.2 - 1.8, 1.4 - i * 0.22, -1.6]; // deterministic lanes

  // lane 0 — capture (only when the session has a document scan)
  if (session?.capture?.capture_sha256) {
    put({ id: "capture", type: "capture", label: "Capture", position: pos(0, 0),
      status: "verified", provenance: "tool", source_ids: [], evidence_sequences: [] });
  }

  // lane 1 — sources (real source_map; type from content_type; real bounding boxes if present)
  const sourceIds = new Set();
  (session?.source_map ?? []).forEach((e, i) => {
    sourceIds.add(e.source_id);
    put({
      id: e.source_id, type: sourceType(e), label: e.text ?? e.content ?? e.source_id,
      position: pos(1, i), bounds: e.bounding_box_normalized ?? null,
      status: "verified", provenance: "tool", source_ids: [e.source_id], evidence_sequences: [],
      confidence: e.confidence ?? null,
    });
    if (session.capture) relations.push({ from: e.source_id, to: "capture", type: "derived_from" });
  });

  // lane 2 — claims (source-bound gate result; supported_by real sources)
  (session?.claims ?? []).forEach((c, i) => {
    put({ id: c.claim_id, type: "claim", label: c.text ?? c.claim_id, position: pos(2, i),
      status: c.validation_status === "source_bound" ? "verified" : c.validation_status === "rejected" ? "failed" : "warning",
      source_ids: c.source_ids ?? [], provenance: c.produced_by ?? "model", evidence_sequences: [] });
    for (const sid of c.source_ids ?? []) if (sourceIds.has(sid)) relations.push({ from: c.claim_id, to: sid, type: "supported_by" });
  });

  // lane 3 — reviewers (real reviewer records; stance from decision)
  (session?.reviewers ?? []).forEach((r, i) => {
    const id = `reviewer:${r.reviewer_id ?? i}`;
    put({ id, type: "reviewer", label: `${r.reviewer_id ?? "reviewer"} — ${r.decision}`, position: pos(3, i),
      status: r.decision === "rejected" ? "failed" : r.decision === "modified" ? "warning" : "verified",
      provenance: "human", source_ids: [], evidence_sequences: [] });
    for (const c of session.claims ?? []) relations.push({ from: id, to: c.claim_id, type: "reviewed_by" });
  });

  // lane 4 — verification + signature (from the REAL verifier state, never the model)
  const vstatus = statusOf(session?.verification);
  const sigId = put({ id: "signature", type: "signature", label: "Signed Bundle", position: pos(4, 0),
    status: vstatus === "failed" ? "failed" : "verified", provenance: "system", source_ids: [], evidence_sequences: [] });
  const verId = put({ id: "verify", type: "anchor", label: vstatus === "failed" ? "Verify — FAILED" : "Verify", position: pos(4, 1),
    status: vstatus, provenance: "system", source_ids: [],
    evidence_sequences: session?.verification?.failed_seq != null ? [session.verification.failed_seq] : [] });
  relations.push({ from: verId, to: sigId, type: "verifies" });

  return { scene_version: SCENE_VERSION, session_id: session?.session_id ?? "unknown", profile_id, objects, relations,
    lane: LANES[profile_id] ?? LANES.generic };
}

function sourceType(e) {
  const t = (e.content_type ?? "").toLowerCase();
  if (t === "metric") return "metric";
  if (t === "command_output" || t === "test") return "test";
  if (t === "diff" || t === "file" || t === "issue") return "tool";
  if (t === "dataset") return "tool";
  return "source";
}

// Resolve a scene object id against the graph (used by the action allowlist).
export function sceneHasObject(scene, id) { return (scene?.objects ?? []).some((o) => o.id === id); }
