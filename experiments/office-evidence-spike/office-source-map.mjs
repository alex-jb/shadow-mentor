#!/usr/bin/env node
// Turn a (mock) Office extraction into a Document Source-Map v1 with DUAL binding:
// document_hash (raw bytes) + render_hash (the human-visible PNG). Dependency-free;
// reuses lib/document-source-map.js. Deletable spike — a real OfficeCLI adapter drops
// in behind this same contract. See README for the v1.1 render_hash finding.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SOURCE_MAP_VERSION, computeDocumentHash, computeSourceMapHash, validateSourceMap,
} from "../../lib/document-source-map.js";

const here = dirname(fileURLToPath(import.meta.url));
const ex = JSON.parse(readFileSync(join(here, "fixtures", "example.office-extract.json"), "utf-8"));

// raw workbook bytes (mock) → document_hash; rendered PNG → render_hash
const document_hash = computeDocumentHash(Buffer.from(ex.raw_bytes_ref ?? ex.document));
const render_hash = computeDocumentHash(readFileSync(resolve(here, ex.render_image)));

const map = {
  source_map_version: SOURCE_MAP_VERSION,
  document_hash,
  document_media_type: ex.document_media_type,
  render_hash,                          // v1.1 candidate: bind the human-visible render too
  render_media_type: ex.render_media_type,
  parser: "officecli",
  parser_version: "mock-0.0.0",
  extracted_at_utc: "2026-07-20T00:00:00.000Z",
  entries: ex.cells.map((c) => ({
    field: c.field,
    page: 1, // sheet index would map here for multi-sheet books
    region: c.region,
    content_type: "table_cell",
    // raw_text keeps the full cell context a plain value drops: sheet, ref, FORMULA
    raw_text: `${c.sheet}!${c.ref}${c.formula ? " " + c.formula : ""} => ${c.value}`,
    normalized_value: c.value,
  })),
};

const v = validateSourceMap(map); // render_hash/render_media_type are ignored extras in v1
const source_map_hash = computeSourceMapHash(map); // covers render_hash → render binding is pinned

console.log(JSON.stringify({
  valid: v.valid,
  errors: v.errors,
  dual_binding: { document_hash, render_hash },
  source_map_hash,
  entries: map.entries.length,
  sample_entry: map.entries[0],
  note: "raw_text preserves the formula the cached value alone would drop; render_hash binds what the reviewer saw",
}, null, 2));
