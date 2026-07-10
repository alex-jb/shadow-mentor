// Batch Ed25519 attestation signing — v1.5.12.
//
// Motivation: for banks processing 10,000+ loan files per day, per-decision
// Ed25519 signing scales linearly (one sign() per decision), but verifiers
// walking the audit chain want O(1) verification per batch: sign a single
// signature over the SHA-256 of concatenated per-decision hashes.
//
// Design constraint: batch signing MUST NOT weaken per-decision integrity.
// Every decision still has its own hash + previous_hash chain + dictionary_hash.
// The batch signature is a *summary* signature over that chain, letting a
// bank auditor verify N=10,000 decisions in one Ed25519 verification instead
// of N. If the bank cares about tamper detection for a single decision, they
// still walk the chain — this is O(N). Batch verification is the "SIEM
// aggregate check runs once per hour" path.
//
// Refs:
//   - RFC 8032 Edwards-Curve Digital Signature Algorithm
//   - Shadow v1.5.10 hash-chain verifier (lib/attestation-chain.js)
//   - Shadow v1.5.8 dictionary_hash binding (lib/attestation.js)

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  verify as cryptoVerify,
} from "node:crypto";
import { computeAttestationHash } from "./attestation-chain.js";

// Ed25519 key helpers — self-contained so this file has no cross-file test coupling.
// PKCS8 wrapper for Ed25519: SEQUENCE { 0, AlgorithmId(OID 1.3.101.112), OCTET STRING }
const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
// SPKI wrapper for Ed25519: SEQUENCE { AlgorithmId, BIT STRING }
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function _asPrivateKey(input) {
  if (typeof input === "object" && input !== null && input.type === "private") {
    return input; // already a KeyObject
  }
  if (typeof input === "string") {
    if (input.startsWith("-----BEGIN")) {
      return createPrivateKey({ key: input, format: "pem" });
    }
    // Assume hex-encoded 32-byte seed
    const raw = Buffer.from(input, "hex");
    if (raw.length !== 32) {
      throw new Error(`_asPrivateKey: raw Ed25519 seed must be 32 bytes, got ${raw.length}`);
    }
    return createPrivateKey({
      key: Buffer.concat([ED25519_PKCS8_PREFIX, raw]),
      format: "der",
      type: "pkcs8",
    });
  }
  throw new Error("_asPrivateKey: unsupported input type");
}

function _asPublicKey(input) {
  if (typeof input === "object" && input !== null && input.type === "public") {
    return input;
  }
  if (typeof input === "string") {
    if (input.startsWith("-----BEGIN")) {
      return createPublicKey({ key: input, format: "pem" });
    }
    const raw = Buffer.from(input, "hex");
    if (raw.length !== 32) {
      throw new Error(`_asPublicKey: raw Ed25519 public key must be 32 bytes, got ${raw.length}`);
    }
    return createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, raw]),
      format: "der",
      type: "spki",
    });
  }
  throw new Error("_asPublicKey: unsupported input type");
}

/**
 * Batch signing schema:
 *
 * {
 *   batch_id: string,
 *   attestation_count: number,
 *   first_decision_hash: string (SHA-256 hex),
 *   last_decision_hash: string (SHA-256 hex),
 *   root_hash: string (SHA-256 hex of concatenated per-decision hashes),
 *   batch_signature: string (Ed25519 hex signature over root_hash + batch_id),
 *   key_id: string,
 *   signed_at_utc: string (ISO 8601),
 * }
 *
 * root_hash = SHA-256(
 *   attestation[0].hash || attestation[1].hash || ... || attestation[N-1].hash
 * )
 *
 * batch_signature = Ed25519_sign(privateKey,
 *   batch_id || "|" || root_hash || "|" || attestation_count
 * )
 */

const CANONICAL_SEP = "|";

/**
 * Compute the root hash over a sequence of attestation hashes.
 * @param {Array<{hash: string}>} decisionHashes — output of computeAttestationHash per decision
 * @returns {string} SHA-256 hex root hash
 */
