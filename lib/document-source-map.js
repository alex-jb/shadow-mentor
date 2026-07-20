// Document Source-Map v1 — the parser-agnostic, verifiable binding between a raw
// source document and the structured values extracted from it (spec/document-
// source-map-v1.json). This is Shadow-native evidence, not a parser: OpenDataLoader
// PDF / MarkItDown / OfficeCLI / an OCR service are swappable backends recorded in
// `parser`; Shadow owns the binding conclusion -> page -> region -> value -> audit.
//
// Two integrity guarantees, mirroring the reason-code-dictionary governance pattern:
//   - document_hash binds the map to the RAW file: verifyBoundToDocument() fails if
//     the underlying document is swapped after the fact (post-hoc-swap-evident).
//   - computeSourceMapHash() gives a stable hash to pin the map as an attestation-
//     bound evidence field (like dictionary_hash), so the map itself is tamper-evident.
//
// Discipline: `confidence` is the parser's self-report and is NEVER correctness. The
// map records what the parser CLAIMED plus the raw region so a human / second parser
// can verify. Nothing here certifies an extracted value is right.
import { createHash } from "node:crypto";

export const SOURCE_MAP_VERSION = "1.1.0";
// Back-compat: 1.1.0 adds the optional render_hash / render_media_type (bind the
// human-visible render, not just the raw bytes — surfaced by the office-evidence
// spike). 1.0.0 maps stay valid; the only change is two optional fields.
export const SUPPORTED_SOURCE_MAP_VERSIONS = Object.freeze(["1.0.0", "1.1.0"]);
const SUPPORTED_SET = new Set(SUPPORTED_SOURCE_MAP_VERSIONS);
export const CONTENT_TYPES = Object.freeze([
  "line", "paragraph", "table_cell", "table", "figure", "formula", "image", "heading", "other",
]);
const CONTENT_TYPE_SET = new Set(CONTENT_TYPES);

// JCS-style sorted-key canonicalization — identical shape to the demo + attest-core,
// so a map hashed here verifies byte-for-byte elsewhere.
function canonicalize(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalize).join(",") + "]";
  const k = Object.keys(v).sort();
  return "{" + k.map((key) => JSON.stringify(key) + ":" + canonicalize(v[key])).join(",") + "}";
}

const normHash = (h) => String(h ?? "").replace(/^sha256:/i, "").toLowerCase();

/** sha256:<hex> of the raw source bytes — binds a source-map to that exact file. */
export function computeDocumentHash(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes ?? []);
  return "sha256:" + createHash("sha256").update(buf).digest("hex");
}

/**
 * Stable hash over the map EXCLUDING its own source_map_hash field, for pinning the
 * map as an attestation-bound evidence field (same role as dictionary_hash).
 */
export function computeSourceMapHash(map) {
  const { source_map_hash, ...rest } = map ?? {};
  return "sha256:" + createHash("sha256").update(canonicalize(rest), "utf-8").digest("hex");
}

/**
 * Is this map bound to the given raw document bytes? Post-hoc-swap detection: recompute
 * the document hash from the actual bytes and compare to the map's claim.
 * @returns {{bound:boolean, actual:string, claimed:string}}
 */
export function verifyBoundToDocument(map, bytes) {
  const actual = computeDocumentHash(bytes);
  const claimed = "sha256:" + normHash(map?.document_hash);
  return { bound: normHash(actual) === normHash(claimed), actual, claimed };
}

/**
 * Build a Document Source-Map (+ its embeddable binding) from analysis claims — the
 * connective tissue from a scan/analysis (claim → source) to the evidence primitive.
 * Each claim maps to an entry; the result's { source_map_hash, document_hash } is what
 * you embed in a bundle event/extension so the Banking Profile's
 * document_source_traceability field sees it. Claims may already carry source-map
 * fields (field/page/region/raw_text/normalized_value/confidence) or the looser
 * {text, source}/{text, cell} scan shape — both are accepted.
 * @returns {{source_map:object, source_map_hash:string, document_hash:string|null}}
 */
