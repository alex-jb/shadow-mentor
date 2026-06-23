// lib/flow-export.js
// ──────────────────────────────────────────────────────────────────
// Shadow → Flow Spatial Cognitive Platform CSV exporter.
//
// Takes the output of runLoanCouncil() and emits a Flow-ingestable
// wide CSV. Flow's SCP demos (satellite Earth's-14,814-Satellite-Sky,
// equity Daily-Return-Volatility) ingest standard tabular data and
// generate spatial layouts from it.
//
// Mirrors the Orallexa-side exporter (markets/auto/export_for_flow.py
// in alex-jb/orallexa-ai-trading-agent). Both agree on a shared
// column convention so Flow can render the joint demo without two
// dataset shapes to reason about.
//
// Surfaced by the 2026-06-22 Jason Marsh call. The 7/31 Y.U. demo
// content path: a single loan dict → runLoanCouncil() → 5 voice
// verdicts → flowExport() → CSV → Flow create_auto_flow → 5-step
// spatial narrative for the dean + vice-provost.
//
// Two output shapes:
//   voicesCsv()    — one row per voice, for "council deliberation"
//                    spatial layout (X=voice, Y=verdict_score,
//                    Z=confidence, color=verdict)
//   thresholdsCsv() — one row per BR threshold, for "compliance
//                     traceability" spatial layout (X=threshold,
//                     Y=actual_value, Z=cutoff, color=source_doc)
//
// Sidecar JSON ships schema_version + render_hints + the raw council
// output so Flow's Dataset API can join CSV + JSON sidecar on
// decision_id.

import { runLoanCouncil } from "./run-loan-council.js";
import { TRACEABILITY } from "./traceability.js";
import { ADVERSE_ACTION_CODES, AA_SOURCES } from "./schemas/adverse-action.js";

export const SCHEMA_VERSION = "shadow-flow-export-v1.0";

// ──────────────────────────────────────────────────────────────────
// Schema — voicesCsv columns
// ──────────────────────────────────────────────────────────────────

export const VOICES_COLUMNS = [
  "decision_id",        // stable per loan, joins everything else
  "voice",              // e.g. "Credit Fundamentals"
  "verdict",            // "approve" | "escalate" | "block"
  "verdict_score",      // numeric encoding for Y-axis: approve=1, escalate=0, block=-1
  "confidence",         // 0-1; for now derived from rule-firing certainty (1.0 unless soft signal)
  "rationale",          // ≤500 chars (matches threat-model.md bounded-leak invariant)
  "primary_concern",    // short tag for color/legend
  "weight",             // aggregator weight (0..1)
];

export const THRESHOLDS_COLUMNS = [
  "decision_id",
  "rule_name",          // e.g. "FICO >= 700"
  "actual_value",       // input value from this loan (e.g. 715)
  "cutoff_value",       // BR threshold (e.g. 700)
  "status",             // "pass" | "fail" | "escalate"
  "governance_layer",   // institutional risk framework | product-line policy | benchmark calibration | regulatory
  "source_doc",         // BRD | Addendum_A | Addendum_B | Addendum_C | Risk_Appetite_Note | CFPB | etc.
  "exam_visible",       // 1 if examiner audit needs to see this rule
];

// ──────────────────────────────────────────────────────────────────
// Verdict → numeric encoding for Flow Y-axis
// ──────────────────────────────────────────────────────────────────

function verdictScore(v) {
  switch (v) {
    case "approve": return 1.0;
    case "escalate": return 0.0;
    case "block": return -1.0;
    case "review": return -0.3;
    case "abstain": return 0.0;
    default: return 0.0;
  }
}

// ──────────────────────────────────────────────────────────────────
// Governance-layer mapping (mirrors docs/threat-model.md §3 + the
// source classification baked into the MCP shadow_traceability tool)
// ──────────────────────────────────────────────────────────────────

function classifyGovernanceLayer(sourceDoc) {
  const s = (sourceDoc || "").toLowerCase();
  if (s.startsWith("brd")) return "institutional risk framework";
  if (s.includes("risk_appetite") || s.includes("risk appetite")) {
    return "benchmark calibration parameter";
  }
  if (s.startsWith("addendum") || s.startsWith("addenda")) {
    return "product-line policy";
  }
  if (s.startsWith("cfpb") || s.startsWith("ecoa") || s.startsWith("reg b") ||
      s.startsWith("sr ") || s.includes("eu ai act")) {
    return "regulatory";
  }
  return "unclassified";
}

// ──────────────────────────────────────────────────────────────────
// Build the per-voice CSV rows
// ──────────────────────────────────────────────────────────────────

export function voicesRows(councilResult, decisionId) {
  const dId = decisionId || `loan_${Date.now()}`;
  const voices = councilResult?.voices ?? [];
  return voices.map((v) => {
    // truncate rationale to keep the bounded-leak invariant from
    // threat-model.md aligned (Class-1 invariant: < 500 chars)
    const rationale = (v.rationale || "").slice(0, 500);
    const primaryConcern = (v.primary_concern || v.voice || "")
      .split(/[—:]/)[0]
      .trim()
      .slice(0, 60);
    return {
      decision_id: dId,
      voice: v.voice,
      verdict: v.verdict,
      verdict_score: verdictScore(v.verdict),
      confidence: typeof v.confidence === "number" ? v.confidence : 1.0,
      rationale,
      primary_concern: primaryConcern,
      weight: typeof v.weight === "number" ? v.weight : 0.2,
    };
  });
}

// ──────────────────────────────────────────────────────────────────
// Build the per-threshold CSV rows
// ──────────────────────────────────────────────────────────────────

