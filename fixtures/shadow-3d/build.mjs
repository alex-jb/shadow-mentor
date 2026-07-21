// Deterministic generator for shadow-3d-scene-v1 fixtures. Engine-neutral (no three/unity).
// The SAME scene drives the Unity adapter and the Three.js adapter — semantics authoritative,
// positions are hints only. Run: node fixtures/shadow-3d/build.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = dirname(fileURLToPath(import.meta.url));
mkdirSync(OUT, { recursive: true });
const write = (name, o) => writeFileSync(join(OUT, name), JSON.stringify(o, null, 2) + "\n");
const bundleHash = (id) => createHash("sha256").update(id).digest("hex");

// profile → ordered node types (provenance spine per domain)
const SPINES = {
  "banking-v1": ["source", "snapshot", "evidence", "claim", "recommendation", "signature", "audit_record"],
  "data-science-v1": ["dataset", "feature", "model", "metric", "experiment", "signature", "audit_record"],
  "coding-agent-v1": ["issue", "tool_call", "diff", "test", "commit", "signature", "audit_record"],
};
const LABELS = {
  "banking-v1": ["Loan file", "Intake snapshot", "DTI / FICO / LTV", "Council claims", "REVIEW", "Ed25519 seal", "Audit record"],
  "data-science-v1": ["Training set", "Feature: PSI drift", "Model: GBM", "AUC 0.86", "Experiment run", "Ed25519 seal", "Audit record"],
  "coding-agent-v1": ["Issue #412", "tool: Edit", "diff EventSystem", "test: PlayMode", "commit 6f6d9de", "Ed25519 seal", "Audit record"],
};
const AGENTS = { "banking-v1": "loan-council", "data-science-v1": "model-risk", "coding-agent-v1": "coding-agent" };

function buildScene({ profile, viewMode = "audit", layout = "arc", tamperSeq = null, seed = 20260721 }) {
  const spine = SPINES[profile], labels = LABELS[profile];
  const nodes = spine.map((type, i) => {
    const tampered = tamperSeq !== null && i >= tamperSeq;
    return {
      id: `${profile}:n${i}:${type}`,
      type,
      sequence: i,
      timestamp: null,
      status: tampered ? (i === tamperSeq ? "TAMPERED" : "NOT_VERIFIED") : "VERIFIED",
      claim_ids: type === "claim" ? [`${profile}:claim0`] : [],
      evidence_ids: type === "evidence" || type === "feature" || type === "diff" ? [`${profile}:ev${i}`] : [],
      source_ids: i === 0 ? [`${profile}:src0`] : [],
      agent: AGENTS[profile], tool: type === "tool_call" ? "Edit" : null, model: type === "model" ? "GBM" : null,
      label_short: labels[i], label_full: `${labels[i]} (seq ${i}, ${type})`,
      accessibility: `${type} at sequence ${i}: ${labels[i]}, status ${tampered ? (i === tamperSeq ? "TAMPERED — the mutated node" : "NOT VERIFIED — downstream of the tamper") : "VERIFIED"}`,
      // P0 = the tamper failure (or the last node when clean); P1 = its immediate neighbours; else P2/P3
      label_priority: tamperSeq !== null ? (i === tamperSeq ? "P0" : (Math.abs(i - tamperSeq) === 1 ? "P1" : "P2")) : (i === spine.length - 1 ? "P0" : (i >= spine.length - 3 ? "P1" : "P2")),
      focus_state: false, selected_state: false, expanded_state: false,
      layout_hint: { ring: 0.9, angle_deg: -60 + (120 * i) / (spine.length - 1), height: -0.35, column: i },
      evidence_ref: i === 0 ? `${profile}:src0` : null,
    };
  });
  // edges: forward provenance chain (DERIVED_FROM points backward toward the source; SEALED_BY at the seal)
  const edges = [];
  for (let i = 1; i < nodes.length; i++) {
    const type = nodes[i].type === "signature" ? "SEALED_BY" : "DERIVED_FROM";
    edges.push({ id: `e${i}`, type, from: nodes[i].id, to: nodes[i - 1].id, direction: "backward" });
  }
  const tamper = tamperSeq === null ? null : {
    failed_sequence: tamperSeq, reason: "prev_hash_mismatch",
    downstream_sequences: nodes.filter((n) => n.sequence > tamperSeq).map((n) => n.sequence),
  };
  const clean = tamperSeq === null;
  return {
    scene_version: "shadow-3d-scene-v1", profile_id: profile, profile_version: "1.0",
    bundle_id: `${profile}-fixture`, bundle_hash: bundleHash(`${profile}:${viewMode}:${tamperSeq}`),
    status_mode: "FIXTURE", view_mode: viewMode, layout_mode: layout, layout_seed: seed,
    nodes, edges, tamper,
    verification: {
      record_integrity: clean ? "VERIFIED" : "FAILED",
      signature: clean ? "VERIFIED" : "FAILED",
      hash_chain: clean ? "VERIFIED" : "FAILED",
      profile: "VERIFIED",
      source_resolution: "NOT_PRESENT",
      external_anchor: "NOT_PRESENT",
      analytical_correctness: "NOT_EVALUATED",
    },
  };
}

export function buildAll() {
  const scenes = {
    "banking-seven-node.json": buildScene({ profile: "banking-v1" }),
    "banking-tampered.json": buildScene({ profile: "banking-v1", tamperSeq: 3 }),
    "data-science-lineage.json": buildScene({ profile: "data-science-v1" }),
    "coding-agent-replay.json": buildScene({ profile: "coding-agent-v1" }),
  };
  for (const [name, scene] of Object.entries(scenes)) write(name, scene);
  return scenes;
}
export { buildScene };

if (import.meta.url === `file://${process.argv[1]}`) { buildAll(); console.log("shadow-3d fixtures built"); }
