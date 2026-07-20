// lib/enforce-banking-profile.js
// Conformance checker for the Shadow Banking Evidence Profile v1
// (spec/banking-evidence-profile-v1.json). This is the enforced artifact — the
// "is this credit decision auditable?" pass/fail gate that no published standard
// owns. It answers a structural question honestly: does the bundle contain the
// evidence slots a US credit-decision examiner requires, correctly bound and
// tamper-evident? Structural PASS means the slot exists and is tamper-evident; it
// does NOT certify the decision was correct (see the three-layer trust model).
//
// Payloads are content-addressed in a bundle (payload_hash, not inline), so
// value-level checks (e.g. reason codes actually AA-mapped, <=4) run only when the
// caller supplies a `payloads` map keyed by seq or payload_ref. Without payloads,
// value-level fields report "unknown (requires payloads)".
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { checkDictionaryGovernance } from "./enforce-dictionary-governance.js";
import { validateSourceMap, computeSourceMapHash, verifyBoundToDocument } from "./document-source-map.js";

const PROFILE = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "..", "spec", "banking-evidence-profile-v1.json"), "utf8")
);

// scan events[].extensions + header + header.extensions for any of `keys`
function bindingPresent(bundle, keys) {
  const hay = [];
  const h = bundle.header || {};
  hay.push(h, h.extensions || {});
  for (const e of bundle.events || []) hay.push(e.extensions || {}, e);
  for (const obj of hay) for (const k of keys) if (obj && obj[k] != null) return { present: true, detail: `found "${k}"` };
  return { present: false, detail: `none of: ${keys.join(", ")}` };
}

// like bindingPresent but returns the first matching value (not just presence)
function boundValue(bundle, keys) {
  const hay = [bundle.header || {}, (bundle.header || {}).extensions || {}];
  for (const e of bundle.events || []) hay.push(e.extensions || {}, e);
  for (const obj of hay) for (const k of keys) if (obj && obj[k] != null) return obj[k];
  return null;
}
const stripSha = (h) => String(h ?? "").replace(/^sha256:/i, "").toLowerCase();

function eventsByType(bundle, t) { return (bundle.events || []).filter((e) => e.event_type === t); }

