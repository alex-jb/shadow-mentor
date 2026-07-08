// lib/attestation-tenant.js
// ──────────────────────────────────────────────────────────────────
// v1.5.27 (2026-07-08): Per-tenant key isolation via HKDF-derived
// tenant secrets.
//
// Why this exists
// ---------------
// Every enterprise AI RFP asks: "how is our data cryptographically
// isolated from other customers?" Before v1.5.27, Shadow signed
// every attestation with a single master HMAC secret. Any tenant
// with the secret could verify AND forge for any other tenant.
//
// v1.5.27 adds tenant-scoped key derivation via HKDF-SHA-256 over
// a master secret + tenant_id. Each tenant gets a deterministic
// per-tenant secret. Cross-tenant signature verification fails by
// construction: the secret used to sign for Tenant A cannot verify
// an attestation signed for Tenant B.
//
// Ed25519 per-tenant keypair derivation is deferred to v1.5.27.1
// (needs a raw-seed → PKCS#8 PEM helper that's fussy across Node
// versions). v1.5.27 ships HMAC-mode tenant isolation which is
// what the RFP question actually asks — Shadow is the only party
// with the master secret; each bank receives only its derived
// tenant secret; cross-tenant verification fails.
//
// Design invariants
// -----------------
// 1. Derivation is DETERMINISTIC. Same master + same tenant_id →
//    same derived secret. This lets Shadow re-derive keys after a
//    restart without any per-tenant state store.
// 2. Derivation is one-way. Given a tenant secret, an attacker
//    cannot recover the master secret. HKDF-SHA-256 provides this
//    per RFC 5869.
// 3. Tenant IDs are opaque bytes. Shadow does not enforce a
//    specific format — a bank can pass "acme-bank", "tenant-42",
//    or a UUID. The tenant_id is bound into the attestation
//    signing payload so cross-tenant reuse is detectable.
// 4. A fingerprint of the derived secret is publishable. Banks can
//    check they hold the correct derived secret by comparing
//    fingerprints without exposing the secret material.

import { hkdfSync, createHash } from "node:crypto";

/**
 * HKDF salt namespace. Never change this constant — changing it
 * would silently re-derive every tenant secret and invalidate
 * every existing attestation.
 */
const HKDF_INFO_HMAC = "shadow-tenant-hmac-v1";

/**
 * Byte length of derived tenant secrets. 32 bytes (256 bits) is
 * the SHA-256 output size and matches the HMAC-SHA-256 key size.
 */
export const TENANT_SECRET_LENGTH = 32;

/**
 * Derive a tenant-scoped HMAC secret from a master secret + tenant
 * identifier via HKDF-SHA-256 (RFC 5869).
 *
 * @param {string|Buffer} masterSecret — Shadow's master secret
 * @param {string} tenantId — opaque tenant identifier
 * @param {object} [opts]
 * @param {number} [opts.length=32] — derived secret length in bytes
 * @returns {string} hex-encoded tenant secret
 */
export function deriveTenantHmacSecret(masterSecret, tenantId, { length = TENANT_SECRET_LENGTH } = {}) {
  if (!masterSecret) {
    throw new Error("deriveTenantHmacSecret: masterSecret required");
  }
  if (!tenantId || typeof tenantId !== "string") {
    throw new Error("deriveTenantHmacSecret: tenantId required (string)");
  }
  if (tenantId.length > 256) {
    throw new Error("deriveTenantHmacSecret: tenantId must be ≤ 256 chars");
  }
  const masterBuf = Buffer.isBuffer(masterSecret)
    ? masterSecret
    : Buffer.from(String(masterSecret), "utf-8");
  const salt = Buffer.from(tenantId, "utf-8");
  const info = Buffer.from(HKDF_INFO_HMAC, "utf-8");
  const derived = hkdfSync("sha256", masterBuf, salt, info, length);
  // hkdfSync returns ArrayBuffer in some Node minor versions; wrap defensively.
  return Buffer.from(derived).toString("hex");
}

/**
 * Compute a publishable fingerprint of a tenant secret. This is a
 * SHA-256 hash of the secret bytes. Banks can compare fingerprints
 * to confirm they hold the correct derived secret without exposing
 * secret material.
 *
 * Truncated to first 16 hex chars by default for readability. Full
 * 64-char hash is available at `{ full: true }`.
 */
export function tenantSecretFingerprint(secretHex, { full = false } = {}) {
  if (!secretHex) return "";
  const bytes = Buffer.from(secretHex, "hex");
  const hash = createHash("sha256").update(bytes).digest("hex");
  return full ? hash : hash.slice(0, 16);
}

/**
 * Verify that a claimed tenant secret matches the derivation from
 * a master + tenant_id. Constant-time comparison via a hex-length
 * check + byte-wise XOR sum so an attacker cannot use timing
 * differences to recover secret bytes.
 */
export function verifyTenantSecret(masterSecret, tenantId, claimedSecretHex) {
  const derived = deriveTenantHmacSecret(masterSecret, tenantId);
  if (derived.length !== (claimedSecretHex || "").length) return false;
  let diff = 0;
  for (let i = 0; i < derived.length; i++) {
    diff |= derived.charCodeAt(i) ^ claimedSecretHex.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Given a tenant_id, resolve the effective HMAC secret for signing:
 *   - if `tenantId` is null/undefined → return the master secret
 *     unchanged (100% back-compat for existing single-tenant
 *     deployments)
 *   - if `tenantId` is a string → derive per-tenant secret via
 *     HKDF and return the hex-encoded secret
 *
 * Callers pass the returned secret into `buildAttestation({..., secret})`
 * to sign attestations bound to that tenant.
 */
export function resolveTenantSecret({ masterSecret, tenantId } = {}) {
  if (!masterSecret) throw new Error("resolveTenantSecret: masterSecret required");
  if (tenantId === undefined || tenantId === null || tenantId === "") {
    return String(masterSecret);
  }
  return deriveTenantHmacSecret(masterSecret, tenantId);
}