export function thresholdsRows(councilResult, loanInput, decisionId) {
  const dId = decisionId || `loan_${Date.now()}`;
  const ta = councilResult?.thresholds_applied ?? {};
  const rp = councilResult?.risk_packet ?? {};

  const rows = [];

  function pushRule(ruleName, actual, cutoff, status, sourceDoc, examVisible = 1) {
    rows.push({
      decision_id: dId,
      rule_name: ruleName,
      actual_value: actual,
      cutoff_value: cutoff,
      status,
      governance_layer: classifyGovernanceLayer(sourceDoc),
      source_doc: sourceDoc,
      exam_visible: examVisible,
    });
  }

  // FICO floor (BRD)
  if (typeof ta.fico_floor === "number" && loanInput) {
    const actual = Number(loanInput.credit_score);
    const cutoff = ta.fico_floor;
    const status = actual >= cutoff ? "pass" : "fail";
    pushRule("FICO >= floor", actual, cutoff, status, "BRD");
  }
  // DTI ceiling (Addendum B)
  if (typeof ta.dti_ceiling === "number" && loanInput) {
    const actual = Number(loanInput.debt_to_income);
    const cutoff = ta.dti_ceiling;
    const status = actual <= cutoff ? "pass" : "escalate";
    pushRule("DTI <= ceiling", actual, cutoff, status, "Addendum_B");
  }
  // LTV ceiling (Addendum C)
  if (typeof ta.ltv_ceiling === "number" && loanInput) {
    const actual = Number(loanInput.loan_to_value);
    const cutoff = ta.ltv_ceiling;
    const status = actual <= cutoff ? "pass" : "escalate";
    pushRule("LTV <= ceiling", actual, cutoff, status, "Addendum_C");
  }
  // VaR ceiling (Risk Appetite Note via Addendum C)
  if (typeof ta.var_ceiling === "number" && rp.var_95_10d != null) {
    const actual = Number(rp.var_95_10d);
    const cutoff = ta.var_ceiling;
    const status = actual <= cutoff ? "pass" : "escalate";
    pushRule(
      "VaR(95%,10d) <= ceiling",
      actual,
      cutoff,
      status,
      "Addendum_C Risk_Appetite_Note",
    );
  }
  // Methodology disclosures (always exam-visible)
  pushRule("VaR/ES Methodology", "historical", "historical", "pass",
    "Addendum_C Risk_Appetite_Note");
  if (typeof ta.var_confidence === "number") {
    pushRule("VaR confidence", ta.var_confidence, 0.95, "pass",
      "Addendum_C Risk_Appetite_Note");
  }
  if (typeof ta.var_horizon_days === "number") {
    pushRule("VaR horizon (days)", ta.var_horizon_days, 10, "pass",
      "Addendum_C Risk_Appetite_Note");
  }
  // Analysis-only invariant (always-on hard rule)
  pushRule("Analysis Only", "analysis-only", "analysis-only", "pass",
    "BRD analysis-only invariant");

  return rows;
}

// ──────────────────────────────────────────────────────────────────
// CSV serialization
// ──────────────────────────────────────────────────────────────────

function csvEscape(val) {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCsv(columns, rows) {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => csvEscape(row[c])).join(","));
  }
  return lines.join("\n") + "\n";
}

export function voicesCsv(councilResult, decisionId) {
  return toCsv(VOICES_COLUMNS, voicesRows(councilResult, decisionId));
}

export function thresholdsCsv(councilResult, loanInput, decisionId) {
  return toCsv(
    THRESHOLDS_COLUMNS,
    thresholdsRows(councilResult, loanInput, decisionId),
  );
}

// ──────────────────────────────────────────────────────────────────
// Sidecar JSON — schema_version + render_hints + raw rows
// ──────────────────────────────────────────────────────────────────

export function sidecarJson(councilResult, loanInput, decisionId) {
  const dId = decisionId || `loan_${Date.now()}`;
  return {
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    decision_id: dId,
    final_verdict: councilResult?.final_verdict,
    loan_input: loanInput,
    render_hints: {
      voices: {
        x_axis: "voice",
        y_axis: "verdict_score",
        z_axis: "confidence",
        color_by: "verdict",
        size_by: "weight",
        label_field: "voice",
        tooltip_fields: ["voice", "verdict", "rationale", "primary_concern"],
      },
      thresholds: {
        x_axis: "rule_name",
        y_axis: "actual_value",
        z_axis: "cutoff_value",
        color_by: "governance_layer",
        size_by: "exam_visible",
        label_field: "rule_name",
        tooltip_fields: ["rule_name", "actual_value", "cutoff_value", "status",
                         "source_doc", "governance_layer"],
      },
    },
    voices_rows: voicesRows(councilResult, dId),
    thresholds_rows: thresholdsRows(councilResult, loanInput, dId),
    adverse_action_codes: Object.fromEntries(
      Object.keys(ADVERSE_ACTION_CODES).map((c) => [
        c,
        { label: ADVERSE_ACTION_CODES[c], source: AA_SOURCES[c] },
      ]),
    ),
  };
}

// ──────────────────────────────────────────────────────────────────
// Convenience: full pipeline — given a loan dict, return both CSV
// strings + sidecar JSON object.
// ──────────────────────────────────────────────────────────────────

export function flowExport(loanInput, decisionId) {
  const result = runLoanCouncil(loanInput);
  const dId = decisionId || `loan_${Date.now()}_${(loanInput.borrower_rating || "X")}`;
  return {
    decision_id: dId,
    final_verdict: result.final_verdict,
    voices_csv: voicesCsv(result, dId),
    thresholds_csv: thresholdsCsv(result, loanInput, dId),
    sidecar: sidecarJson(result, loanInput, dId),
  };
}
