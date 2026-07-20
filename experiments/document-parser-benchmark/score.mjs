#!/usr/bin/env node
// Score a parser's Document Source-Map output against human golden truth.
// Dependency-free; consumes spec/document-source-map-v1.json. Deletable experiment.
//
// Usage: node score.mjs [golden.json] [candidate.json]
//   golden.json:    { "fields": [ { "field", "page", "value" } ] }
//   candidate.json: a Document Source-Map v1 (what a parser adapter emits)
// No args → scores the bundled example.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateSourceMap } from "../../lib/document-source-map.js";

const here = dirname(fileURLToPath(import.meta.url));
const goldenPath = process.argv[2] || join(here, "golden", "example.golden.json");
const candPath = process.argv[3] || join(here, "golden", "example.candidate.json");

const golden = JSON.parse(readFileSync(goldenPath, "utf-8"));
const cand = JSON.parse(readFileSync(candPath, "utf-8"));

const validation = validateSourceMap(cand);

// index candidate entries by field (last one wins if duplicated)
const byField = new Map();
for (const e of cand.entries ?? []) if (e.field) byField.set(e.field, e);

let found = 0, pageOk = 0, numMatched = 0, absErrSum = 0;
for (const g of golden.fields) {
  const e = byField.get(g.field);
  if (!e) continue;
  found++;
  if (e.page === g.page) pageOk++;
  if (typeof g.value === "number" && typeof e.normalized_value === "number") {
    numMatched++; absErrSum += Math.abs(e.normalized_value - g.value);
  }
}
const nEntries = (cand.entries ?? []).length;
const withRegion = (cand.entries ?? []).filter((e) => Array.isArray(e.region)).length;

const pct = (n, d) => (d ? +(100 * n / d).toFixed(1) : null);
const report = {
  parser: `${cand.parser}@${cand.parser_version}`,
  valid: validation.valid,
  validation_errors: validation.errors,
  field_recall_pct: pct(found, golden.fields.length),
  page_accuracy_pct: pct(pageOk, found),
  numeric_mae: numMatched ? +(absErrSum / numMatched).toFixed(4) : null,
  traceability_pct: pct(withRegion, nEntries),
  golden_fields: golden.fields.length,
  found,
};
console.log(JSON.stringify(report, null, 2));
