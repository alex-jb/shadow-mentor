// aex-attestation/v2 — unambiguous named-envelope signing.
//
// WHY v2 exists (see docs/security/ATTESTATION_V1_AMBIGUITY_ANALYSIS.md): v1 signs a delimiter-joined
// VALUE array (`parts.join("|")`), so field names never enter the signed bytes. Two structurally
// different objects can produce identical v1 signing bytes:
//   1. optional-binding relabel: {dictionary_hash: H} and {citation_registry_sha256: H} sign the same.
//   2. delimiter movement: a "|" inside model_id vs completed_at_utc yields the same joined string.
//   3. null / "" / absent collapse.
// v2 fixes all three STRUCTURALLY by signing a canonical NAMED object (field names + a named `bindings`
// object are inside the signed bytes; no delimiter structure; canonicalize distinguishes null/""/absent).
//
// v1 is NOT touched by this file — v1 bytes and v1 verification stay byte-for-byte identical. This
// module reuses v1's `canonicalize` (the same one used for request/output commitments) so Node,
// browser and C# can reproduce identical UTF-8 bytes. v2 fields are constrained to ASCII (lowercase-hex
// hashes, RFC 3339 UTC timestamps, printable-ASCII bounded model_id/key_id) so JSON.stringify is
// trivially portable across runtimes. No new external crypto dependency.
import { createHash, createHmac, sign as cryptoSign, verify as cryptoVerify } from "node:crypto";
import { canonicalize, SIGNATURE_MODES, _asPrivateKey, _asPublicKey } from "./attestation.js";

export const ATTESTATION_V2_VERSION = "aex-attestation/v2";
export const V2_DOMAIN = "shadow-attestation";

// The closed set of governance bindings v2 recognizes (external snake_case names). Unknown binding
// keys fail closed. This is the versioned allowlist; extending it is a v2.x schema change.
export const V2_KNOWN_BINDINGS = Object.freeze([
  "dictionary_hash",
  "citation_registry_sha256",
  "proxy_schema_sha256",
  "original_content_hash",
  "policy_invariance_score_sha256",
  "adverse_action_notice_sha256",
  "sampling_seed_commitment_sha256",
  "evidence_partition_scheme_sha256",
  "heterogeneity_commitment_sha256",
  "claim_type_sha256",
  "bian_coverage_sha256",
  "eticas_taxonomy_sha256",
  "sive_fixture_set_sha256",
  "calibration_ranking_split_sha256",
]);
const KNOWN_BINDING_SET = new Set(V2_KNOWN_BINDINGS);
const PROTO_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export class AttestationV2Error extends Error {
  constructor(message, code) { super(message); this.code = code; }
}
const fail = (msg, code) => { throw new AttestationV2Error(msg, code); };

// ── strict validators ─────────────────────────────────────────────────────────
const HEX64 = /^[0-9a-f]{64}$/;   // lowercase 64-hex SHA-256
function assertHash(v, field) {
  if (typeof v !== "string" || !HEX64.test(v)) fail(`v2: ${field} must be lowercase 64-hex SHA-256`, "ERR_V2_BAD_HASH");
  return v;
}
function assertPreviousHash(v) {
  if (v === null) return null;                        // explicit chain head
  if (v === "") fail("v2: previous_hash empty string is not allowed (use null for a chain head)", "ERR_V2_BAD_PREVIOUS_HASH");
  return assertHash(v, "previous_hash");
}
// RFC 3339 UTC (Z or +00:00), normalized to a single canonical Z form via Date round-trip.
function assertTimestampUtc(v) {
  if (typeof v !== "string" || v.length === 0) fail("v2: completed_at_utc required", "ERR_V2_BAD_TIMESTAMP");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(v)) fail(`v2: completed_at_utc is not RFC 3339: ${v}`, "ERR_V2_BAD_TIMESTAMP");
  const ms = Date.parse(v);
  if (Number.isNaN(ms)) fail(`v2: completed_at_utc is not a valid date: ${v}`, "ERR_V2_BAD_TIMESTAMP");
  return new Date(ms).toISOString();                  // normalize ONCE; this exact value is signed + stored
}
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;             // no control chars, ASCII only (cross-runtime parity)
function assertIdent(v, field, max) {
  if (typeof v !== "string" || v.length === 0) fail(`v2: ${field} required`, "ERR_V2_BAD_IDENT");
  if (v.length > max) fail(`v2: ${field} exceeds ${max} chars`, "ERR_V2_BAD_IDENT");
  if (!PRINTABLE_ASCII.test(v)) fail(`v2: ${field} must be printable ASCII (no control/Unicode)`, "ERR_V2_BAD_IDENT");
  return v;                                            // NO silent trim / Unicode rewrite
}
function assertBindings(bindings) {
  if (bindings == null) return {};
  if (typeof bindings !== "object" || Array.isArray(bindings)) fail("v2: bindings must be an object", "ERR_V2_BAD_BINDINGS");
  const out = {};
  for (const k of Object.keys(bindings)) {
    if (PROTO_KEYS.has(k)) fail(`v2: prototype-pollution binding key ${k}`, "ERR_V2_BAD_BINDINGS");
    if (!KNOWN_BINDING_SET.has(k)) fail(`v2: unknown binding key ${k} (fail closed)`, "ERR_V2_UNKNOWN_BINDING");
    const val = bindings[k];
    if (val === null) fail(`v2: binding ${k} is null (omit it to mean not-bound)`, "ERR_V2_NULL_BINDING");
    if (val === "") fail(`v2: binding ${k} is empty string (omit it to mean not-bound)`, "ERR_V2_EMPTY_BINDING");
    out[k] = assertHash(val, `bindings.${k}`);
  }
  return out;
}
function assertAlgorithm(mode) {
  if (mode !== SIGNATURE_MODES.HMAC && mode !== SIGNATURE_MODES.ED25519) fail(`v2: unsupported algorithm ${mode}`, "ERR_V2_BAD_ALGORITHM");
  return mode;
}

