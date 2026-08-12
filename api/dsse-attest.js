// POST /api/dsse-attest
// Wrap a SEALED Shadow evidence bundle as a signed DSSE / in-toto attestation —
// the envelope cosign / in-toto / Sigstore already verify. The in-toto subject
// digest is bound to the bundle's `batch_root`, so the attestation is tied to
// the exact evidence chain it describes.
//
// Same primitive as the library (packages/attest-core/dsse.js dsseAttestBundle).
// This is a SIGNING op (DSSE signs the PAE, not the raw payload), so it needs a
// persistent key: SHADOW_ATTESTATION_ED25519_PRIVATE_KEY. Without it → 400
// (no ephemeral attestation — the envelope must carry a stable bank identity).
// Consumers verify the returned envelope with the public half, offline, using
// any DSSE-aware tool.
//
// Body:  { bundle: <sealed Shadow evidence bundle> }
// Reply: { ok, envelope: { payloadType, payload, signatures[] } }
//
// Refs: DSSE spec, in-toto Statement v1. See docs/STANDARDS_MAP.md §6.

import { apiGuard } from "../lib/api-guard.js";
import { dsseAttestBundle } from "../packages/attest-core/dsse.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST only",
      example: { bundle: { header: { session_id: "…", agent: { name: "loan-council", version: "1.0.0" } }, events: [], batch_root: "…", signatures: [] } },
    });
  }
  if (!apiGuard(req, res, { maxBytes: 1024 * 1024, rpm: 60 })) return;

  const bundle = req.body?.bundle ?? null;
  if (!bundle || typeof bundle !== "object" || !bundle.batch_root) {
    return res.status(400).json({ error: "missing sealed 'bundle' (with batch_root) in request body" });
  }

  const privateKey = process.env.SHADOW_ATTESTATION_ED25519_PRIVATE_KEY || null;
  if (!privateKey) {
    return res.status(400).json({
      error: "DSSE attestation requires a persistent signing key",
      detail: "Set SHADOW_ATTESTATION_ED25519_PRIVATE_KEY. A DSSE/in-toto attestation must carry a stable bank identity — Shadow will not sign it with an ephemeral key.",
    });
  }
  const keyId = process.env.SHADOW_ATTESTATION_KEY_ID || "shadow-attestation-key";

  let envelope;
  try {
    envelope = dsseAttestBundle(bundle, { privateKey, keyId });
  } catch (e) {
    return res.status(400).json({ error: "attestation failed", detail: e.message });
  }

  return res.status(200).json({ ok: true, envelope, timestamp: new Date().toISOString() });
}
