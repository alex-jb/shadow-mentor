// lib/enforce-dictionary-governance.js
// Reason-code dictionary version governance. The dictionary_hash bound into an
// attestation proves the reasons weren't edited after signing; this layer adds
// the missing half — proving WHICH governed dictionary version produced them, and
// detecting a swap to an unregistered (ungoverned) dictionary even when that
// dictionary is internally self-consistent. The registry
// (lib/schemas/reason-code-dictionary-registry.json) is the source of truth; a
// drift test keeps it in sync with the live dictionary.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const REGISTRY = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "schemas", "reason-code-dictionary-registry.json"), "utf8")
);

export function loadDictionaryRegistry() { return REGISTRY; }

function normHash(h) { return String(h ?? "").replace(/^sha256:/, "").toLowerCase(); }

/** Resolve a dictionary_hash to its registered, lifecycle-managed version. */
export function resolveDictionaryVersion(dictHash, registry = REGISTRY) {
  const norm = normHash(dictHash);
  if (!norm) return { registered: false, hash: norm, reason: "no hash supplied" };
  const entry = (registry.dictionaries || []).find((e) => normHash(e.dictionary_hash) === norm);
  return entry ? { registered: true, hash: norm, ...entry } : { registered: false, hash: norm, reason: "hash not in registry" };
}

/** Pull the bound dictionary_hash out of a bundle (event/header extensions or payloads). */
export function extractDictionaryHash(bundle) {
  const KEYS = ["dictionary_hash", "reason_code_dictionary_sha256", "dictionary_sha256"];
  const scan = (o) => { if (!o) return null; for (const k of KEYS) if (o[k] != null) return o[k]; return null; };
  const h = bundle.header || {};
  for (const obj of [h, h.extensions]) { const v = scan(obj); if (v) return v; }
  for (const e of bundle.events || []) for (const obj of [e.extensions, e]) { const v = scan(obj); if (v) return v; }
  return null;
}

/**
 * Governance verdict for a bundle: is its bound reason-code dictionary a known,
 * governed, non-retired version?
 * @returns {{ok, status, detail, hash?, schema_version?, dictionary_status?}}
 *   status: "ok" | "no_binding" | "unregistered" | "retired"
 */
export function checkDictionaryGovernance(bundle, { registry = REGISTRY } = {}) {
  const hash = extractDictionaryHash(bundle);
  if (!hash) return { ok: false, status: "no_binding", detail: "no reason-code dictionary_hash bound in the bundle" };
  const r = resolveDictionaryVersion(hash, registry);
  const short = normHash(hash).slice(0, 12) + "…";
  if (!r.registered) return { ok: false, status: "unregistered", hash: normHash(hash),
    detail: `dictionary_hash ${short} is NOT in the registry — possible dictionary swap or an ungoverned edit` };
  if (r.status === "retired") return { ok: false, status: "retired", hash: normHash(hash), schema_version: r.schema_version, dictionary_status: r.status,
    detail: `resolves to ${r.schema_version}, which is RETIRED${r.superseded_by ? ` (superseded by ${r.superseded_by})` : ""}` };
  return { ok: true, status: "ok", hash: normHash(hash), schema_version: r.schema_version, dictionary_status: r.status,
    detail: `resolves to governed ${r.schema_version} (${r.status})` };
}
