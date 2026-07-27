// apps/shadow-lens/flow/flow-vendor-csv.mjs
// Shadow → Flow VENDOR-COMPATIBLE graph CSV (one row per node, pipe-delimited `idList`).
//
// Vendor guidance received 2026-07-27 from Bill Morton, VP Customer Success, Flow Immersive:
//   - Flow currently ingests CSV datasets directly.
//   - A graph dataset should contain ONE ROW PER NODE.
//   - Every node must have a unique ID.
//   - Edges are represented in a column such as `idList`.
//   - `idList` holds pipe-delimited connected node IDs, e.g. `2|3|10`.
//
// This module is a PROJECTION of the existing presentation mapping
// (flow-presentation-mapping.mjs, `shadow-flow-presentation/1.0`). It invents nothing:
// every label, status, lineage position, first-failure marker and provenance reference is
// copied from the Shadow fixtures through that mapping. Shadow remains the analysis and
// evidence authority; Flow is the spatial visualization layer.
//
// Deterministic + offline + non-secret: no Date.now / Math.random, no network, no credentials,
// no absolute paths. Two builds are byte-identical.
//
// NOT CLAIMED by this module: that the CSV has been imported into Flow, that any Flow scene
// has rendered, or that any XR device displayed it. Those require the manual runbook
// (reports/flow-v11/SHADOW_FLOW_IMPORT_RUNBOOK.md) and are untested here by design.

import { buildFlowPresentationMapping, PRESENTED_SCENARIO } from "./flow-presentation-mapping.mjs";

export const FLOW_VENDOR_CSV_VERSION = "shadow-flow-vendor-csv/1.0";

/**
 * Column order is part of the contract: the validator and the tests pin it, so a silent
 * reordering during a future edit fails CI rather than reaching an auditor's Flow scene.
 *
 * `id` / `idList` are the two vendor-mandated columns. Everything after them is Shadow
 * provenance and audit semantics that Flow may display but must never recompute.
 */
export const VENDOR_CSV_COLUMNS = Object.freeze([
  "id",                    // vendor-required: stable unique numeric node ID
  "idList",                // vendor-required: pipe-delimited connected node IDs (outgoing)
  "idListTypes",           // Shadow extension: relation type per idList entry, same order
  "label_en",
  "label_zh",
  "node_type",
  "status",
  "status_family",
  "presentation_group",
  "shadow_node_id",        // provenance: the authoritative Shadow node identifier
  "evidence_ref",          // provenance: the fixture/source path this row was copied from
  "council_role",          // council rows only
  "council_finding",       // council rows only
  "is_first_failure",
  "lineage_order",         // evidence-lineage position; empty for non-lineage nodes
  "is_affected_downstream",
  "human_review_status",   // CASE-SCOPE (see note below)
  "approval_status",       // CASE-SCOPE
  "verification_status",   // CASE-SCOPE
]);

/**
 * Case-scope columns.
 *
 * `human_review_status`, `approval_status` and `verification_status` describe the CASE, not the
 * individual node. They are repeated identically on every row so a Flow scene can colour or
 * filter the whole graph by audit state without the operator having to join a second dataset.
 *
 * They are deliberately NOT per-node judgements: Shadow never recorded a per-node review or
 * approval, and synthesizing one to make the visualization richer would be a fabricated finding.
 * The per-node value that IS real stays in the `status` column.
 */
function caseScopeStatuses(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const review = byId.get("presentation:human-review");
  const approval = byId.get("presentation:approval");
  // The verification verdict is the hash-chain dimension, which is the dimension the presented
  // scenario actually exercises. ANALYTICAL_CORRECTNESS stays NOT_EVALUATED on its own node and
  // is never folded into this verdict.
  const verification = byId.get("presentation:verify-hash-chain");
  return {
    human_review_status: review?.status ?? "UNKNOWN",
    approval_status: approval?.status ?? "UNKNOWN",
    verification_status: verification?.status ?? "UNKNOWN",
  };
}

/** Council label shape is `"<Role> — <stance> (<confidence>)"`; split without re-deriving. */
function councilFields(node) {
  if (node.type !== "council_voice") return { council_role: "", council_finding: "" };
  const [role, ...rest] = String(node.label_en).split(" — ");
  return { council_role: role.trim(), council_finding: rest.join(" — ").trim() };
}

/**
 * Assign vendor node IDs.
 *
 * Numbering is 1-based in the deterministic order the presentation mapping emits nodes, which is
 * itself derived from the fixtures. It is therefore stable across builds (pinned by test) but is
 * NOT a Shadow identity: `shadow_node_id` carries the authoritative Shadow ID on every row, so a
 * renumbering can never silently detach a row from its evidence.
 */
