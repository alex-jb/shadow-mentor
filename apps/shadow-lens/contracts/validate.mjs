// apps/shadow-lens/contracts/validate.mjs
// Dependency-free validator + resolvability gate for the Shadow Lens session contract
// (shadow-lens-session.schema.json). Zero-dep on purpose (matches lib/document-source-
// map.js, validateLoan, etc. — a bank can grep it). The load-bearing invariant:
// coordinates come ONLY from the OCR source_map, and a claim may only cite source_id
// values that exist there — resolveClaims() is the gate that makes coordinates
// un-hallucinable (a claim citing a nonexistent id is REJECTED, never rendered).

export const CONTRACT_VERSION = "shadow-lens-session/1.0";
const isSha = (s) => typeof s === "string" && /^sha256:[0-9a-f]{64}$/i.test(s);
const RUNTIME_MODES = ["UNITY_XREAL", "WEBXR_AR", "WEBXR_VR", "SBS_STEREO", "FLAT_HUD", "MOCK"];

// The recognized profiles. Shadow Core is generic; a profile adds vertical-specific rules.
// Banking is the FLAGSHIP profile, not the core boundary.
export const PROFILES = ["banking-v1", "data-science-v1", "coding-agent-v1"];

/**
 * GENERIC Shadow Core validation — no banking (or even document-scan) fields are mandatory.
 * A source is any {source_id, text/content} item; bounding boxes + capture + XR device are
 * OPTIONAL (validated only if present). The un-hallucinable-citation gate (claims may only
 * cite source_ids that exist) is the load-bearing invariant and applies to EVERY profile.
 * @returns {{valid:boolean, errors:string[]}}
 */
export function validateBaseSession(s) {
  const errors = [];
  const req = (cond, msg) => { if (!cond) errors.push(msg); };
  if (!s || typeof s !== "object") return { valid: false, errors: ["session must be an object"] };

  req(s.contract_version === CONTRACT_VERSION, `contract_version must be "${CONTRACT_VERSION}"`);
  req(typeof s.session_id === "string" && s.session_id, "session_id required");
  req(s.build && typeof s.build.app_commit === "string", "build.app_commit required");
  if (s.profile !== undefined) req(PROFILES.includes(s.profile?.name), `profile.name must be one of ${PROFILES.join(", ")}`);

  // OPTIONAL experience/scan blocks — validated only when present.
  if (s.device) {
    const d = s.device;
    req(["unity-xreal", "webxr", "browser-flat", "mock-desktop", "cli", "headless"].includes(d.platform), "device.platform invalid");
    if (d.runtime_mode !== undefined) req(RUNTIME_MODES.includes(d.runtime_mode), "device.runtime_mode invalid");
  }
  if (s.capture) {
    req(isSha(s.capture.capture_sha256), "capture.capture_sha256 must be sha256:<64hex>");
  }

  // source_map is GENERIC: each entry needs a source_id + textual content; geometry/confidence optional.
  req(Array.isArray(s.source_map), "source_map must be an array");
  const ids = new Set();
  if (Array.isArray(s.source_map)) s.source_map.forEach((e, i) => {
    if (!e || typeof e.source_id !== "string") { errors.push(`source_map[${i}].source_id required`); return; }
    ids.add(e.source_id);
    if (typeof e.text !== "string" && typeof e.content !== "string") errors.push(`source_map[${i}] needs text or content`);
    if (e.bounding_box_normalized !== undefined) {
      const b = e.bounding_box_normalized;
      if (!b || ["x", "y", "w", "h"].some((k) => typeof b[k] !== "number")) errors.push(`source_map[${i}].bounding_box_normalized needs numeric x,y,w,h`);
    }
    if (e.confidence !== undefined && (typeof e.confidence !== "number" || e.confidence < 0 || e.confidence > 1)) errors.push(`source_map[${i}].confidence must be 0..1`);
  });

  // THE invariant — same for every profile.
  validateClaimsGate(s, ids, errors);

  req(isSha((s.provenance || {}).source_map_hash), "provenance.source_map_hash must be sha256:<64hex>");
  req(["verified", "failed", "unknown"].includes((s.verification || {}).record_integrity), "verification.record_integrity invalid");

  return { valid: errors.length === 0, errors };
}

// shared claim-resolvability gate (extracted so base + banking use the identical rule)
function validateClaimsGate(s, ids, errors) {
  if (!Array.isArray(s.claims)) return;
  s.claims.forEach((cl, i) => {
    if (!cl || typeof cl.claim_id !== "string") { errors.push(`claims[${i}].claim_id required`); return; }
    if (!Array.isArray(cl.source_ids)) { errors.push(`claims[${i}].source_ids must be an array`); return; }
    if (!["source_bound", "uncited", "rejected"].includes(cl.validation_status)) errors.push(`claims[${i}].validation_status invalid`);
    const unresolved = cl.source_ids.filter((id) => !ids.has(id));
    if (cl.validation_status === "source_bound") {
      if (cl.source_ids.length === 0) errors.push(`claims[${i}] is source_bound but cites no source_ids`);
      if (unresolved.length) errors.push(`claims[${i}] is source_bound but cites source_ids NOT in source_map: ${unresolved.join(",")} — must be 'rejected'`);
    }
    if (cl.validation_status === "uncited" && cl.source_ids.length > 0) errors.push(`claims[${i}] marked uncited but carries source_ids`);
  });
}

