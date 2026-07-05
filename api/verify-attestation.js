// POST /api/verify-attestation
// Public verifier HTTP endpoint. Bank SIEM pipelines, audit workflows, and
// procurement scripts that aren't sitting inside an MCP host (Claude Desktop
// / Cursor / OpenCode) can curl this to verify a persisted attestation
// without shelling out to bin/verify-attestation.mjs.
//
// Same primitive as the CLI (bin/verify-attestation.mjs) + the MCP tool
// (shadow_verify_attestation). All three wrap verifyAttestation() from
// lib/attestation.js. Closes the CLI / MCP / HTTP triangle for the
// "who can verify" contract shipped in v1.5.0.
//
// Body shape:
//   {
//     attestation: { version, mode, request_commitment, output_commitment,
//                    model_id, completed_at_utc, key_id, signature, ... },
//     original_request:  <the exact body the caller sent Shadow>,
//     original_response: <the exact response Shadow returned, MINUS the
//                        attestation field itself>,
//     public_key?: <PEM string OR base64 raw 32-byte — required if
//                   attestation.mode === "ed25519">,
//     hmac_key?:   <string — required if attestation.mode === "hmac-sha256">
//   }
//
// Response shape:
//   {
//     ok: boolean,
//     reason: string,
//     checks: { request_commitment_match, output_commitment_match, signature_match },
//     mode: "ed25519" | "hmac-sha256",
//     model_id: string,
//     completed_at_utc: string,
//     key_id: string,
//     interpretation: string   // human-readable summary
//   }
//
// Notes
// -----
// - NO OAuth scope required. Verification is a read-only crypto check;
//   an auditor holding the response body + attestation + the correct
//   public key is by definition already authorized to see the record.
// - Ed25519 mode is the procurement-recommended path. The bank holds
//   only the public half of the keypair — cannot forge, only verify.
// - HMAC mode requires the deployment's shared signing key; use only
//   for dev + internal audit flows.

import { verifyAttestation, SIGNATURE_MODES } from "../lib/attestation.js";

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
        attestation: {
          version: "aex-attestation/v1",
          mode: "ed25519",
          request_commitment: "<sha256 hex>",
          output_commitment: "<sha256 hex>",
          model_id: "claude-sonnet-4-6",
          completed_at_utc: "2026-07-03T21:00:00Z",
          previous_hash: null,
          key_id: "prod-2026-Q3",
          signature: "<base64>"
        },
        original_request: { loan: { credit_score: 720 } },
        original_response: { verdict: "approve", voices: [] },
        public_key: "-----BEGIN PUBLIC KEY-----\n..."
      }
    });
  }

  const {
    attestation,
    original_request,
    original_response,
    public_key,
    hmac_key,
  } = req.body ?? {};

  if (!attestation) {
    return res.status(400).json({
      error: "missing 'attestation' in request body",
      docs: "lib/attestation.js buildAttestation()"
    });
  }
  if (!original_request) {
    return res.status(400).json({
      error: "missing 'original_request' in request body",
      hint: "pass the exact body Shadow was called with (loan/policy dict)"
    });
  }
  if (!original_response) {
    return res.status(400).json({
      error: "missing 'original_response' in request body",
      hint: "pass the exact response Shadow returned MINUS the attestation field"
    });
  }

  const keys = {};
  if (public_key) keys.publicKey = public_key;
  if (hmac_key) keys.secret = hmac_key;

  const t0 = Date.now();
  const result = verifyAttestation(
    attestation, original_request, original_response, keys
  );
  const latency_ms = Date.now() - t0;

  return res.status(200).json({
    ok: result.ok,
    reason: result.reason,
    checks: result.checks,
    mode: attestation.mode ?? SIGNATURE_MODES.HMAC,
    model_id: attestation.model_id,
    completed_at_utc: attestation.completed_at_utc,
    key_id: attestation.key_id,
    interpretation: result.ok
      ? "Attestation verified. Request + response were not tampered, the pinned model ran, and the deployment key material matches."
      : "Attestation FAILED verification. Do NOT trust this record — it may have been tampered, silently model-swapped, or signed with different key material.",
    latency_ms,
    timestamp: new Date().toISOString(),
  });
}
