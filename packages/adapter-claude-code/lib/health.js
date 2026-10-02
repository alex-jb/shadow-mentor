// Read-only local capture observations. No recovery, private keys, payload
// output, provider calls or claim that every expected hook was received.
import { lstatSync, openSync, fstatSync, readSync, closeSync, constants } from "node:fs";
import { join } from "node:path";
import { createPublicKey } from "node:crypto";
import { verifyBundle, canonicalize, EVENT_TYPES } from "shadow-attest-core";
import { parsePendingBytes } from "./handler.js";

const MAX_BYTES = 16 * 1024 * 1024;
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const hex = value => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
export function validHealthSessionId(id) {
  return typeof id === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id);
}
function issue(code) { const e = new Error(code); e.code = code; return e; }
function metadata(path) {
  try { return lstatSync(path); }
  catch (e) { if (e.code === "ENOENT") return null; throw issue("ARTIFACT_UNREADABLE"); }
}
function directory(path) {
  const st = metadata(path);
  if (st && (!st.isDirectory() || st.isSymbolicLink())) throw issue("ARTIFACT_UNSAFE");
}
function snapshot(path) {
  const st = metadata(path);
  if (!st) return null;
  if (!st.isFile() || st.isSymbolicLink()) throw issue("ARTIFACT_UNSAFE");
  if (st.size > MAX_BYTES) throw issue("ARTIFACT_TOO_LARGE");
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    const before = fstatSync(fd);
    if (!before.isFile() || before.size > MAX_BYTES) throw issue("ARTIFACT_UNSAFE");
    // Keep reads bounded even if another process grows a file after stat.
    const buffer = Buffer.allocUnsafe(MAX_BYTES + 1);
    let length = 0, count;
    while (length < buffer.length && (count = readSync(fd, buffer, length, Math.min(65536, buffer.length - length), null)))
      length += count;
    const bytes = buffer.subarray(0, length);
    const after = fstatSync(fd);
    if (bytes.length > MAX_BYTES) throw issue("ARTIFACT_TOO_LARGE");
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ino !== after.ino)
      throw issue("ARTIFACT_CHANGED_DURING_READ");
    return bytes;
  } catch (e) { throw issue(e.code?.startsWith("ARTIFACT_") ? e.code : "ARTIFACT_UNREADABLE"); }
  finally { if (fd !== undefined) closeSync(fd); }
}
function parse(bytes) {
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw issue("ARTIFACT_INVALID_JSON"); }
}
function parseStore(bytes, sessionId) {
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw issue("STORE_INVALID"); }
  let header = null, seal = null;
  const events = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let row;
    try { row = JSON.parse(line); } catch { throw issue("STORE_INVALID"); }
    if (!object(row) || seal) throw issue("STORE_INVALID");
    if (row.kind === "header") {
      if (header || events.length || !object(row.header) || row.header.session_id !== sessionId)
        throw issue("STORE_INVALID");
      header = row.header;
    } else if (row.kind === "event") {
      const e = row.event;
      if (!header || !object(e) || e.seq !== events.length || !EVENT_TYPES.includes(e.event_type) ||
          !hex(e.prev_hash) || !hex(e.payload_hash)) throw issue("STORE_INVALID");
      events.push(e);
    } else if (row.kind === "seal") {
      if (!header || !hex(row.batch_root) || !Array.isArray(row.signatures) || !row.signatures.length ||
          !(row.session_ended_at_utc === null || typeof row.session_ended_at_utc === "string"))
        throw issue("STORE_INVALID");
      seal = row;
    } else throw issue("STORE_INVALID");
  }
  if (!header) throw issue("STORE_INVALID");
  return { header, events, seal };
}

