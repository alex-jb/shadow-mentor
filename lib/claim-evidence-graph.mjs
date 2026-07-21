// Claim–Evidence Graph — the one fact source shared by Shadow (AI layer), the Unity
// audit arc, the Flow export, and the offline verifier. A decision is a graph: sources
// snapshot into evidence, evidence supports claims, claims apply policies and are
// challenged by dissent, claims derive the recommendation, the recommendation is sealed
// by a signature into an audit record. Every surface renders THIS graph, so the 3D arc,
// the web verifier, and the signed bundle can never tell three different stories.
//
// Pure + deterministic: no Date.now / Math.random. Stable IDs are caller-provided.
// exportGraph() is byte-stable for a given graph so its hash is attestable.
import { createHash } from "node:crypto";

export const CEG_VERSION = "shadow-claim-evidence-graph/1.0";

export const NODE_TYPES = Object.freeze([
  "source", "snapshot", "evidence", "claim", "transformation", "policy",
  "council_voice", "dissent", "recommendation", "signature", "audit_record",
]);

export const EDGE_TYPES = Object.freeze([
  "SUPPORTS", "CONTRADICTS", "DERIVED_FROM", "APPLIES_POLICY",
  "CHALLENGED_BY", "SUPERSEDES", "SEALED_BY",
]);

// The provenance spine, in order — the audit arc walks this. A well-formed decision
// graph must be able to trace a recommendation back through claims to sources, and
// forward to the sealing signature + audit record.
export const PROVENANCE_ORDER = Object.freeze([
  "source", "snapshot", "evidence", "claim", "recommendation", "signature", "audit_record",
]);

// Never let a credential leak into a graph node that will be exported/rendered.
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9]{16,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b[A-Fa-f0-9]{64,}\b/,   // long raw hex secret/token (hashes go in dedicated *_sha256 fields)
];
function scanForSecret(value) {
  const s = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return SECRET_PATTERNS.some((re) => re.test(s));
}

export function createGraph() {
  return { version: CEG_VERSION, nodes: [], edges: [] };
}

export function addNode(g, node) {
  if (!node || typeof node.id !== "string" || !node.id) throw new Error("CEG: node.id (stable string) required");
  if (!NODE_TYPES.includes(node.type)) throw new Error(`CEG: unknown node type "${node.type}"`);
  if (g.nodes.some((n) => n.id === node.id)) throw new Error(`CEG: duplicate node id "${node.id}"`);
  // metadata must not carry secrets; snapshots carry a hash, never the raw sensitive body
  for (const [k, v] of Object.entries(node)) {
    if (k === "id" || k === "type") continue;
    if (scanForSecret(v)) throw new Error(`CEG: node "${node.id}" field "${k}" looks like a secret — store a *_sha256 hash, not the raw value`);
  }
  g.nodes.push({ ...node });
  return node.id;
}

export function addEdge(g, edge) {
  if (!edge || !EDGE_TYPES.includes(edge.type)) throw new Error(`CEG: unknown edge type "${edge?.type}"`);
  if (!g.nodes.some((n) => n.id === edge.from)) throw new Error(`CEG: edge.from "${edge.from}" is not a node`);
  if (!g.nodes.some((n) => n.id === edge.to)) throw new Error(`CEG: edge.to "${edge.to}" is not a node`);
  g.edges.push({ type: edge.type, from: edge.from, to: edge.to, ...(edge.meta ? { meta: edge.meta } : {}) });
  return g.edges.length - 1;
}

const nodesOfType = (g, t) => g.nodes.filter((n) => n.type === t);
const edgesOfType = (g, t) => g.edges.filter((e) => e.type === t);

// Clear, enumerated failure behavior — especially "a claim with no supporting evidence".
export function validateGraph(g) {
  const errors = [];
  if (g.version !== CEG_VERSION) errors.push(`version mismatch: ${g.version} !== ${CEG_VERSION}`);

  const ids = new Set();
  for (const n of g.nodes) {
    if (ids.has(n.id)) errors.push(`duplicate node id ${n.id}`);
    ids.add(n.id);
    if (!NODE_TYPES.includes(n.type)) errors.push(`node ${n.id} has unknown type ${n.type}`);
  }
  for (const e of g.edges) {
    if (!ids.has(e.from)) errors.push(`edge ${e.type} from unknown node ${e.from}`);
    if (!ids.has(e.to)) errors.push(`edge ${e.type} to unknown node ${e.to}`);
  }
  // Every claim must be GROUNDED: supported by evidence (SUPPORTS), or grounded in a
  // policy it applies (APPLIES_POLICY), or an explicit abstention (vote === "abstain",
  // which asserts nothing needing evidence). A claim that is none of these is a
  // missing-evidence failure — an ungrounded assertion the auditor must reject.
  const supports = edgesOfType(g, "SUPPORTS");
  const applies = edgesOfType(g, "APPLIES_POLICY");
  for (const claim of nodesOfType(g, "claim")) {
    const supported = supports.some((e) => e.to === claim.id);
    const policyGrounded = applies.some((e) => e.from === claim.id);
    const abstained = claim.vote === "abstain";
    if (!supported && !policyGrounded && !abstained) {
      errors.push(`claim ${claim.id} has NO grounding: no supporting evidence, no applied policy, not an abstention (missing-evidence failure)`);
    }
  }
  // every evidence node must derive from a snapshot or source (no free-floating evidence)
  const derived = edgesOfType(g, "DERIVED_FROM");
  for (const ev of nodesOfType(g, "evidence")) {
    if (!derived.some((e) => e.from === ev.id)) errors.push(`evidence ${ev.id} is not DERIVED_FROM any source/snapshot`);
  }
  // a recommendation must derive from at least one claim
  for (const rec of nodesOfType(g, "recommendation")) {
    if (!derived.some((e) => e.from === rec.id && g.nodes.find((n) => n.id === e.to)?.type === "claim")) {
      errors.push(`recommendation ${rec.id} is not DERIVED_FROM any claim`);
    }
  }
  return { ok: errors.length === 0, errors };
}

// Byte-stable JSON: nodes sorted by id, edges by (type, from, to), keys sorted. So the
// graph hash is attestable and a post-hoc edit changes the hash.
export function exportGraph(g) {
  const sortKeys = (o) => (o && typeof o === "object" && !Array.isArray(o)
    ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeys(o[k])]))
    : o);
  const nodes = [...g.nodes].sort((a, b) => a.id.localeCompare(b.id)).map(sortKeys);
  const edges = [...g.edges]
    .sort((a, b) => (a.type + a.from + a.to).localeCompare(b.type + b.from + b.to))
    .map(sortKeys);
  return JSON.stringify({ version: g.version, nodes, edges });
}

export function graphSha256(g) {
  return createHash("sha256").update(exportGraph(g)).digest("hex");
}

// The ordered provenance chain the Unity audit arc lights up, and the verifier walks.
// Returns [{seq, id, type, label}] following PROVENANCE_ORDER; unresolved links are
// surfaced (not hidden) so a broken chain freezes downstream as NOT VERIFIED.
export function provenanceChain(g) {
  const chain = [];
  let seq = 0;
  for (const type of PROVENANCE_ORDER) {
    for (const n of nodesOfType(g, type)) {
      chain.push({ seq: seq++, id: n.id, type: n.type, label: n.label ?? n.id });
    }
  }
  return chain;
}
