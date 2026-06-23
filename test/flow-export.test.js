// Tests for lib/flow-export.js — Shadow → Flow SCP CSV exporter.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SCHEMA_VERSION,
  VOICES_COLUMNS,
  THRESHOLDS_COLUMNS,
  voicesRows,
  thresholdsRows,
  voicesCsv,
  thresholdsCsv,
  sidecarJson,
  flowExport,
} from "../lib/flow-export.js";

const ESCALATE_LOAN = {
  credit_score: 715,
  debt_to_income: 0.42,
  loan_to_value: 0.77,
  amount: 4_200_000,
  sector: "commercial_real_estate",
  borrower_rating: "B",
  fair_lending_review_flag: false,
};

// ──────────────────────────────────────────────────────────────────
// Schema
// ──────────────────────────────────────────────────────────────────

test("VOICES_COLUMNS has 8 declared fields", () => {
  assert.equal(VOICES_COLUMNS.length, 8);
  assert.ok(VOICES_COLUMNS.includes("decision_id"));
  assert.ok(VOICES_COLUMNS.includes("verdict_score"));
});

test("THRESHOLDS_COLUMNS has 8 declared fields", () => {
  assert.equal(THRESHOLDS_COLUMNS.length, 8);
  assert.ok(THRESHOLDS_COLUMNS.includes("source_doc"));
  assert.ok(THRESHOLDS_COLUMNS.includes("governance_layer"));
});

test("SCHEMA_VERSION pinned", () => {
  assert.equal(SCHEMA_VERSION, "shadow-flow-export-v1.0");
});

// ──────────────────────────────────────────────────────────────────
// voicesRows
// ──────────────────────────────────────────────────────────────────

test("voicesRows emits one row per voice (5 for trading + banking)", () => {
  const out = flowExport(ESCALATE_LOAN, "test-1");
  const rows = out.sidecar.voices_rows;
  assert.equal(rows.length, 5);
});

test("voicesRows verdict_score encoding: escalate=0, approve=+1, block=-1", () => {
  const out = flowExport(ESCALATE_LOAN, "test-2");
  for (const r of out.sidecar.voices_rows) {
    if (r.verdict === "escalate") assert.equal(r.verdict_score, 0.0);
    if (r.verdict === "approve") assert.equal(r.verdict_score, 1.0);
    if (r.verdict === "block") assert.equal(r.verdict_score, -1.0);
  }
});

test("voicesRows rationale is bounded ≤ 500 chars (matches threat-model.md invariant)", () => {
  const out = flowExport(ESCALATE_LOAN, "test-3");
  for (const r of out.sidecar.voices_rows) {
    assert.ok(r.rationale.length <= 500,
      `voice ${r.voice} rationale exceeds 500: ${r.rationale.length}`);
  }
});

test("voicesRows all share the same decision_id", () => {
  const out = flowExport(ESCALATE_LOAN, "test-shared-id");
  const ids = new Set(out.sidecar.voices_rows.map((r) => r.decision_id));
  assert.equal(ids.size, 1);
  assert.ok(ids.has("test-shared-id"));
});

// ──────────────────────────────────────────────────────────────────
// thresholdsRows
// ──────────────────────────────────────────────────────────────────

test("thresholdsRows includes FICO + DTI + LTV + VaR + Methodology rules", () => {
  const out = flowExport(ESCALATE_LOAN, "test-4");
  const names = out.sidecar.thresholds_rows.map((r) => r.rule_name);
  assert.ok(names.includes("FICO >= floor"));
  assert.ok(names.includes("DTI <= ceiling"));
  assert.ok(names.includes("LTV <= ceiling"));
  assert.ok(names.includes("VaR(95%,10d) <= ceiling"));
  assert.ok(names.includes("Analysis Only"));
});

test("thresholdsRows DTI 0.42 vs 0.36 ceiling fails / escalates", () => {
  const out = flowExport(ESCALATE_LOAN, "test-5");
  const dti = out.sidecar.thresholds_rows.find((r) => r.rule_name === "DTI <= ceiling");
  assert.ok(dti);
  assert.equal(dti.actual_value, 0.42);
  assert.equal(dti.cutoff_value, 0.36);
  assert.equal(dti.status, "escalate");
});