export function inspectCaptureHealth({ shadowDir, sessionId, publicKeyPem = null, publicKeyPath = null } = {}) {
  if (!validHealthSessionId(sessionId) || typeof shadowDir !== "string" || !shadowDir)
    throw issue("HEALTH_INPUT_INVALID");
  const report = {
    schema_version: "shadow-capture-health/v1", session_id: sessionId, read_only: true,
    health_state: "NO_CAPTURE_ARTIFACTS", capture_completeness: "UNVERIFIED",
    provider_origin: "UNVERIFIED", resume_support: "UNSUPPORTED",
    snapshot_consistency: "BEST_EFFORT_LOCAL_READ",
    observations: {
      pending: { present: false, valid: null, hook_count: null },
      store: { present: false, valid: null, event_count: null, sealed: null, validation: "NOT_CHECKED" },
      bundle: { present: false, verification: "NOT_PRESENT", event_count: null, termination: "NOT_SEALED" },
      adapter_error_log: { present: false, byte_size: null, scope: "GLOBAL_UNATTRIBUTED" },
    }, diagnostics: [],
  };
  const diag = code => { if (!report.diagnostics.includes(code)) report.diagnostics.push(code); };
  let pending = null, store = null, bundle = null, invalid = false, inconsistent = false;
  try {
    directory(shadowDir);
    directory(join(shadowDir, "sessions"));
    directory(join(shadowDir, "sessions", sessionId));
  } catch (e) { diag(e.code); report.health_state = "INVALID"; return report; }
  const observe = (field, path, parser) => {
    try {
      const bytes = snapshot(path);
      if (bytes === null) return null;
      field.present = true;
      const value = parser(bytes);
      if ("valid" in field) field.valid = true;
      return value;
    } catch (e) {
      field.present = true;
      if ("valid" in field) field.valid = false;
      diag(e.code?.startsWith("ARTIFACT_") ? e.code : field === report.observations.pending ? "PENDING_INVALID" :
        field === report.observations.store ? "STORE_INVALID" : "BUNDLE_INVALID");
      invalid = true;
      return null;
    }
  };
  pending = observe(report.observations.pending, join(shadowDir, "sessions", `${sessionId}.pending.jsonl`),
    bytes => parsePendingBytes(bytes, sessionId));
  if (pending) report.observations.pending.hook_count = pending.length;
  store = observe(report.observations.store, join(shadowDir, "sessions", `${sessionId}.jsonl`),
    bytes => parseStore(bytes, sessionId));
  if (store) Object.assign(report.observations.store, { event_count: store.events.length,
    sealed: Boolean(store.seal), validation: "STRUCTURE_ONLY" });
  bundle = observe(report.observations.bundle, join(shadowDir, "sessions", sessionId, "bundle.json"), parse);
  if (report.observations.bundle.present) report.observations.bundle.verification = "INVALID";
  if (report.observations.bundle.present) {
    if (!object(bundle) || bundle.spec_version !== "shadow-evidence/v1" ||
        !object(bundle.header) || bundle.header.session_id !== sessionId || !Array.isArray(bundle.events)) {
      invalid = true; diag("BUNDLE_INVALID");
    } else {
      report.observations.bundle.event_count = bundle.events.length;
      report.observations.bundle.termination = bundle.header.session_ended_at_utc === null ? "PARTIAL_SEAL" :
        bundle.events.some(e => e?.event_type === "session_end" && e.actor === "agent") ? "RECORDED_SESSION_END" : "MANUAL_OR_UNOBSERVED_END";
      let key = publicKeyPem;
      let usableKey = false;
      try {
        if (key === null) {
          if (!publicKeyPath) directory(join(shadowDir, "keys"));
          const bytes = snapshot(publicKeyPath ?? join(shadowDir, "keys", "public.pem"));
          if (bytes) key = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        }
        if (typeof key !== "string" || !/^\s*-----BEGIN PUBLIC KEY-----\s+[A-Za-z0-9+/=\r\n]+-----END PUBLIC KEY-----\s*$/.test(key) ||
            createPublicKey(key).asymmetricKeyType !== "ed25519") throw issue("PUBLIC_KEY_UNAVAILABLE");
        usableKey = true;
      } catch (e) {
        report.observations.bundle.verification = "UNVERIFIABLE";
        diag(e.code?.startsWith("ARTIFACT_") ? e.code : "PUBLIC_KEY_UNAVAILABLE");
        if (e.code?.startsWith("ARTIFACT_")) invalid = true;
      }
      if (usableKey) {
        try {
          const checked = verifyBundle(bundle, { publicKey: key, checkAnchors: false });
          if (checked.ok) report.observations.bundle.verification = "VERIFIED";
          else { invalid = true; diag("BUNDLE_VERIFICATION_FAILED"); }
        } catch { invalid = true; diag("BUNDLE_VERIFICATION_FAILED"); }
      }
    }
  }
  if (store?.seal && !bundle) { inconsistent = true; diag("SEALED_BUNDLE_MISSING"); }
  if (bundle && !store?.seal) { inconsistent = true; diag("BUNDLE_WITHOUT_SEALED_STORE"); }
  if ((store?.seal || bundle) && pending?.length) { inconsistent = true; diag("SEALED_WITH_PENDING_HOOKS"); }
  if (object(bundle) && object(bundle.header) && Array.isArray(bundle.events) && store?.seal) {
    const header = { ...store.header, session_ended_at_utc: store.seal.session_ended_at_utc };
    if (canonicalize(header) !== canonicalize(bundle.header) || canonicalize(store.events) !== canonicalize(bundle.events) ||
        store.seal.batch_root !== bundle.batch_root || canonicalize(store.seal.signatures) !== canonicalize(bundle.signatures)) {
      inconsistent = true; diag("STORE_BUNDLE_MISMATCH");
    } else if (report.observations.bundle.verification === "VERIFIED") {
      report.observations.store.validation = "MATCHED_VERIFIED_BUNDLE";
    }
  }
  try {
    const st = metadata(join(shadowDir, "adapter-errors.log"));
    if (st) {
      if (!st.isFile() || st.isSymbolicLink()) throw issue("ARTIFACT_UNSAFE");
      Object.assign(report.observations.adapter_error_log, { present: true, byte_size: st.size });
      if (st.size) diag("UNATTRIBUTED_ERROR_HISTORY");
    }
  } catch (e) { diag(e.code); invalid = true; }
  report.health_state = invalid ? "INVALID" : inconsistent ? "INCONSISTENT" :
    bundle ? report.observations.bundle.verification === "VERIFIED" ? "SEALED_VERIFIED" : "SEALED_UNVERIFIABLE" :
    store ? "OPEN_UNSEALED" : pending?.length ? "BUFFERED" : "NO_CAPTURE_ARTIFACTS";
  return report;
}

export function captureHealthExitCode(report) {
  return ["BUFFERED", "OPEN_UNSEALED", "SEALED_VERIFIED"].includes(report.health_state) ? 0 : 1;
}
