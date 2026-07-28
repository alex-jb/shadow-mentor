// apps/shadow-lens/flow/export-session.mjs
// Section 15: derive all three Flow scenes from ONE real signed Shadow Lens session
// (not permanently-hardcoded fixtures). Every row carries session_id + provenance +
// real_or_fixture + verification_status + scene node id + coverage/confidence, so an
// importer can always tell live data from a demonstration placeholder. Flow renders;
// Shadow owns the analysis provenance + verification. Pure Node, testable.

function csv(rows) {
  if (!rows.length) return "";
  const head = Object.keys(rows[0]);
  return [head.join(","), ...rows.map((r) => head.map((h) => JSON.stringify(r[h] ?? "")).join(","))].join("\n") + "\n";
}

/**
 * @param {object} session - a ShadowLensSession (apps/shadow-lens/contracts)
 * @returns {{ scenes:{audit:object[], risk:object[], council:object[]}, csv:{audit,risk,council}, manifest:object }}
 */
export function exportFlowScenes(session) {
  const sid = session?.session_id ?? "unknown";
  const ver = session?.verification?.record_integrity ?? "unknown";
  const cov = session?.verification?.source_coverage_pct ?? null;
  const conf = session?.verification?.analysis_confidence ?? null;
  const base = { session_id: sid, verification_status: ver, source_coverage_pct: cov, analysis_confidence: conf };

  // Scene 3 · Audit Trace — the real pipeline nodes of THIS session (always real).
  const auditStages = [
    ["capture", session?.capture?.capture_sha256],
    ["ocr", session?.provenance?.source_map_hash],
    ["analysis", session?.provenance?.prompt_hash],
    ["decision", session?.decision?.final_posture ?? null],
    ["verification", ver],
  ];
  const audit = auditStages.map(([stage, ref], i) => ({
    ...base, scene_node_id: `audit-${i}`, stage, evidence_ref: ref ?? "", real_or_fixture: "real",
    provenance: "shadow-lens-session",
  }));

  // Scene 1 · Risk landscape — from the session's source-bound claims (real if present).
  const claims = Array.isArray(session?.claims) ? session.claims : [];
  const sevScore = { info: 0.1, ok: 0.2, warn: 0.6, bad: 0.85, critical: 1.0 };
  const risk = claims.map((c, i) => ({
    ...base, scene_node_id: `risk-${i}`, claim_id: c.claim_id,
    risk: sevScore[c.severity] ?? 0.5, confidence: c.confidence ?? null,
    source_ids: (c.source_ids || []).join("|"),
    real_or_fixture: c.validation_status === "source_bound" ? "real" : "fixture",
    provenance: "claim",
  }));

  // Scene 2 · Agent Council — from the session's reviewers (real if present, else fixture).
  const reviewers = Array.isArray(session?.reviewers) ? session.reviewers : [];
  const council = reviewers.length
    ? reviewers.map((r, i) => ({
        ...base, scene_node_id: `council-${i}`, voice: r.voice ?? `reviewer-${i}`,
        stance: r.stance ?? "", confidence: r.confidence ?? null,
        disagrees_with_final: r.disagrees_with_final ?? false,
        is_center: 0, real_or_fixture: "real", provenance: "reviewer",
      }))
    : [{ ...base, scene_node_id: "council-0", voice: "Final Recommendation", stance: "center", is_center: 1, real_or_fixture: "fixture", provenance: "placeholder" }];

  const manifest = {
    session_id: sid,
    verification_status: ver,
    generated_from: "shadow-lens-session/1.0",
    scenes: { audit: audit.length, risk: risk.length, council: council.length },
    real_rows: [...audit, ...risk, ...council].filter((r) => r.real_or_fixture === "real").length,
    fixture_rows: [...audit, ...risk, ...council].filter((r) => r.real_or_fixture === "fixture").length,
    note: "Flow renders the spatial layer; Shadow signs + verifies the data. Rows tagged real_or_fixture. Import CSVs into Flow Editor; Push Dataset API only when official creds exist.",
  };

  return {
    scenes: { audit, risk, council },
    csv: { audit: csv(audit), risk: csv(risk), council: csv(council) },
    manifest,
  };
}
