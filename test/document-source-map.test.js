// Tests for the Document Source-Map v1 evidence primitive (lib/document-source-map.js):
// structural validation, the document-binding (post-hoc-swap detection = the moat),
// and the attestation-pin hash.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SOURCE_MAP_VERSION, CONTENT_TYPES,
  computeDocumentHash, computeSourceMapHash, verifyBoundToDocument, validateSourceMap,
  buildSourceMapFromClaims,
} from "../lib/document-source-map.js";

const RAW = Buffer.from("%PDF-1.7 ... Cedar Ridge ... DTI 0.41 ...");

function validMap(bytes = RAW) {
  return {
    source_map_version: SOURCE_MAP_VERSION,
    document_hash: computeDocumentHash(bytes),
    document_media_type: "application/pdf",
    parser: "opendataloader-pdf",
    parser_version: "2.1.0",
    extracted_at_utc: "2026-07-20T00:00:00.000Z",
    entries: [
      { field: "debt_to_income", page: 2, region: [0.55, 0.41, 0.92, 0.45], content_type: "table_cell", raw_text: "0.41", normalized_value: 0.41, confidence: 0.96 },
      { field: "credit_score", page: 2, content_type: "table_cell", raw_text: "706", normalized_value: 706 },
    ],
  };
}

test("validateSourceMap accepts a well-formed map", () => {
  const r = validateSourceMap(validMap());
  assert.equal(r.valid, true, r.errors.join("; "));
});

test("validateSourceMap rejects each structural defect", () => {
  const bad = (mut) => { const m = validMap(); mut(m); return validateSourceMap(m); };
  assert.match(bad(m => m.source_map_version = "9").errors.join(), /source_map_version/);
  assert.match(bad(m => m.document_hash = "nope").errors.join(), /document_hash/);
  assert.match(bad(m => m.parser = "").errors.join(), /parser/);
  assert.match(bad(m => m.entries = {}).errors.join(), /entries must be an array/);
  assert.match(bad(m => m.entries[0].page = 0).errors.join(), /page must be a positive integer/);
  assert.match(bad(m => m.entries[0].content_type = "blob").errors.join(), /content_type/);
  assert.match(bad(m => m.entries[0].raw_text = 5).errors.join(), /raw_text/);
  assert.match(bad(m => m.entries[0].region = [0.5, 0.4, 0.2, 0.9]).errors.join(), /x0<=x1/); // x0>x1
  assert.match(bad(m => m.entries[0].region = [0, 0, 2, 1]).errors.join(), /0\.\.1/);          // out of range
  assert.match(bad(m => m.entries[0].confidence = 1.5).errors.join(), /confidence/);
});

test("content_types are the frozen enum", () => {
  assert.ok(CONTENT_TYPES.includes("table_cell") && CONTENT_TYPES.includes("formula"));
  assert.throws(() => CONTENT_TYPES.push("x")); // frozen
});

test("computeDocumentHash is stable + sha256-prefixed", () => {
  assert.equal(computeDocumentHash(RAW), computeDocumentHash(RAW));
  assert.match(computeDocumentHash(RAW), /^sha256:[0-9a-f]{64}$/);
});

test("MOAT: verifyBoundToDocument true for the real file, false after a post-hoc swap", () => {
  const map = validMap(RAW);
  assert.equal(verifyBoundToDocument(map, RAW).bound, true);
  // someone swaps the underlying document after the map was produced/signed:
  const swapped = Buffer.from("%PDF-1.7 ... Cedar Ridge ... DTI 0.29 ..."); // one number changed
  const r = verifyBoundToDocument(map, swapped);
  assert.equal(r.bound, false);
  assert.notEqual(r.actual, r.claimed);
});

test("buildSourceMapFromClaims: accepts the loose scan {text, source} shape → a valid, bound map", () => {
  const claims = [
    { field: "debt_to_income", text: "DTI 0.41 over the 0.36 ceiling", source: "0.41", value: 0.41, page: 2, region: [0.55, 0.41, 0.92, 0.45], confidence: 0.96 },
    { text: "LTV 0.83 above the 0.80 preferred max", source: "0.83" }, // no field/page → defaults
  ];
  const { source_map, source_map_hash, document_hash } = buildSourceMapFromClaims(claims, {
    documentBytes: RAW, parser: "claude-vision", extractedAtUtc: "2026-07-20T00:00:00.000Z",
  });
  assert.equal(validateSourceMap(source_map).valid, true, validateSourceMap(source_map).errors.join("; "));
  assert.equal(document_hash, computeDocumentHash(RAW));
  assert.equal(source_map_hash, computeSourceMapHash(source_map));
  assert.equal(source_map.entries[0].normalized_value, 0.41);
  assert.equal(source_map.entries[1].page, 1);            // default
  assert.equal(source_map.entries[1].content_type, "line"); // default
});

test("computeSourceMapHash is stable, ignores its own field, and moves when content changes", () => {
  const map = validMap();
  const h1 = computeSourceMapHash(map);
  assert.match(h1, /^sha256:[0-9a-f]{64}$/);
  // pinning the hash INTO the map must not change the hash (field is excluded)
  const pinned = { ...map, source_map_hash: h1 };
  assert.equal(computeSourceMapHash(pinned), h1);
  // altering an extracted value changes the hash → tamper-evident
  const edited = validMap();
  edited.entries[0].normalized_value = 0.29;
  assert.notEqual(computeSourceMapHash(edited), h1);
});