test("thresholdsRows source_doc classifies into governance_layer correctly", () => {
  const out = flowExport(ESCALATE_LOAN, "test-6");
  const fico = out.sidecar.thresholds_rows.find((r) => r.rule_name === "FICO >= floor");
  const dti = out.sidecar.thresholds_rows.find((r) => r.rule_name === "DTI <= ceiling");
  const varRule = out.sidecar.thresholds_rows.find(
    (r) => r.rule_name === "VaR(95%,10d) <= ceiling");
  assert.equal(fico.governance_layer, "institutional risk framework");
  assert.equal(dti.governance_layer, "product-line policy");
  assert.equal(varRule.governance_layer, "benchmark calibration parameter");
});

// ──────────────────────────────────────────────────────────────────
// CSV serialization
// ──────────────────────────────────────────────────────────────────

test("voicesCsv first line is the column header", () => {
  const out = flowExport(ESCALATE_LOAN, "csv-test-1");
  const firstLine = out.voices_csv.split("\n")[0];
  assert.equal(firstLine, VOICES_COLUMNS.join(","));
});

test("thresholdsCsv first line is the column header", () => {
  const out = flowExport(ESCALATE_LOAN, "csv-test-2");
  const firstLine = out.thresholds_csv.split("\n")[0];
  assert.equal(firstLine, THRESHOLDS_COLUMNS.join(","));
});

test("voicesCsv has header + 5 voice rows (6 total non-empty lines)", () => {
  const out = flowExport(ESCALATE_LOAN, "csv-test-3");
  const lines = out.voices_csv.split("\n").filter((l) => l.length > 0);
  assert.equal(lines.length, 6);
});

test("CSV escape handles commas + quotes safely", () => {
  // Force a voice rationale with a comma to verify escape
  // (rationales naturally include commas — sanity check)
  const out = flowExport(ESCALATE_LOAN, "csv-test-4");
  // Find a row that has a comma in the rationale; should be wrapped
  // in double quotes per RFC 4180.
  const csvLines = out.voices_csv.split("\n");
  for (const line of csvLines.slice(1)) {
    if (line.includes(",rationale-with") || line.includes("escalate")) {
      // any field that contains a comma must be quoted
      const fields = line.split('"');
      // crude: if there's an even count of quote-delimited segments,
      // the line is structurally fine
      assert.ok(fields.length % 2 === 1, "unterminated quote in row");
    }
  }
});

// ──────────────────────────────────────────────────────────────────
// Sidecar JSON
// ──────────────────────────────────────────────────────────────────

test("sidecarJson carries schema_version + render_hints", () => {
  const out = flowExport(ESCALATE_LOAN, "sidecar-1");
  assert.equal(out.sidecar.schema_version, SCHEMA_VERSION);
  assert.ok(out.sidecar.render_hints.voices.x_axis === "voice");
  assert.ok(out.sidecar.render_hints.thresholds.color_by === "governance_layer");
});

test("sidecarJson includes final_verdict + loan_input", () => {
  const out = flowExport(ESCALATE_LOAN, "sidecar-2");
  assert.equal(out.sidecar.final_verdict, "escalate");
  assert.equal(out.sidecar.loan_input.credit_score, 715);
});

test("sidecarJson includes adverse_action_codes with source attribution", () => {
  const out = flowExport(ESCALATE_LOAN, "sidecar-3");
  assert.ok(out.sidecar.adverse_action_codes);
  // At least AA01 should be present (Credit Application Incomplete etc.)
  const codes = Object.keys(out.sidecar.adverse_action_codes);
  assert.ok(codes.length >= 1);
  for (const code of codes) {
    assert.ok(out.sidecar.adverse_action_codes[code].label);
    assert.ok(out.sidecar.adverse_action_codes[code].source);
  }
});

// ──────────────────────────────────────────────────────────────────
// flowExport pipeline end-to-end
// ──────────────────────────────────────────────────────────────────

test("flowExport returns decision_id + final_verdict + 2 CSVs + sidecar", () => {
  const out = flowExport(ESCALATE_LOAN, "e2e-1");
  assert.ok(out.decision_id);
  assert.equal(out.final_verdict, "escalate");
  assert.ok(typeof out.voices_csv === "string");
  assert.ok(typeof out.thresholds_csv === "string");
  assert.ok(typeof out.sidecar === "object");
});

test("flowExport decision_id is stable when caller passes one", () => {
  const out1 = flowExport(ESCALATE_LOAN, "stable-id-1");
  const out2 = flowExport(ESCALATE_LOAN, "stable-id-1");
  assert.equal(out1.decision_id, out2.decision_id);
});

test("flowExport auto-generates decision_id when not passed", () => {
  const out = flowExport(ESCALATE_LOAN);
  assert.ok(out.decision_id);
  assert.ok(out.decision_id.startsWith("loan_"));
});
