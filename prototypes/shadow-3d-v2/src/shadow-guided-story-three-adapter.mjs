// Three.js layout adapter for a compiled guided story. Pure + deterministic (no three, no random),
// so the layout math is unit-testable in Node. Given the compiled `semantic` block + a scenario +
// a layout mode, it returns advisory node positions, per-node status, and edges. POSITIONS ARE
// ADVISORY HINTS; the semantic identity (ids, statuses, first-failure, downstream) is authoritative
// and comes straight from the compiled snapshot — this adapter never invents meaning.
import { statusVisual } from "./shadow-status-materials.mjs";

const TAU = Math.PI * 2;

const bySeq = (semantic) => [...semantic.entities].sort((a, b) => a.sequence - b.sequence);
const deg = (d) => (d * Math.PI) / 180;

// ── layouts (return [x,y,z] per node index/entity) ────────────────────────────
function layoutTimeline(nodes) {
  const n = nodes.length, span = 3.2, x0 = -span / 2, dx = n > 1 ? span / (n - 1) : 0;
  return nodes.map((_, i) => [x0 + i * dx, 0, 0]);
}
function layoutArc(nodes) {
  const n = nodes.length, r = 1.9;
  return nodes.map((_, i) => {
    const a = deg(-60 + (n > 1 ? (120 * i) / (n - 1) : 0));
    return [Math.sin(a) * r, -0.1, -Math.cos(a) * r + r];   // shallow forward arc
  });
}
function layoutDag(nodes, semantic) {
  // layer by kind band: sources/evidence low, claims/personas mid, recommendation/synthesis/attestation high
  const band = (kind) => {
    if (["source", "snapshot", "dictionary", "shared_evidence", "evidence", "evidence_ref"].includes(kind)) return 0;
    if (["claim", "persona", "reason_code"].includes(kind)) return 1;
    return 2; // recommendation, signature, audit_record, attestation, synthesis
  };
  const byBand = [[], [], []];
  nodes.forEach((node) => byBand[band(node.kind)].push(node.id));
  const pos = {};
  byBand.forEach((ids, b) => {
    const w = 3.0, x0 = -w / 2, dx = ids.length > 1 ? w / (ids.length - 1) : 0;
    ids.forEach((id, i) => { pos[id] = [ids.length > 1 ? x0 + i * dx : 0, (b - 1) * 0.9, 0]; });
  });
  return nodes.map((node) => pos[node.id]);
}
function layoutRadial(nodes) {
  // synthesis at centre, personas on outer ring, evidence on inner ring
  const personas = nodes.filter((n) => n.kind === "persona");
  const evidence = nodes.filter((n) => n.kind === "shared_evidence");
  const centre = nodes.filter((n) => n.kind === "synthesis");
  const pos = {};
  personas.forEach((p, i) => { const a = (i / Math.max(1, personas.length)) * TAU; pos[p.id] = [Math.cos(a) * 1.6, Math.sin(a) * 1.6, 0]; });
  evidence.forEach((e, i) => { const a = (i / Math.max(1, evidence.length)) * TAU + Math.PI / evidence.length; pos[e.id] = [Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0.2]; });
  centre.forEach((c) => { pos[c.id] = [0, 0, 0.4]; });
  // any leftover kinds fall back to a ring
  nodes.forEach((n, i) => { if (!pos[n.id]) { const a = (i / nodes.length) * TAU; pos[n.id] = [Math.cos(a) * 1.2, Math.sin(a) * 1.2, 0]; } });
  return nodes.map((n) => pos[n.id]);
}
function layoutHybrid(nodes) {
  // reason-code shape: dictionary top, reason codes middle row, evidence bottom row, attestation right
  const rowY = { dictionary: 0.9, reason_code: 0.1, evidence_ref: -0.8, attestation: 0.1 };
  const rows = {};
  nodes.forEach((n) => { (rows[n.kind] ||= []).push(n.id); });
  const pos = {};
  for (const [kind, ids] of Object.entries(rows)) {
    const isAtt = kind === "attestation";
    const w = 2.6, x0 = isAtt ? 1.7 : -w / 2, dx = !isAtt && ids.length > 1 ? w / (ids.length - 1) : 0;
    ids.forEach((id, i) => { pos[id] = [isAtt ? x0 : (ids.length > 1 ? x0 + i * dx : 0), rowY[kind] ?? 0, 0]; });
  }
  return nodes.map((n) => pos[n.id]);
}

const LAYOUTS = { timeline: layoutTimeline, arc: layoutArc, dag: layoutDag, radial: layoutRadial, hybrid: layoutHybrid };
export const LAYOUT_MODES = Object.keys(LAYOUTS);

// ── scene projection ──────────────────────────────────────────────────────────
export function layoutScene(semantic, { scenarioId, layout = "timeline", focusEntities = [] } = {}) {
  if (!LAYOUTS[layout]) throw new Error(`unknown layout ${layout}`);
  const sc = semantic.scenarios.find((s) => s.id === scenarioId);
  if (!sc) throw new Error(`unknown scenario ${scenarioId}`);
  const nodes = bySeq(semantic);
  const positions = LAYOUTS[layout](nodes, semantic);
  const focus = new Set(focusEntities);
  const sceneNodes = nodes.map((node, i) => {
    const status = sc.entity_status[node.id] ?? "VERIFIED";
    const v = statusVisual(status);
    return {
      id: node.id, kind: node.kind, sequence: node.sequence,
      label_en: node.label.en, label_zh: node.label.zh,
      a11y_en: node.a11y.en, a11y_zh: node.a11y.zh,
      status, status_text_en: v.text_en, status_text_zh: v.text_zh, shape: v.shape, icon: v.icon,
      color: v.color, geometry: v.geometry, severity: v.severity,
      pos: positions[i],
      is_first_failure: sc.first_failure === node.id,
      is_downstream: (sc.affected_downstream ?? []).includes(node.id),
      focused: focus.size === 0 ? true : focus.has(node.id),
      dimmed: focus.size > 0 && !focus.has(node.id),
    };
  });
  const idset = new Set(nodes.map((n) => n.id));
  const edges = (semantic.relations ?? []).filter((r) => idset.has(r.from) && idset.has(r.to)).map((r) => {
    const fromNode = sceneNodes.find((n) => n.id === r.from), toNode = sceneNodes.find((n) => n.id === r.to);
    const bad = fromNode.status !== "VERIFIED" && fromNode.status !== "PRESENT" && fromNode.status !== "NOT_EVALUATED"
      && toNode.status !== "VERIFIED" && toNode.status !== "PRESENT";
    return { id: r.id, type: r.type, from: r.from, to: r.to, from_pos: fromNode.pos, to_pos: toNode.pos, degraded: bad };
  });
  return {
    story_id: semantic.story_id, scenario_id: scenarioId, layout,
    first_failure: sc.first_failure ?? null,
    affected_downstream: [...(sc.affected_downstream ?? [])],
    trust_dimensions: semantic.trust_dimensions.map((d) => ({ dimension: d, status: sc.dimension_status[d] ?? "NOT_CHECKED" })),
    nodes: sceneNodes, edges,
  };
}
