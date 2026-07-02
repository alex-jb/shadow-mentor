// lib/attestation.js
// ──────────────────────────────────────────────────────────────────
// AEX-style multi-hop attestation for /api/deliberate + /api/loan-council.
//
// Ships 2026-07-02 based on AEX (arXiv:2603.14283, June 2026) which
// specifies a signed top-level attestation object binding request-
// commitment ↔ output-commitment. Also covers the failure mode from
// "Auditing Model Substitution in LLM APIs" (arXiv:2504.04715) —
// API providers can silently swap models; only cryptographic
// attestation catches it.
//
// Defense layers
// --------------
// Shadow already ships:
//   - Hash-chain audit log (SHA-256 chain across decisions)
//   - Prompt SHA-256 pin per response
//   - Model ID field per response
//
// What this module adds:
//   - SHA-256 commitment of the FULL request payload (loan + policy)
//   - SHA-256 commitment of the FULL response body (verdict + voices)
//   - HMAC-SHA-256 signature over both commitments + model_id +
//     completed_at_utc using a deploy-time server_secret
//
// Verification
// ------------
// Auditor recomputes both commitments from persisted request +
// response bodies, recomputes the HMAC with the same server_secret,
// compares against the stored signature. Any mismatch = record was
// tampered OR a silent model swap happened OR the server_secret
// rotated without re-signing.
//
// server_secret rotation
// ----------------------
// The signature carries a `keyId` so multiple secrets can co-exist
// (grace period for rotation). Auditor picks the right secret by
// keyId. Rotate at least yearly per NIST SP 800-57.
//
// Ref
// ---
// - arXiv:2603.14283 AEX: Non-Intrusive Multi-Hop Attestation for LLM APIs
// - arXiv:2504.04715 Auditing Model Substitution in LLM APIs
// - NIST SP 800-57 Part 1 §5.2 key rotation cadence

import { createHash, createHmac } from "node:crypto";


// Deploy-time secret. In production this comes from an env var or
// KMS. For dev the default is fine because the signature is only
// verifiable by whoever holds the secret — a dev signature won't
// match a prod verifier.
const DEFAULT_SECRET =
  process.env.SHADOW_ATTESTATION_SECRET
  || "dev-shadow-attestation-secret-DO-NOT-USE-IN-PROD";

const DEFAULT_KEY_ID = process.env.SHADOW_ATTESTATION_KEY_ID || "dev-v1";

const ATTESTATION_VERSION = "aex-attestation/v1";


/**
 * Compute SHA-256 hex digest of a value. Objects are canonicalized
 * via JSON.stringify with sorted keys so signatures are stable
 * regardless of key ordering.
 */
export function commitmentOf(value) {
  const canonical = canonicalize(value);
  return createHash("sha256").update(canonical).digest("hex");
}


/**
 * Canonicalize a value for deterministic hashing. Objects → sorted-
 * key JSON. Arrays → element-wise canonicalization. Primitives → as-is.
 *
 * This matters because JSON.stringify({a:1,b:2}) !== JSON.stringify({b:2,a:1})
 * — two functionally-equivalent responses would otherwise produce
 * two different commitments.
 */
export function canonicalize(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) =>
    JSON.stringify(k) + ":" + canonicalize(value[k]),
  ).join(",") + "}";
}


/**
 * Build a signed attestation object for a Shadow decision.
 *
 * @param {object} params
 * @param {object} params.request — the exact input the caller sent
 *   (loan dict + policy + any other config)
 * @param {object} params.response — the exact response body Shadow
 *   is about to return (verdict + voices + risk_packet + etc.).
 *   IMPORTANT: pass this BEFORE embedding the attestation object
 *   itself — else you're hashing the attestation into itself.
 * @param {string} params.modelId — e.g. "claude-sonnet-4-6"
 * @param {string} [params.completedAtUtc] — ISO 8601. Defaults to now.
 * @param {string} [params.previousHash] — SHA-256 of previous
 *   response's attestation. Enables hash-chain. Optional (first
 *   response has no previous).
 * @param {string} [params.secret] — override for tests
 * @param {string} [params.keyId] — override for tests
 * @returns {{
 *   version: string,
 *   request_commitment: string,   // sha256 hex
 *   output_commitment: string,    // sha256 hex
 *   model_id: string,
 *   completed_at_utc: string,
 *   previous_hash: string|null,
 *   key_id: string,
 *   signature: string,            // hmac-sha256 hex
 * }}
 */