export function computeBatchRootHash(decisionHashes) {
  if (!Array.isArray(decisionHashes) || decisionHashes.length === 0) {
    throw new Error(
      "computeBatchRootHash requires a non-empty array of decision hashes",
    );
  }
  const hasher = createHash("sha256");
  for (const item of decisionHashes) {
    if (typeof item !== "string" || item.length !== 64) {
      throw new Error(
        `computeBatchRootHash requires 64-char hex hashes, got: ${JSON.stringify(item)}`,
      );
    }
    hasher.update(item, "hex");
  }
  return hasher.digest("hex");
}

/**
 * Sign a batch of attestations with Ed25519.
 * @param {Array<object>} attestations — array of attestation objects from buildAttestation()
 * @param {object} params
 * @param {string|Buffer|KeyObject} params.privateKey — Ed25519 private key
 * @param {string} params.keyId — key id used
 * @param {string} [params.batchId] — optional batch identifier; auto-generated if absent
 * @returns {object} batch signature record
 */
export function batchSignAttestations(attestations, { privateKey, keyId, batchId } = {}) {
  if (!Array.isArray(attestations) || attestations.length === 0) {
    throw new Error("batchSignAttestations requires a non-empty array of attestations");
  }
  if (!privateKey) {
    throw new Error("batchSignAttestations requires Ed25519 privateKey");
  }
  if (!keyId) {
    throw new Error("batchSignAttestations requires keyId (per RFC 8032 key rotation)");
  }

  const decisionHashes = attestations.map((a) => computeAttestationHash(a));
  const rootHash = computeBatchRootHash(decisionHashes);
  const resolvedBatchId = batchId ?? `batch-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const attestationCount = attestations.length;

  const signingPayload = [resolvedBatchId, rootHash, String(attestationCount)].join(CANONICAL_SEP);

  const key = _asPrivateKey(privateKey);
  const signature = cryptoSign(null, Buffer.from(signingPayload, "utf-8"), key).toString("hex");

  return {
    batch_id: resolvedBatchId,
    attestation_count: attestationCount,
    first_decision_hash: decisionHashes[0],
    last_decision_hash: decisionHashes[decisionHashes.length - 1],
    root_hash: rootHash,
    batch_signature: signature,
    key_id: keyId,
    signed_at_utc: new Date().toISOString(),
  };
}

/**
 * Verify a batch signature record.
 * @param {object} batchRecord — output of batchSignAttestations
 * @param {Array<object>} attestations — the same array of attestations
 * @param {object} params
 * @param {string|Buffer|KeyObject} params.publicKey — Ed25519 public key
 * @returns {{ok: boolean, reason?: string, checks: object}}
 */
export function batchVerifyAttestations(batchRecord, attestations, { publicKey } = {}) {
  const checks = {};

  if (!batchRecord || typeof batchRecord !== "object") {
    return { ok: false, reason: "batchRecord is missing or not an object", checks };
  }
  if (!Array.isArray(attestations)) {
    return { ok: false, reason: "attestations must be an array", checks };
  }
  if (!publicKey) {
    return { ok: false, reason: "batchVerifyAttestations requires Ed25519 publicKey", checks };
  }

  checks.attestation_count_match = attestations.length === batchRecord.attestation_count;
  if (!checks.attestation_count_match) {
    return {
      ok: false,
      reason: `attestation count mismatch — batch says ${batchRecord.attestation_count}, got ${attestations.length}`,
      checks,
    };
  }

  const decisionHashes = attestations.map((a) => computeAttestationHash(a));
  const rootHash = computeBatchRootHash(decisionHashes);
  checks.root_hash_match = rootHash === batchRecord.root_hash;
  if (!checks.root_hash_match) {
    return {
      ok: false,
      reason: "root_hash mismatch — one or more attestations were reordered or tampered",
      checks,
    };
  }

  const signingPayload = [
    batchRecord.batch_id,
    batchRecord.root_hash,
    String(batchRecord.attestation_count),
  ].join(CANONICAL_SEP);

  const key = _asPublicKey(publicKey);
  const signatureBytes = Buffer.from(batchRecord.batch_signature, "hex");
  const signatureValid = cryptoVerify(null, Buffer.from(signingPayload, "utf-8"), key, signatureBytes);

  checks.signature_valid = signatureValid;
  if (!signatureValid) {
    return {
      ok: false,
      reason: "batch signature is invalid — batch_id, root_hash, or attestation_count were tampered",
      checks,
    };
  }

  return { ok: true, checks };
}
