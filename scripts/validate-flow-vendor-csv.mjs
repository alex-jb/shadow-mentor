#!/usr/bin/env node
// scripts/validate-flow-vendor-csv.mjs
// Graph validation for the vendor-compatible Shadow → Flow CSV.
//
// Validates the COMMITTED file by parsing it back from disk (not the in-memory builder), so a
// hand-edit of the CSV is caught rather than silently re-derived. Offline; no network.
//
//   node scripts/validate-flow-vendor-csv.mjs                 # validate the committed CSV
//   node scripts/validate-flow-vendor-csv.mjs --json          # machine-readable result
//
// Exit 0 = all checks pass. Exit 1 = at least one ERROR. INFO findings never fail the run:
// isolated nodes are a real property of the Shadow fixture, not a defect to be "fixed" by
// inventing edges (see reports/flow-v11/VENDOR_CSV_TRANSFORMATION.md §Isolated nodes).

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { VENDOR_CSV_COLUMNS } from "../apps/shadow-lens/flow/flow-vendor-csv.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSV_PATH = join(ROOT, "reports", "flow-v11", "demo-package", "shadow-flow-vendor-graph.csv");

/** RFC 4180 parser (quoted fields, escaped quotes, embedded commas/newlines). */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function validateVendorCsv(text) {
  const findings = [];
  const add = (severity, check, detail) => findings.push({ severity, check, detail });

  const grid = parseCsv(text);
  if (!grid.length) {
    add("ERROR", "parse", "CSV is empty");
    return { ok: false, findings, stats: {} };
  }
  const header = grid[0];
  const body = grid.slice(1);

  // 1 — header contract (column order is part of the contract).
  // A header mismatch is terminal: every later check locates its field by column name, so
  // continuing would read undefined cells and report misleading downstream failures.
  if (header.join(",") !== VENDOR_CSV_COLUMNS.join(",")) {
    add("ERROR", "header", `header does not match the pinned contract\n  expected: ${VENDOR_CSV_COLUMNS.join(",")}\n  actual:   ${header.join(",")}`);
    return { ok: false, findings, stats: { node_rows: body.length } };
  }
  const col = (r, name) => r[header.indexOf(name)] ?? "";

  // 2 — one row per node, unique IDs
  const ids = body.map((r) => col(r, "id"));
  const seen = new Set(), dupes = new Set();
  for (const id of ids) (seen.has(id) ? dupes : seen).add(id);
  if (dupes.size) add("ERROR", "unique_ids", `duplicate node id(s): ${[...dupes].sort().join(", ")}`);
  for (const id of ids) {
    if (!/^[0-9]+$/.test(id)) add("ERROR", "unique_ids", `node id ${JSON.stringify(id)} is not a positive integer`);
    if (id.includes("|")) add("ERROR", "unique_ids", `node id ${JSON.stringify(id)} contains the idList delimiter`);
  }

  // 3 — duplicate Shadow provenance IDs would mean one evidence node emitted twice
  const shadowIds = body.map((r) => col(r, "shadow_node_id"));
  const sSeen = new Set(), sDupes = new Set();
  for (const s of shadowIds) (sSeen.has(s) ? sDupes : sSeen).add(s);
  if (sDupes.size) add("ERROR", "no_duplicate_nodes", `duplicate shadow_node_id(s): ${[...sDupes].sort().join(", ")}`);
  for (const [i, s] of shadowIds.entries()) {
    if (!s) add("ERROR", "provenance", `row ${i + 2} has no shadow_node_id — provenance would be lost`);
  }

  // 4 — idList references resolve; no dangling targets; no self-reference
  const idSet = new Set(ids);
  let adjacencyPairs = 0;
  for (const [i, r] of body.entries()) {
    const raw = col(r, "idList");
    if (!raw) continue;
    const targets = raw.split("|");
    adjacencyPairs += targets.length;
    if (new Set(targets).size !== targets.length)
      add("ERROR", "idlist_refs", `row ${i + 2} (id=${col(r, "id")}) repeats a target in idList: ${raw}`);
    for (const t of targets) {
      if (!/^[0-9]+$/.test(t)) add("ERROR", "idlist_refs", `row ${i + 2} idList entry ${JSON.stringify(t)} is not an integer`);
      else if (!idSet.has(t)) add("ERROR", "no_dangling", `row ${i + 2} (id=${col(r, "id")}) references non-existent node ${t}`);
      if (t === col(r, "id")) add("ERROR", "idlist_refs", `row ${i + 2} (id=${t}) references itself`);
    }
    // idListTypes must align positionally with idList
    const types = col(r, "idListTypes");
    const typeCount = types ? types.split("|").length : 0;
    if (typeCount !== targets.length)
      add("ERROR", "idlist_types", `row ${i + 2} has ${targets.length} idList entries but ${typeCount} idListTypes entries`);
  }

  // 5 — bilingual labels required on every row
  for (const [i, r] of body.entries()) {
    if (!col(r, "label_en")) add("ERROR", "bilingual", `row ${i + 2} (id=${col(r, "id")}) missing label_en`);
    if (!col(r, "label_zh")) add("ERROR", "bilingual", `row ${i + 2} (id=${col(r, "id")}) missing label_zh`);
  }

  // 6 — deterministic row ordering: ids ascend 1..N with no gaps
  const expected = body.map((_, i) => String(i + 1));
  if (ids.join(",") !== expected.join(","))
    add("ERROR", "ordering", `rows are not in deterministic ascending id order 1..${body.length}`);

  // 7 — audit-semantic invariants that must survive the projection
  const firstFailure = body.filter((r) => col(r, "is_first_failure") === "true");
  if (firstFailure.length !== 1)
    add("ERROR", "first_failure", `expected exactly one first-failure row, found ${firstFailure.length}`);
  const lineage = body.filter((r) => col(r, "lineage_order") !== "").map((r) => Number(col(r, "lineage_order")));
  const lineageSorted = [...lineage].sort((a, b) => a - b);
  if (lineage.length && lineageSorted.join(",") !== [...new Set(lineageSorted)].join(","))
    add("ERROR", "lineage", "evidence-lineage order contains duplicates");
  for (const r of body) {
    if (col(r, "is_first_failure") === "true" && col(r, "is_affected_downstream") === "true")
      add("ERROR", "markers", `row id=${col(r, "id")} is marked BOTH first-failure and affected-downstream`);
  }
  // case-scope columns must be uniform: a per-row divergence would imply a per-node judgement
  for (const c of ["human_review_status", "approval_status", "verification_status"]) {
    const vals = new Set(body.map((r) => col(r, c)));
    if (vals.size > 1) add("ERROR", "case_scope", `${c} is case-scope but has ${vals.size} distinct values: ${[...vals].join(", ")}`);
  }

  // 8 — INFO: isolated nodes are expected and must NOT be "fixed" by inventing edges
  const referenced = new Set();
  for (const r of body) for (const t of (col(r, "idList") || "").split("|").filter(Boolean)) referenced.add(t);
  const isolated = body.filter((r) => !col(r, "idList") && !referenced.has(col(r, "id")));
  if (isolated.length) {
    add("INFO", "isolated_nodes",
      `${isolated.length} node(s) have no edge in either direction — this is a real property of the ` +
      `Shadow fixture (these council voices cited no evidence; these panels are contextual). ` +
      `Do NOT invent edges to connect them: ${isolated.map((r) => col(r, "shadow_node_id")).join(", ")}`);
  }

  const stats = {
    node_rows: body.length,
    adjacency_pairs: adjacencyPairs,
    isolated_nodes: isolated.length,
    first_failure_rows: firstFailure.length,
    downstream_rows: body.filter((r) => col(r, "is_affected_downstream") === "true").length,
    council_rows: body.filter((r) => col(r, "council_role")).length,
    lineage_rows: lineage.length,
  };
  return { ok: !findings.some((f) => f.severity === "ERROR"), findings, stats };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith("validate-flow-vendor-csv.mjs")) {
  const text = readFileSync(CSV_PATH, "utf8");
  const result = validateVendorCsv(text);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`validating reports/flow-v11/demo-package/shadow-flow-vendor-graph.csv\n`);
    for (const [k, v] of Object.entries(result.stats)) console.log(`  ${k.padEnd(20)} ${v}`);
    console.log();
    const checks = ["header", "unique_ids", "no_duplicate_nodes", "provenance", "idlist_refs",
      "idlist_types", "no_dangling", "bilingual", "ordering", "first_failure", "lineage",
      "markers", "case_scope"];
    for (const c of checks) {
      const bad = result.findings.filter((f) => f.check === c && f.severity === "ERROR");
      console.log(`  [${bad.length ? "FAIL" : " ok "}] ${c}${bad.length ? ` (${bad.length})` : ""}`);
    }
    for (const f of result.findings) console.log(`\n  ${f.severity}: ${f.check}\n    ${f.detail}`);
    console.log(`\n${result.ok ? "VENDOR_CSV_VALID" : "VENDOR_CSV_INVALID"}`);
  }
  process.exit(result.ok ? 0 : 1);
}
