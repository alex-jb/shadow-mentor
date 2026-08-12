// packages/attest-core/dsse.js
// ─────────────────────────────────────────────────────────────────
// DSSE (Dead Simple Signing Envelope) + in-toto Statement emission.
//
// Shadow already signs `batch_root` with Ed25519. Wrapping the SAME key's
// signature in a DSSE envelope — the format cosign / in-toto / Sigstore already
// verify — costs no new cryptography and buys interop with the whole supply-
// chain toolchain. A bank security team that verifies DSSE attestations for its
// build artifacts can verify a Shadow decision attestation with the same tools.
//
// Important: DSSE does NOT sign the raw payload. It signs the PAE
// (Pre-Authentication Encoding) of (payloadType, payload):
//
//   PAE(type, body) = "DSSEv1" SP LEN(type) SP type SP LEN(body) SP body
//   SP = 0x20, LEN = ASCII-decimal of the utf8 byte length.
//
// So a DSSE envelope is a NEW signature over the PAE, not a re-wrap of the
// existing batch_root signature. It requires the private key (a signing op),
// unlike the OCSF projection (a pure hash re-mapping). `verifyDsse` needs only
// the public key.
//
// Refs: DSSE spec (secure-systems-lab/dsse), in-toto Statement v1
// (in-toto/attestation), RFC 8032 Ed25519.
// ─────────────────────────────────────────────────────────────────

import { sign as cryptoSign, verify as cryptoVerify } from "node:crypto";

export const DSSE_PAE_PREFIX = "DSSEv1";
export const INTOTO_STATEMENT_TYPE = "https://in-toto.io/Statement/v1";
export const INTOTO_PAYLOAD_TYPE = "application/vnd.in-toto+json";
export const SHADOW_PREDICATE_TYPE = "https://shadow-mentor.dev/attestation/evidence-bundle/v1";

/**
 * Pre-Authentication Encoding per the DSSE spec.
 * @param {string} payloadType
 * @param {Buffer|Uint8Array} payloadBytes
 * @returns {Buffer}
 */
export function pae(payloadType, payloadBytes) {
  const type = Buffer.from(payloadType, "utf8");
  const body = Buffer.isBuffer(payloadBytes) ? payloadBytes : Buffer.from(payloadBytes);
  return Buffer.concat([
    Buffer.from(DSSE_PAE_PREFIX, "utf8"),
    Buffer.from(` ${type.length} `, "utf8"),
    type,
    Buffer.from(` ${body.length} `, "utf8"),
    body,
  ]);
}

function toPayloadBytes(payload) {
  if (Buffer.isBuffer(payload)) return payload;
  if (typeof payload === "string") return Buffer.from(payload, "utf8");
  return Buffer.from(JSON.stringify(payload), "utf8");
}

/**
 * Produce a DSSE envelope by signing the PAE of (payloadType, payload) with Ed25519.
 *
 * @param {object} params
 * @param {object|string|Buffer} params.payload — the statement (object → JSON)
 * @param {string} [params.payloadType] — default in-toto
 * @param {import("node:crypto").KeyObject|string} params.privateKey — Ed25519 private key
 * @param {string} params.keyId — signer key id (opaque), surfaced as signatures[].keyid
 * @returns {{ payloadType: string, payload: string, signatures: {keyid:string, sig:string}[] }}
 */
export function signDsse({ payload, payloadType = INTOTO_PAYLOAD_TYPE, privateKey, keyId }) {
  if (!privateKey) throw new Error("signDsse: privateKey required");
  if (!keyId) throw new Error("signDsse: keyId required");
  const body = toPayloadBytes(payload);
  const sig = cryptoSign(null, pae(payloadType, body), privateKey); // Ed25519 (algorithm=null)
  return {
    payloadType,
    payload: body.toString("base64"),
    signatures: [{ keyid: keyId, sig: sig.toString("base64") }],
  };
}

/**
 * Verify a DSSE envelope's signature(s) against an Ed25519 public key.
 * @param {object} envelope — { payloadType, payload(base64), signatures[] }
 * @param {object} params
 * @param {import("node:crypto").KeyObject|string} params.publicKey
 * @returns {{ ok: boolean, reason?: string, payloadType?: string, payload?: any, keyid?: string }}
 */
export function verifyDsse(envelope, { publicKey } = {}) {
  if (!publicKey) return { ok: false, reason: "publicKey required" };
  if (!envelope || typeof envelope !== "object") return { ok: false, reason: "envelope required" };
  const { payloadType, payload, signatures } = envelope;
  if (typeof payload !== "string") return { ok: false, reason: "envelope.payload (base64) required" };
  if (!Array.isArray(signatures) || signatures.length === 0) return { ok: false, reason: "envelope.signatures[] required" };

  const body = Buffer.from(payload, "base64");
  const message = pae(payloadType, body);

  for (const s of signatures) {
    if (!s || typeof s.sig !== "string") continue;
    let ok = false;
    try { ok = cryptoVerify(null, message, publicKey, Buffer.from(s.sig, "base64")); }
    catch { ok = false; }
    if (ok) {
      let decoded;
      try { decoded = JSON.parse(body.toString("utf8")); } catch { decoded = body.toString("utf8"); }
      return { ok: true, payloadType, payload: decoded, keyid: s.keyid };
    }
  }
  return { ok: false, reason: "no signature verified against the provided public key" };
}

/**
 * Build an in-toto Statement v1 that binds a subject digest to a predicate.
 * @param {object} params
 * @param {string} params.subjectName
 * @param {string} params.sha256 — hex digest bound as subject digest
 * @param {string} params.predicateType
 * @param {object} [params.predicate]
 * @returns {object} in-toto Statement
 */
export function inTotoStatement({ subjectName, sha256, predicateType, predicate = {} }) {
  return {
    _type: INTOTO_STATEMENT_TYPE,
    subject: [{ name: subjectName, digest: { sha256 } }],
    predicateType,
    predicate,
  };
}

/**
 * Wrap a SEALED Shadow bundle as a signed DSSE / in-toto attestation. The
 * in-toto subject digest is the bundle's `batch_root`, so the DSSE attestation
 * is cryptographically bound to the exact evidence chain it describes.
 *
 * @param {object} bundle — output of sealSession()
 * @param {object} params — { privateKey, keyId }
 * @returns {object} DSSE envelope
 */
export function dsseAttestBundle(bundle, { privateKey, keyId } = {}) {
  if (!bundle || !bundle.batch_root) throw new Error("dsseAttestBundle: sealed bundle with batch_root required");
  const statement = inTotoStatement({
    subjectName: bundle.header?.session_id ?? "shadow-evidence-bundle",
    sha256: bundle.batch_root,
    predicateType: SHADOW_PREDICATE_TYPE,
    predicate: {
      spec_version: bundle.spec_version,
      session_id: bundle.header?.session_id,
      agent: bundle.header?.agent,
      event_count: Array.isArray(bundle.events) ? bundle.events.length : undefined,
      native_signature: bundle.signatures?.[0] ?? null, // the Ed25519-over-batch_root sig, for cross-check
    },
  });
  return signDsse({ payload: statement, privateKey, keyId });
}