export function buildSourceMapFromClaims(claims, opts = {}) {
  const {
    documentBytes, documentHash, mediaType = "application/pdf",
    renderBytes, renderHash, renderMediaType = "image/png",
    parser = "claude-vision", parserVersion = null, page = 1, extractedAtUtc,
  } = opts;
  const document_hash = documentHash
    ?? (documentBytes != null ? computeDocumentHash(documentBytes) : "sha256:" + "0".repeat(64));
  const render_hash = renderHash ?? (renderBytes != null ? computeDocumentHash(renderBytes) : undefined);
  const map = {
    source_map_version: SOURCE_MAP_VERSION,
    document_hash,
    document_media_type: mediaType,
    ...(render_hash ? { render_hash, render_media_type: renderMediaType } : {}),
    parser,
    parser_version: parserVersion,
    extracted_at_utc: extractedAtUtc ?? new Date().toISOString(),
    entries: (Array.isArray(claims) ? claims : []).map((c) => {
      const entry = {
        page: Number.isInteger(c.page) ? c.page : page,
        content_type: c.content_type ?? "line",
        raw_text: String(c.raw_text ?? c.source ?? c.text ?? ""),
      };
      if (c.field != null) entry.field = c.field;
      if (Array.isArray(c.region)) entry.region = c.region;
      if (c.normalized_value !== undefined) entry.normalized_value = c.normalized_value;
      else if (c.value !== undefined) entry.normalized_value = c.value;
      if (typeof c.confidence === "number") entry.confidence = c.confidence;
      return entry;
    }),
  };
  return { source_map: map, source_map_hash: computeSourceMapHash(map), document_hash };
}

/**
 * Structural validation of a source-map (not value-correctness — that's not knowable).
 * @returns {{valid:boolean, errors:string[]}}
 */
export function validateSourceMap(map) {
  const errors = [];
  if (!map || typeof map !== "object") return { valid: false, errors: ["source-map must be an object"] };
  if (!SUPPORTED_SET.has(map.source_map_version)) {
    errors.push(`source_map_version must be one of ${SUPPORTED_SOURCE_MAP_VERSIONS.join(", ")}`);
  }
  if (!/^sha256:[0-9a-f]{64}$/i.test(String(map.document_hash ?? ""))) {
    errors.push("document_hash must be 'sha256:<64 hex>'");
  }
  // v1.1 optional render binding — the human-visible rendering, hashed
  if (map.render_hash !== undefined && !/^sha256:[0-9a-f]{64}$/i.test(String(map.render_hash))) {
    errors.push("render_hash must be 'sha256:<64 hex>' if present");
  }
  if (map.render_media_type !== undefined && typeof map.render_media_type !== "string") {
    errors.push("render_media_type must be a string if present");
  }
  if (typeof map.parser !== "string" || !map.parser.trim()) errors.push("parser must be a non-empty string");
  if (!Array.isArray(map.entries)) {
    errors.push("entries must be an array");
    return { valid: errors.length === 0, errors };
  }
  map.entries.forEach((e, i) => {
    const at = `entries[${i}]`;
    if (!e || typeof e !== "object") { errors.push(`${at} must be an object`); return; }
    if (!Number.isInteger(e.page) || e.page < 1) errors.push(`${at}.page must be a positive integer`);
    if (!CONTENT_TYPE_SET.has(e.content_type)) errors.push(`${at}.content_type must be one of ${CONTENT_TYPES.join(", ")}`);
    if (typeof e.raw_text !== "string") errors.push(`${at}.raw_text must be a string`);
    if (e.region !== undefined) {
      const r = e.region;
      if (!Array.isArray(r) || r.length !== 4 || !r.every((n) => typeof n === "number" && n >= 0 && n <= 1)) {
        errors.push(`${at}.region must be [x0,y0,x1,y1] numbers in 0..1`);
      } else if (r[0] > r[2] || r[1] > r[3]) {
        errors.push(`${at}.region must have x0<=x1 and y0<=y1`);
      }
    }
    if (e.confidence !== undefined && !(typeof e.confidence === "number" && e.confidence >= 0 && e.confidence <= 1)) {
      errors.push(`${at}.confidence must be a number in 0..1 if present`);
    }
  });
  return { valid: errors.length === 0, errors };
}
