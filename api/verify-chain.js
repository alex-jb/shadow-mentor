// POST /api/verify-chain
// Chain-integrity verifier for a sequence of Shadow attestations.
//
// Ships v1.5.10 (2026-07-05). Extends the CLI / MCP / HTTP verifier
// triangle with a fourth surface — sequence verification. This checks
// that a bank's audit log wasn't reordered, inserted-into, or
// silently truncated. Signature verification of individual attestations
// is still done via POST /api/verify-attestation.
//
// Body shape:
//   { attestations: Array<attestation> }
//
// Response:
//   { ok, length, broken_at_index, reason, links_verified }
//
// No OAuth scope required — chain-integrity check is a read-only
// verification. Anyone holding the attestations already has audit
// access to them.

import { verifyChain } from "../lib/attestation-chain.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST only",
      example: {
        attestations: [
          { version: "aex-attestation/v1", previous_hash: null, signature: "...", "...": "..." },
          { version: "aex-attestation/v1", previous_hash: "sha256-of-first", signature: "...", "...": "..." },
        ]
      }
    });
  }

  const { attestations } = req.body ?? {};

  if (!attestations) {
    return res.status(400).json({
      error: "missing 'attestations' array in request body",
      hint: "pass the chronologically-ordered list of persisted attestations",
    });
  }
  if (!Array.isArray(attestations)) {
    return res.status(400).json({
      error: "'attestations' must be an array",
    });
  }

  const t0 = Date.now();
  const result = verifyChain(attestations);
  const latency_ms = Date.now() - t0;

  return res.status(200).json({
    ...result,
    // SCOPE (honesty): this endpoint verifies hash-chain ORDERING/INTEGRITY only —
    // that the sequence wasn't reordered, inserted-into, or truncated. It does NOT
    // verify signatures/authenticity (a fully re-computed forged chain would pass
    // the link check). Run POST /api/verify-attestation per record with the key to
    // confirm each attestation is genuinely signed.
    verifies: "hash-chain-links-only",
    signature_check: "not-performed — run /api/verify-attestation per record for authenticity",
    interpretation: result.ok
      ? `Hash-chain intact: all ${result.links_verified} link(s) match — no reordering, insertion, or truncation. NOTE: this is an ordering/integrity check ONLY; it does NOT prove authenticity. Verify each record's signature via /api/verify-attestation.`
      : `Hash-chain COMPROMISED at index ${result.broken_at_index}: records at or after that point fail the link check and cannot be trusted for audit purposes.`,
    latency_ms,
    timestamp: new Date().toISOString(),
  });
}