// ── canonical named envelope ────────────────────────────────────────────────
// The EXACT object whose canonical UTF-8 bytes are signed. Field names + the named bindings object are
// part of the bytes. `previous_hash` is null or a hash — never "". `bindings` is {} when none.
export function buildV2Envelope({ algorithm, requestCommitment, outputCommitment, modelId, completedAtUtc, previousHash, keyId, bindings }) {
  return {
    domain: V2_DOMAIN,
    wire_version: ATTESTATION_V2_VERSION,
    algorithm: assertAlgorithm(algorithm),
    request_commitment: assertHash(requestCommitment, "request_commitment"),
    output_commitment: assertHash(outputCommitment, "output_commitment"),
    model_id: assertIdent(modelId, "model_id", 200),
    completed_at_utc: assertTimestampUtc(completedAtUtc),
    previous_hash: assertPreviousHash(previousHash),
    key_id: assertIdent(keyId, "key_id", 200),
    bindings: assertBindings(bindings),
  };
}

// The signed bytes: UTF-8 of the canonical (sorted-key) JSON of the envelope.
export function v2SigningBytes(envelope) { return Buffer.from(canonicalize(envelope), "utf8"); }
export function v2SigningText(envelope) { return canonicalize(envelope); }

// Reconstruct the exact signed envelope from a stored attestation object (build + verify share this).
function envelopeFromAttestation(att) {
  return buildV2Envelope({
    algorithm: att.algorithm ?? att.mode,
    requestCommitment: att.request_commitment,
    outputCommitment: att.output_commitment,
    modelId: att.model_id,
    completedAtUtc: att.completed_at_utc,
    previousHash: att.previous_hash === undefined ? null : att.previous_hash,
    keyId: att.key_id,
    bindings: att.bindings,
  });
}

// ── production default-secret guard (§9) ─────────────────────────────────────
export const DEV_DEFAULT_SECRET = "dev-shadow-attestation-secret-DO-NOT-USE-IN-PROD";
export function isProductionEnv(env = process.env) {
  return env.NODE_ENV === "production" || env.SHADOW_ENV === "production";
}
// Fail loud in production when signing with the insecure dev default (or no explicit secret).
export function assertSecureSecret(secret, mode, env = process.env) {
  if (mode !== SIGNATURE_MODES.HMAC) return;   // ed25519 uses a key, not the shared secret
  if (isProductionEnv(env) && (secret === undefined || secret === null || secret === DEV_DEFAULT_SECRET)) {
    fail("insecure default HMAC secret in production — configure SHADOW_ATTESTATION_SECRET or an ed25519/KMS signer", "ERR_INSECURE_DEFAULT_SECRET");
  }
}

