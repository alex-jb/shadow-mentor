#!/usr/bin/env node
// OpenDataLoader PDF adapter (skeleton) — maps its JSON output to a Document
// Source-Map v1 so it can be benchmarked as a swappable backend. OpenDataLoader is
// Java 11+ (has a Node.js SDK); per the radar it runs OUT OF PROCESS — no Java
// runtime is pulled into this monorepo. The pure mapper is the testable core; the
// runner shells out and degrades gracefully when the tool isn't installed.
//
// Reference: opendataloader-project/opendataloader-pdf — "JSON (with bounding boxes
// for every element), per-page, reading order; text/table/image/formula". Bboxes are
// absolute page units, so we normalize by page width/height into the 0..1 region the
// source-map uses. FIELD NAMES ARE DEFENSIVE — verify against a real `--format json`
// dump when wiring (that's the one thing this skeleton can't confirm offline).
import { computeDocumentHash, SOURCE_MAP_VERSION } from "../../../lib/document-source-map.js";

// ODL element type → source-map content_type
const TYPE_MAP = {
  heading: "heading", title: "heading", text: "paragraph", paragraph: "paragraph",
  line: "line", table: "table", table_cell: "table_cell", cell: "table_cell",
  image: "image", figure: "figure", formula: "formula",
};
const pick = (o, ...keys) => { for (const k of keys) if (o?.[k] !== undefined) return o[k]; return undefined; };

/**
 * Pure mapper: OpenDataLoader JSON → Document Source-Map v1. Testable offline.
 * @param {object} odl - parsed OpenDataLoader JSON ({ pages: [{ page_number, width, height, elements: [...] }] })
 * @param {{documentHash:string, documentMediaType?:string, parserVersion?:string, renderHash?:string}} opts
 */
export function mapOpenDataLoaderToSourceMap(odl, opts = {}) {
  const { documentHash, documentMediaType = "application/pdf", parserVersion = null, renderHash } = opts;
  const pages = odl?.pages ?? [];
  const entries = [];
  for (const p of pages) {
    const pageNo = pick(p, "page_number", "page", "index") ?? 1;
    const W = pick(p, "width", "page_width") || 1;
    const H = pick(p, "height", "page_height") || 1;
    for (const el of pick(p, "elements", "items", "blocks") ?? []) {
      const type = String(pick(el, "type", "kind", "category") ?? "other").toLowerCase();
      const text = pick(el, "text", "content", "value") ?? "";
      const bbox = pick(el, "bbox", "bounding_box", "box"); // [x0,y0,x1,y1] absolute
      const entry = {
        page: Number.isInteger(pageNo) ? pageNo : 1,
        content_type: TYPE_MAP[type] ?? "other",
        raw_text: String(text),
      };
      if (Array.isArray(bbox) && bbox.length === 4) {
        // normalize to 0..1, clamp (guards against off-page coords / bad page dims)
        const clamp = (n) => Math.min(1, Math.max(0, n));
        entry.region = [clamp(bbox[0] / W), clamp(bbox[1] / H), clamp(bbox[2] / W), clamp(bbox[3] / H)];
      }
      entries.push(entry);
    }
  }
  return {
    source_map_version: SOURCE_MAP_VERSION,
    document_hash: documentHash,
    document_media_type: documentMediaType,
    ...(renderHash ? { render_hash: renderHash, render_media_type: "image/png" } : {}),
    parser: "opendataloader-pdf",
    parser_version: parserVersion,
    extracted_at_utc: null, // stamp at call site; kept null here for deterministic tests
    entries,
  };
}

/**
 * Runner: shell out to OpenDataLoader out-of-process, map the JSON to a source-map.
 * Throws a clear, benchmark-skippable error when the tool isn't installed.
 */
export async function extractSourceMap(pdfPath, opts = {}) {
  const { readFileSync } = await import("node:fs");
  const { execFileSync } = await import("node:child_process");
  const cmd = process.env.OPENDATALOADER_CMD || "opendataloader-pdf"; // or a jar wrapper
  let out;
  try {
    out = execFileSync(cmd, ["--format", "json", pdfPath], { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(`OpenDataLoader not found (cmd "${cmd}"). Install it (Java 11+) or set OPENDATALOADER_CMD; the benchmark will skip this parser. See README.`);
    }
    throw new Error(`OpenDataLoader failed on ${pdfPath}: ${err.message}`);
  }
  const documentHash = computeDocumentHash(readFileSync(pdfPath));
  return mapOpenDataLoaderToSourceMap(JSON.parse(out), { ...opts, documentHash });
}

// ── demonstrator: map the mock ODL output → source-map, validate ──────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const { validateSourceMap } = await import("../../../lib/document-source-map.js");
  const here = dirname(fileURLToPath(import.meta.url));
  const odl = JSON.parse(readFileSync(join(here, "fixtures", "opendataloader-output.example.json"), "utf-8"));
  const map = mapOpenDataLoaderToSourceMap(odl, { documentHash: computeDocumentHash(Buffer.from("mock.pdf")) });
  const v = validateSourceMap(map);
  console.log(JSON.stringify({ valid: v.valid, errors: v.errors, entries: map.entries.length, sample: map.entries.find((e) => e.region) }, null, 2));
}
