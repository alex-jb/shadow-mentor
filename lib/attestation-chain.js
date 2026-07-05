// lib/attestation-chain.js
// ──────────────────────────────────────────────────────────────────
// Hash-chain audit trail for Shadow attestations.
//
// Every attestation carries a `previous_hash` field that binds it to
// the SHA-256 of the previous attestation in the deployment's audit
// log. This module ships the canonical computation + a chain-integrity
// verifier so a bank auditor can hand a JSONL log to a verifier and
// receive a machine-readable "chain intact / broken at index N" verdict.
//
// Why chain-of-signatures matters
// -------------------------------
// Signature verification proves a single attestation was signed by the
// right key. A chain proves the SEQUENCE was never reordered, no records
// were inserted retroactively, and no records were silently deleted.
// This is the hardest evidence to forge — forging one link forces
// re-signing every subsequent one.
//
// Ships v1.5.10 (2026-07-05). Deployed alongside `POST /api/verify-chain`
// and `bin/verify-chain.mjs`.

import { createHash } from "node:crypto";
import { canonicalize } from "./attestation.js";

/**
 * SHA-256 hex of the canonicalized attestation object. This is what the
 * NEXT attestation's `previous_hash` must equal.
 *
 * We include the full attestation object (including the signature) so
 * that forging a link requires resigning the entire tail — the chain
 * is only as strong as the private key, but any tail modification
 * cascades forward.
 */
export function computeAttestationHash(attestation) {
  if (!attestation || typeof attestation !== "object") {
    throw new Error("computeAttestationHash: attestation must be an object");
  }
  return createHash("sha256").update(canonicalize(attestation)).digest("hex");
}

/**
 * Verify a chain of attestations. Walks the array left→right and asserts
 * every element's `previous_hash` matches SHA-256 of the previous element.
 *
 * @param {Array<object>} attestations — ordered chronologically
 * @returns {{
 *   ok: boolean,
 *   length: number,
 *   broken_at_index: number|null,
 *   reason: string,
 *   links_verified: number,
 * }}
 *
 * Design notes:
 * - Empty array → ok: true, length: 0 (nothing to verify).
 * - Single-element chain → ok: true iff element.previous_hash is
 *   null/empty (first entry has no predecessor).
 * - Mid-chain break: reports the FIRST broken index. Callers can
 *   partition the log at that point (pre-break is intact, post-break
 *   is compromised).
 * - Does NOT re-verify signatures. That's `verifyAttestation()`'s job.
 *   Chain verification is a separate, cheaper primitive.
 */
export function verifyChain(attestations) {
  if (!Array.isArray(attestations)) {
    return {
      ok: false,
      length: 0,
      broken_at_index: null,
      reason: "attestations must be an array",
      links_verified: 0,
    };
  }

  if (attestations.length === 0) {
    return {
      ok: true,
      length: 0,
      broken_at_index: null,
      reason: "empty chain — nothing to verify",
      links_verified: 0,
    };
  }

  // First element must have null / empty previous_hash — it's the genesis.
  const first = attestations[0];
  if (first.previous_hash && first.previous_hash !== "") {
    return {
      ok: false,
      length: attestations.length,
      broken_at_index: 0,
      reason:
        "first attestation carries a previous_hash but has no predecessor " +
        "in the supplied chain — a prior entry was deleted or the chain " +
        "was truncated",
      links_verified: 0,
    };
  }

  let linksVerified = 0;
  for (let i = 1; i < attestations.length; i++) {
    const expected = computeAttestationHash(attestations[i - 1]);
    if (attestations[i].previous_hash !== expected) {
      return {
        ok: false,
        length: attestations.length,
        broken_at_index: i,
        reason:
          `chain broken at index ${i}: previous_hash does not match ` +
          `SHA-256 of attestations[${i - 1}]. Either the prior entry was ` +
          `edited, an entry was inserted, or a deletion left a gap.`,
        links_verified: linksVerified,
      };
    }
    linksVerified++;
  }

  return {
    ok: true,
    length: attestations.length,
    broken_at_index: null,
    reason: `chain intact — ${linksVerified} link(s) verified across ${attestations.length} attestation(s)`,
    links_verified: linksVerified,
  };
}