export function buildAttestation(params) {
  const {
    request,
    response,
    modelId,
    completedAtUtc = new Date().toISOString(),
    previousHash = null,
    secret = DEFAULT_SECRET,
    keyId = DEFAULT_KEY_ID,
  } = params;

  if (!request) throw new Error("buildAttestation: request required");
  if (!response) throw new Error("buildAttestation: response required");
  if (!modelId) throw new Error("buildAttestation: modelId required");

  const requestCommitment = commitmentOf(request);
  const outputCommitment = commitmentOf(response);

  // Signature covers: request_commitment + output_commitment + model_id
  // + completed_at_utc + previous_hash. Anything the auditor needs to
  // verify from persisted state.
  const signingPayload = [
    ATTESTATION_VERSION,
    requestCommitment,
    outputCommitment,
    modelId,
    completedAtUtc,
    previousHash || "",
    keyId,
  ].join("|");
  const signature = createHmac("sha256", secret)
    .update(signingPayload)
    .digest("hex");

  return {
    version: ATTESTATION_VERSION,
    request_commitment: requestCommitment,
    output_commitment: outputCommitment,
    model_id: modelId,
    completed_at_utc: completedAtUtc,
    previous_hash: previousHash,
    key_id: keyId,
    signature,
  };
}


/**
 * Verify a signed attestation against a persisted request + response.
 * Returns a diagnostic object; ok=false means the record is tampered
 * OR a silent model swap happened OR the wrong secret was used.
 *
 * @param {object} attestation — the signed object built earlier
 * @param {object} originalRequest — persisted request payload
 * @param {object} originalResponse — persisted response body (with
 *   attestation field removed — pass response.body minus attestation)
 * @param {string} [secret] — server secret used at signing time
 * @returns {{ok: boolean, reason: string, checks: object}}
 */
export function verifyAttestation(attestation, originalRequest,
                                    originalResponse, secret = DEFAULT_SECRET) {
  const checks = {};

  if (!attestation || typeof attestation !== "object") {
    return { ok: false, reason: "attestation missing or malformed", checks };
  }
  if (attestation.version !== ATTESTATION_VERSION) {
    return {
      ok: false,
      reason: `unsupported attestation version: ${attestation.version}`,
      checks,
    };
  }

  // Verify request commitment
  const expectedRequest = commitmentOf(originalRequest);
  checks.request_commitment_match =
    expectedRequest === attestation.request_commitment;
  if (!checks.request_commitment_match) {
    return {
      ok: false,
      reason: "request commitment mismatch — record was tampered",
      checks,
    };
  }

  // Verify output commitment
  const expectedOutput = commitmentOf(originalResponse);
  checks.output_commitment_match =
    expectedOutput === attestation.output_commitment;
  if (!checks.output_commitment_match) {
    return {
      ok: false,
      reason: "output commitment mismatch — response was tampered",
      checks,
    };
  }

  // Verify signature
  const signingPayload = [
    ATTESTATION_VERSION,
    attestation.request_commitment,
    attestation.output_commitment,
    attestation.model_id,
    attestation.completed_at_utc,
    attestation.previous_hash || "",
    attestation.key_id,
  ].join("|");
  const expectedSignature = createHmac("sha256", secret)
    .update(signingPayload)
    .digest("hex");
  checks.signature_match = expectedSignature === attestation.signature;
  if (!checks.signature_match) {
    return {
      ok: false,
      reason:
        "signature mismatch — either the wrong server_secret was used, " +
        "or the model_id / completed_at_utc were tampered with silently.",
      checks,
    };
  }

  return {
    ok: true,
    reason: "attestation verified",
    checks,
  };
}


export { ATTESTATION_VERSION };