/**
 * Structural validation of a Shadow Lens session (not analysis-correctness — that is
 * never knowable). @returns {{valid:boolean, errors:string[]}}
 */
export function validateShadowLensSession(s) {
  const errors = [];
  const req = (cond, msg) => { if (!cond) errors.push(msg); };
  if (!s || typeof s !== "object") return { valid: false, errors: ["session must be an object"] };

  req(s.contract_version === CONTRACT_VERSION, `contract_version must be "${CONTRACT_VERSION}"`);
  req(typeof s.session_id === "string" && s.session_id, "session_id required");
  req(s.build && typeof s.build.app_commit === "string", "build.app_commit required");

  const d = s.device || {};
  req(["unity-xreal", "webxr", "browser-flat", "mock-desktop"].includes(d.platform), "device.platform invalid");
  req(RUNTIME_MODES.includes(d.runtime_mode), "device.runtime_mode invalid");
  req(["6dof", "3dof", "none", "unknown"].includes(d.tracking_mode), "device.tracking_mode invalid");
  req(["xreal-eye", "none", "mock"].includes(d.camera_mode), "device.camera_mode invalid");

  const c = s.capture || {};
  req(typeof c.capture_id === "string" && c.capture_id, "capture.capture_id required");
  req(isSha(c.capture_sha256), "capture.capture_sha256 must be sha256:<64hex>");
  req(["xreal-eye-still", "upload", "paste", "fixture", "mock"].includes(c.capture_method), "capture.capture_method invalid");

  req(Array.isArray(s.source_map), "source_map must be an array");
  const ids = new Set();
  if (Array.isArray(s.source_map)) s.source_map.forEach((e, i) => {
    if (!e || typeof e.source_id !== "string") { errors.push(`source_map[${i}].source_id required`); return; }
    ids.add(e.source_id);
    const b = e.bounding_box_normalized;
    if (!b || ["x", "y", "w", "h"].some((k) => typeof b[k] !== "number")) errors.push(`source_map[${i}].bounding_box_normalized needs numeric x,y,w,h`);
    if (typeof e.confidence !== "number" || e.confidence < 0 || e.confidence > 1) errors.push(`source_map[${i}].confidence must be 0..1`);
    if (typeof e.text !== "string") errors.push(`source_map[${i}].text required`);
  });

  // THE invariant: claim.source_ids must resolve to source_map, and validation_status must be honest.
  if (Array.isArray(s.claims)) s.claims.forEach((cl, i) => {
    if (!cl || typeof cl.claim_id !== "string") { errors.push(`claims[${i}].claim_id required`); return; }
    if (!Array.isArray(cl.source_ids)) { errors.push(`claims[${i}].source_ids must be an array`); return; }
    if (!["source_bound", "uncited", "rejected"].includes(cl.validation_status)) errors.push(`claims[${i}].validation_status invalid`);
    const unresolved = cl.source_ids.filter((id) => !ids.has(id));
    if (cl.validation_status === "source_bound") {
      if (cl.source_ids.length === 0) errors.push(`claims[${i}] is source_bound but cites no source_ids`);
      if (unresolved.length) errors.push(`claims[${i}] is source_bound but cites source_ids NOT in source_map: ${unresolved.join(",")} — must be 'rejected'`);
    }
    if (cl.validation_status === "uncited" && cl.source_ids.length > 0) errors.push(`claims[${i}] marked uncited but carries source_ids`);
  });

  const p = s.provenance || {};
  req(isSha(p.capture_hash), "provenance.capture_hash must be sha256:<64hex>");
  req(isSha(p.source_map_hash), "provenance.source_map_hash must be sha256:<64hex>");

  const v = s.verification || {};
  req(["verified", "failed", "unknown"].includes(v.record_integrity), "verification.record_integrity invalid");

  return { valid: errors.length === 0, errors };
}

/**
 * The resolvability gate — classify every claim's source_ids against the source_map so
 * a claim citing a nonexistent id is REJECTED, not shown. Coordinates never come from
 * the model: it cites ids; this maps ids → geometry. Run server-side before rendering.
 * @returns {Array} claims with authoritative validation_status + unresolved_source_ids.
 */
export function resolveClaims(session) {
  const ids = new Set((session.source_map || []).map((e) => e.source_id));
  return (session.claims || []).map((cl) => {
    const source_ids = Array.isArray(cl.source_ids) ? cl.source_ids : [];
    const unresolved = source_ids.filter((id) => !ids.has(id));
    const validation_status = source_ids.length === 0 ? "uncited" : unresolved.length ? "rejected" : "source_bound";
    return { ...cl, validation_status, unresolved_source_ids: unresolved };
  });
}