function runCheck(field, bundle, { payloads, verified }) {
  const c = field.check;
  switch (c.kind) {
    case "verify": {
      const sig = (bundle.signatures || []).length >= 1;
      if (!sig) return { status: "missing", detail: "no signatures[]" };
      if (verified == null) return { status: "unknown", detail: "signature present; run verifyBundle with a public key for full integrity" };
      return verified.ok ? { status: "present", detail: "verified: chain intact + signature valid" }
        : { status: "missing", detail: `verification FAILED: ${verified.error?.reason || verified.reason || "broken"}` };
    }
    case "event_present":
      return eventsByType(bundle, c.event_type).length
        ? { status: "present", detail: `${c.event_type} event present` }
        : { status: "missing", detail: `no ${c.event_type} event` };
    case "event_present_any": {
      const hit = c.event_types.find((t) => eventsByType(bundle, t).length);
      return hit ? { status: "present", detail: `${hit} event present` } : { status: "missing", detail: `none of: ${c.event_types.join(", ")}` };
    }
    case "header_nonempty": {
      const v = (bundle.header || {})[c.path];
      return Array.isArray(v) && v.length ? { status: "present", detail: `header.${c.path} (${v.length})` } : { status: "missing", detail: `header.${c.path} empty/absent` };
    }
    case "header_present": {
      const v = (bundle.header || {})[c.path];
      return v != null ? { status: "present", detail: `header.${c.path} present` } : { status: "missing", detail: `header.${c.path} absent` };
    }
    case "binding_present": {
      const r = bindingPresent(bundle, c.keys);
      return { status: r.present ? "present" : "missing", detail: r.detail };
    }
    case "dictionary_governed": {
      // present only if a dictionary_hash is bound AND resolves to a governed,
      // non-retired registry version — a swapped/ungoverned dictionary fails.
      const g = checkDictionaryGovernance(bundle);
      return { status: g.ok ? "present" : "missing", detail: g.detail };
    }
    case "source_map_verified": {
      // Enforce the source-map moat, not just its presence: the binding must exist
      // AND (when the map is supplied in payloads) the map must be valid and its hash
      // must match the bound source_map_hash — i.e. it wasn't swapped after signing.
      // If raw document bytes are supplied (payloads.__document_bytes_base64), also
      // verify the document binding (post-hoc file swap → fail).
      const bound = bindingPresent(bundle, c.keys);
      if (!bound.present) return { status: "missing", detail: bound.detail };
      const map = payloads ? Object.values(payloads).find((p) => p && p.source_map_version) : null;
      if (!map) return { status: "unknown", detail: "source_map binding present; supply the source_map in payloads to verify authenticity (hash) + document binding" };
      const v = validateSourceMap(map);
      if (!v.valid) return { status: "missing", detail: `source_map invalid: ${v.errors[0]}` };
      const boundHash = boundValue(bundle, ["source_map_hash"]);
      if (boundHash && stripSha(boundHash) !== stripSha(computeSourceMapHash(map))) {
        return { status: "missing", detail: "source_map_hash does not match the supplied map — the map was altered after signing" };
      }
      const docB64 = payloads.__document_bytes_base64;
      if (docB64) {
        const bind = verifyBoundToDocument(map, Buffer.from(String(docB64), "base64"));
        if (!bind.bound) return { status: "missing", detail: "document_hash does not match the supplied document bytes — file swapped after the map was made" };
        return { status: "present", detail: `source_map verified: hash + document bytes both bound (${map.entries?.length || 0} entries)` };
      }
      return { status: "present", detail: `source_map verified: hash matches binding, ${map.entries?.length || 0} entries, doc ${String(map.document_hash).slice(0, 14)}…` };
    }
    case "payload_field": {
      if (!payloads) return { status: "unknown", detail: `requires payloads to check "${c.field}"` };
      for (const e of bundle.events || []) {
        if (!c.any_event.includes(e.event_type)) continue;
        const p = payloads[e.seq] ?? payloads[e.payload_ref];
        const val = p && p[c.field];
        if (val != null) {
          if (c.max_len && Array.isArray(val) && val.length > c.max_len) return { status: "missing", detail: `"${c.field}" has ${val.length} > max ${c.max_len}` };
          return { status: "present", detail: `"${c.field}" present${Array.isArray(val) ? ` (${val.length})` : ""}` };
        }
      }
      return { status: "missing", detail: `"${c.field}" not found in any ${c.any_event.join("/")} payload` };
    }
    default:
      return { status: "unknown", detail: `unknown check kind ${c.kind}` };
  }
}

// Best-effort adverse detection: only knowable with payloads.
function detectAdverse(bundle, payloads) {
  if (!payloads) return null; // unknown
  for (const e of bundle.events || []) {
    if (e.event_type !== "model_output" && e.event_type !== "tool_result") continue;
    const p = payloads[e.seq] ?? payloads[e.payload_ref];
    const v = (p && (p.decision || p.verdict || p.outcome) || "").toString().toLowerCase();
    if (/deny|denied|decline|block|counteroffer|adverse|incomplete/.test(v)) return true;
    if (/approve|approved|accept/.test(v)) return false;
  }
  return null;
}

/**
 * @param {object} bundle — a Shadow evidence bundle
 * @param {object} [opts]
 * @param {object} [opts.payloads] — map {seq|payload_ref -> payload} for value-level checks
 * @param {object} [opts.verified] — the result of verifyBundle(bundle, {publicKey}); enables full integrity check
 * @returns {{profile, profile_version, pass, adverse, coverage_pct, fields, missing_required}}
 */
export function checkBankingProfileV1(bundle, { payloads = null, verified = null } = {}) {
  const adverse = detectAdverse(bundle, payloads);
  const fields = PROFILE.fields.map((f) => {
    const r = runCheck(f, bundle, { payloads, verified });
    return { id: f.id, label: f.label, level: f.level, reg_hooks: f.reg_hooks, status: r.status, detail: r.detail };
  });

  // required_on_adverse is enforced only when the decision is known-adverse.
  const isEnforced = (f) => f.level === "required" || (f.level === "required_on_adverse" && adverse === true);
  const missing_required = fields.filter((f) => isEnforced(f) && f.status === "missing").map((f) => f.id);
  const pass = missing_required.length === 0;

  const applicable = fields.filter((f) => f.level !== "recommended" ? true : true); // all count toward coverage
  const present = applicable.filter((f) => f.status === "present").length;
  const coverage_pct = Math.round((present / applicable.length) * 100);

  return { profile: PROFILE.profile, profile_version: PROFILE.profile_version, pass, adverse, coverage_pct, fields, missing_required };
}

export { PROFILE as BANKING_PROFILE_V1 };
