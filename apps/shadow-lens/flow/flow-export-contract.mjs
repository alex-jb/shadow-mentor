// apps/shadow-lens/flow/flow-export-contract.mjs
// The versioned Shadow → Flow export contract. Flattens a banking narrative into a row table Flow
// can ingest as a spatial data-story: each row is one FACT (a council stance, a metric, an evidence
// item, or a relationship) carrying the shared case + decision fields. Deterministic + offline +
// non-secret. Flow is the PRESENTATION layer; it is NOT a runtime dependency of the Mock demo — this
// export is prepared locally and referenced by the offline presenter, never fetched over the network.

export const FLOW_EXPORT_VERSION = "shadow-flow-export/1.0";

const BASE = (n) => ({
  schema_version: FLOW_EXPORT_VERSION,
  case_id: n.case_id,
  generated_at: n.fixture_timestamp,      // deterministic fixture timestamp, not wall-clock
  recommendation: n.decision.recommendation,
  compliance_status: n.decision.compliance_status,
  signed_result_status: n.decision.signed_result_status,
  audit_reference: n.decision.audit_reference,
  mode_label: n.decision.mode_label,
});

// A stable, closed set of columns so the CSV header never drifts.
const COLUMNS = [
  "schema_version", "case_id", "generated_at", "row_type", "council_voice", "stance", "confidence",
  "risk_category", "metric_name", "metric_value", "evidence_id", "evidence_label",
  "relationship_from", "relationship_to", "relationship_type",
  "recommendation", "compliance_status", "signed_result_status", "audit_reference", "mode_label",
];

export function exportFlowContract(n) {
  const base = BASE(n);
  const rows = [];
  for (const c of n.council)
    rows.push({ ...base, row_type: "council", council_voice: c.voice, stance: c.stance, confidence: c.confidence });
  for (const m of n.metrics)
    rows.push({ ...base, row_type: "metric", metric_name: m.name, metric_value: m.value, risk_category: m.category });
  for (const e of n.evidence)
    rows.push({ ...base, row_type: "evidence", evidence_id: e.evidence_id, evidence_label: e.label });
  for (const r of n.relationships)
    rows.push({ ...base, row_type: "relationship", relationship_from: r.from, relationship_to: r.to, relationship_type: r.type });

  return {
    schema_version: FLOW_EXPORT_VERSION,
    case_id: n.case_id,
    generated_at: n.fixture_timestamp,
    title: `Shadow council — ${n.case_id}`,
    row_count: rows.length,
    rows,
    csv: toCsv(rows),
  };
}

function toCsv(rows) {
  const cell = (v) => v === undefined || v === null ? "" : JSON.stringify(v);
  const lines = [COLUMNS.join(",")];
  for (const r of rows) lines.push(COLUMNS.map((c) => cell(r[c])).join(","));
  return lines.join("\n") + "\n";
}

export { COLUMNS as FLOW_EXPORT_COLUMNS };
