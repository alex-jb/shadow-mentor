#!/usr/bin/env node
// scripts/citation-map-query.mjs
//
// Answer "which Shadow control covers <regulation>?" from docs/citation-map.json
// — the queryable form of the moat. Matches the query (case-insensitive) against
// citation + full name and prints the personas + the exact test files that prove
// coverage, so a bank auditor gets a row lookup, not code archaeology.
//
//   node scripts/citation-map-query.mjs "1002.9"
//   node scripts/citation-map-query.mjs "OFAC"
//   node scripts/citation-map-query.mjs --json "Reg B"
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const q = argv.filter((a) => a !== "--json").join(" ").trim();
if (!q) { process.stderr.write('usage: citation-map-query "<regulation substring>" [--json]\n'); process.exit(2); }

const map = JSON.parse(readFileSync(resolve(ROOT, "docs/citation-map.json"), "utf8"));
const needle = q.toLowerCase();
const hits = map.entries.filter((e) =>
  e.citation.toLowerCase().includes(needle) || e.full_name.toLowerCase().includes(needle));

if (asJson) { process.stdout.write(JSON.stringify(hits, null, 2) + "\n"); process.exit(hits.length ? 0 : 1); }

if (!hits.length) { process.stdout.write(`No Shadow control maps to "${q}".\n`); process.exit(1); }
process.stdout.write(`${hits.length} control(s) covering "${q}":\n\n`);
for (const e of hits) {
  process.stdout.write(`§${e.section}  ${e.citation} — ${e.full_name}\n`);
  process.stdout.write(`   personas : ${e.personas.join(", ") || "—"}\n`);
  process.stdout.write(`   proven by: ${[...e.test_files, ...e.other_refs].join(", ") || "—"} (${e.test_count_raw})\n\n`);
}
