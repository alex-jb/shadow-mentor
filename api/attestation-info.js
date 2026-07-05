// GET /api/attestation-info
// Public key + rotation-metadata discovery for bank auditors.
//
// A bank SIEM pipeline auto-hydrates the verifier's public key without
// requiring an out-of-band email exchange. Response also carries a
// SHA-256 fingerprint of the public key, so the bank auditor can
// cross-check against a public-key copy delivered out-of-band once
// (at procurement time) and detect any silent rotation.
//
// Shipped v1.5.7 (2026-07-05). Response is cache-safe (5 minutes) —
// a bank downloading the key every request would leak audit-tooling
// activity to any downstream caching proxy.

import { createHash } from "node:crypto";
import { SIGNATURE_MODES } from "../lib/attestation.js";

function computeFingerprint(publicKeyPem) {
  // Standard SPKI fingerprint per RFC 5280 §4.2.1.2 — SHA-256 of the
  // DER-encoded public key stripped of PEM armor.
  const stripped = publicKeyPem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const der = Buffer.from(stripped, "base64");
  return createHash("sha256").update(der).digest("hex");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  // 5-minute cache: a bank SIEM polling every minute doesn't overwhelm us,
  // but rotation still lands within the grace-window that key_id covers.
  res.setHeader("Cache-Control", "public, max-age=300");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const mode = process.env.SHADOW_ATTESTATION_MODE === "ed25519"
    ? SIGNATURE_MODES.ED25519
    : SIGNATURE_MODES.HMAC;

  const keyId = process.env.SHADOW_ATTESTATION_KEY_ID || "dev-v1";
  const publicKey = process.env.SHADOW_ATTESTATION_ED25519_PUBLIC_KEY || null;

  const body = {
    service: "shadow-mentor",
    attestation_version: "aex-attestation/v1",
    mode,
    key_id: keyId,
    // HMAC deployments do not expose ANY key material — clients need the
    // shared secret out-of-band, and this endpoint reveals only that HMAC
    // is in use.
    public_key_pem: mode === SIGNATURE_MODES.ED25519 ? publicKey : null,
    public_key_fingerprint_sha256: publicKey ? computeFingerprint(publicKey) : null,
    rotation_note:
      "Per NIST SP 800-57 §5.2, rotate at least yearly. During rotation, " +
      "old attestations verify with the retired key_id; new attestations " +
      "use the current one. Bank auditors should verify this endpoint's " +
      "public_key_fingerprint_sha256 against a copy delivered out-of-band " +
      "at procurement time — a mismatch indicates rotation or a MITM.",
    docs: {
      cli_verifier: "bin/verify-attestation.mjs",
      mcp_tool: "shadow_verify_attestation",
      http_verifier: "POST /api/verify-attestation",
      python_library: "python/shadow_verify",
    },
    completeness_check: {
      ed25519_public_key_present: mode === SIGNATURE_MODES.ED25519 && Boolean(publicKey),
      hmac_mode: mode === SIGNATURE_MODES.HMAC,
      // A bank monitoring this endpoint alerts if this flips unexpectedly.
      warning: mode === SIGNATURE_MODES.ED25519 && !publicKey
        ? "Deployed with ed25519 mode but no public key — signatures will fail verification. Set SHADOW_ATTESTATION_ED25519_PUBLIC_KEY."
        : null,
    },
    timestamp: new Date().toISOString(),
  };

  return res.status(200).json(body);
}

export { computeFingerprint };