// ── sign / build ─────────────────────────────────────────────────────────────
export function buildAttestationV2({
  requestCommitment, outputCommitment, modelId,
  completedAtUtc = new Date().toISOString(), previousHash = null,
  mode = SIGNATURE_MODES.HMAC, secret, privateKey, keyId = "dev-v2",
  bindings = {}, env = process.env,
}) {
  if (mode === SIGNATURE_MODES.HMAC) {
    assertSecureSecret(secret, mode, env);
    if (secret === undefined || secret === null) secret = DEV_DEFAULT_SECRET;   // dev/test only (guard already rejected prod)
  }
  const envelope = buildV2Envelope({ algorithm: mode, requestCommitment, outputCommitment, modelId, completedAtUtc, previousHash, keyId, bindings });
  const bytes = v2SigningBytes(envelope);
  let signature;
  if (mode === SIGNATURE_MODES.HMAC) {
    signature = createHmac("sha256", secret).update(bytes).digest("hex");
  } else {
    if (!privateKey) fail("v2: ed25519 mode requires privateKey", "ERR_V2_NO_KEY");
    signature = cryptoSign(null, bytes, _asPrivateKey(privateKey)).toString("base64");
  }
  // The stored/transmitted attestation object carries every signed field + the signature.
  return {
    version: ATTESTATION_V2_VERSION,
    domain: envelope.domain,
    algorithm: envelope.algorithm,
    mode: envelope.algorithm,                 // alias for API familiarity; verify uses the signed envelope
    request_commitment: envelope.request_commitment,
    output_commitment: envelope.output_commitment,
    model_id: envelope.model_id,
    completed_at_utc: envelope.completed_at_utc,
    previous_hash: envelope.previous_hash,
    key_id: envelope.key_id,
    bindings: envelope.bindings,
    signature,
  };
}

// ── verify ───────────────────────────────────────────────────────────────────
export function verifyAttestationV2(attestation, keys = {}) {
  const checks = {};
  if (!attestation || typeof attestation !== "object") return { ok: false, reason: "attestation missing or malformed", checks };
  if (attestation.version !== ATTESTATION_V2_VERSION) return { ok: false, reason: `not a v2 attestation: ${attestation.version}`, checks };
  if (attestation.domain !== V2_DOMAIN) return { ok: false, reason: `bad domain: ${attestation.domain}`, checks };

  let envelope;
  try { envelope = envelopeFromAttestation(attestation); }
  catch (e) { return { ok: false, reason: `v2 envelope invalid: ${e.message}`, checks, code: e.code }; }

  const mode = envelope.algorithm;
  const bytes = v2SigningBytes(envelope);
  if (mode === SIGNATURE_MODES.HMAC) {
    const secret = (typeof keys === "string" ? keys : keys.secret) ?? DEV_DEFAULT_SECRET;
    const expected = createHmac("sha256", secret).update(bytes).digest("hex");
    checks.signature_valid = timingSafeEqualHex(expected, attestation.signature);
  } else {
    const publicKey = keys.publicKey;
    if (!publicKey) return { ok: false, reason: "v2: ed25519 verification requires publicKey", checks };
    try { checks.signature_valid = cryptoVerify(null, bytes, _asPublicKey(publicKey), Buffer.from(attestation.signature, "base64")); }
    catch { checks.signature_valid = false; }
  }
  if (!checks.signature_valid) return { ok: false, reason: "v2 signature mismatch", checks };
  return { ok: true, reason: "v2 signature verified", checks, envelope };
}

// Constant-time hex compare (avoid leaking via early-exit on the signature check).
function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// SHA-256 of the canonical v2 signed bytes — useful for golden vectors + cross-runtime parity.
export function v2CanonicalDigest(envelope) { return createHash("sha256").update(v2SigningBytes(envelope)).digest("hex"); }

// ── explicit version dispatch (no heuristic detection) ───────────────────────
import { verifyAttestation as _verifyV1, ATTESTATION_VERSION as _V1_VERSION } from "./attestation.js";

// Route by the explicit `version` field. v1 → the unchanged v1 verifier; v2 → v2 verifier. Anything
// else fails closed. verifyV1 keeps the v1 4-arg shape (needs originalRequest/Response); verifyV2 reads
// the commitments straight from the object.
export function verifyAttestationAny(attestation, keys = {}, originalRequest, originalResponse) {
  if (!attestation || typeof attestation !== "object") return { ok: false, reason: "attestation missing or malformed", checks: {} };
  if (attestation.version === ATTESTATION_V2_VERSION) return verifyAttestationV2(attestation, keys);
  if (attestation.version === _V1_VERSION || attestation.version === undefined) return _verifyV1(attestation, originalRequest, originalResponse, keys);
  return { ok: false, reason: `unknown attestation version: ${attestation.version}`, checks: {} };
}
export { _verifyV1 as verifyV1 };
export const verifyV2 = verifyAttestationV2;

// ── preferred signing entry (§5) ─────────────────────────────────────────────
// NEW code should call signAttestation() — it defaults to the unambiguous v2 wire version. Existing
// buildAttestation() (v1) callers and every released v1 fixture are intentionally left untouched, so no
// signing bytes flip silently. Pass { wire: "v1" } here only to deliberately produce a legacy proof.
export function signAttestation(params) {
  if (params && params.wire === "v1") fail("signAttestation is v2-only; call buildAttestation() directly for a legacy v1 proof", "ERR_V2_REFUSE_LEGACY");
  return buildAttestationV2(params);
}
export const PREFERRED_WIRE_VERSION = ATTESTATION_V2_VERSION;