export function assignVendorIds(nodes) {
  const map = new Map();
  nodes.forEach((n, i) => map.set(n.id, i + 1));
  return map;
}

/**
 * Build the outgoing adjacency for every node.
 *
 * Direction is preserved: a row's `idList` names the nodes that row points TO. The presentation
 * edge list is directed and typed; `idList` can only carry connectivity, so:
 *   - duplicate (from → to) pairs collapse to ONE idList entry (an adjacency list has no
 *     multi-edges) — the typed, directed, un-collapsed edge list remains authoritative in
 *     shadow-flow-presentation-edges.csv;
 *   - the collapsed relation types are preserved positionally in `idListTypes`, joined with `+`
 *     when one target is reached by more than one relation.
 * Entries are sorted ascending by numeric ID so output is deterministic.
 */
export function buildAdjacency(nodes, edges, idMap) {
  const out = new Map(nodes.map((n) => [n.id, new Map()])); // from → (to → Set(types))
  for (const e of edges) {
    if (!out.has(e.from)) continue;          // dangling sources are reported by the validator
    if (!idMap.has(e.to)) continue;          // dangling targets likewise
    const targets = out.get(e.from);
    if (!targets.has(e.to)) targets.set(e.to, new Set());
    targets.get(e.to).add(e.type);
  }
  const adjacency = new Map();
  for (const [from, targets] of out) {
    const sorted = [...targets.entries()].sort((a, b) => idMap.get(a[0]) - idMap.get(b[0]));
    adjacency.set(from, {
      idList: sorted.map(([to]) => idMap.get(to)).join("|"),
      idListTypes: sorted.map(([, types]) => [...types].sort().join("+")).join("|"),
      degree: sorted.length,
    });
  }
  return adjacency;
}

/** Minimal RFC 4180 quoting: quote only when the value needs it, so numeric IDs stay numeric. */
export function csvCell(value) {
  const s = value === undefined || value === null ? "" : String(value);
  return /[",\n\r]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toVendorCsv(columns, rows) {
  const lines = [columns.join(",")];
  for (const r of rows) lines.push(columns.map((c) => csvCell(r[c])).join(","));
  return lines.join("\n") + "\n";
}

/**
 * Build the vendor-compatible graph dataset.
 * Returns { version, columns, rows, csv, stats } — `stats` is what the reviewer and the
 * validator both quote, so counts are never re-derived by hand.
 */
export function buildFlowVendorGraph() {
  const mapping = buildFlowPresentationMapping();
  const idMap = assignVendorIds(mapping.nodes);
  const adjacency = buildAdjacency(mapping.nodes, mapping.edges, idMap);
  const scope = caseScopeStatuses(mapping.nodes);

  const rows = mapping.nodes.map((n) => {
    const adj = adjacency.get(n.id) ?? { idList: "", idListTypes: "", degree: 0 };
    return {
      id: idMap.get(n.id),
      idList: adj.idList,
      idListTypes: adj.idListTypes,
      label_en: n.label_en,
      label_zh: n.label_zh,
      node_type: n.type,
      status: n.status,
      status_family: n.status_family,
      presentation_group: n.group,
      shadow_node_id: n.id,
      evidence_ref: n.source_ref,
      ...councilFields(n),
      is_first_failure: n.refs?.is_first_failure === true,
      lineage_order: n.sequence ?? "",
      is_affected_downstream: n.refs?.is_affected_downstream === true,
      ...scope,
    };
  });

  const adjacencyPairs = rows.reduce((sum, r) => sum + (r.idList ? r.idList.split("|").length : 0), 0);
  return {
    version: FLOW_VENDOR_CSV_VERSION,
    presentation_version: mapping.presentation_version,
    presented_scenario: PRESENTED_SCENARIO,
    case_id: mapping.case_id,
    generated_at: mapping.generated_at,          // fixture timestamp, never wall-clock
    columns: VENDOR_CSV_COLUMNS,
    rows,
    csv: toVendorCsv(VENDOR_CSV_COLUMNS, rows),
    stats: {
      node_rows: rows.length,
      typed_edges: mapping.edges.length,         // authoritative directed+typed edge count
      adjacency_pairs: adjacencyPairs,           // idList entries after multi-edge collapse
      collapsed_multi_edges: mapping.edges.length - adjacencyPairs,
      first_failure_rows: rows.filter((r) => r.is_first_failure).length,
      downstream_rows: rows.filter((r) => r.is_affected_downstream).length,
      council_rows: rows.filter((r) => r.council_role).length,
      lineage_rows: rows.filter((r) => r.lineage_order !== "").length,
      isolated_rows: rows.filter((r) => !r.idList).length,
    },
  };
}
