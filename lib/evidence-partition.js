// lib/evidence-partition.js
// ──────────────────────────────────────────────────────────────────
// v1.5.30 (2026-07-08): Per-persona evidence partitioning.
// Anchors arXiv:2607.01661 (Li, Tao, Zhang — 2026-07-02) InfoDelphi
// — 12-18% Brier improvement when agents receive partitioned
// evidence rather than identical prompts.
//
// The problem
// -----------
// Kohli 2605.29800 (2026-05-16) documents the "correlated votes"
// pathology: N LLM judges with identical inputs vote highly
// correlated, so the "N-of-N unanimous" signal is worth much less
// than N-independent-votes. Shadow's council is deterministic on
// the L1 side (verdict-invariance) so this doesn't apply to the
// verdict itself, but the RATIONALES are LLM-generated and DO
// exhibit the correlation.
//
// InfoDelphi's fix: give each persona a filtered subset of the
// evidence that matches their regulatory role. Compliance sees the
// citations; Credit sees the financial ratios; Risk sees the
// market-proxy time series; Advocate sees the applicant narrative;
// Contrarian sees the macro context. Voices with disjoint evidence
// windows are structurally forced to reason independently.
//
// Design invariants
// -----------------
// 1. Partitioning is DETERMINISTIC. Same loan + same persona id →
//    same partition every time.
// 2. Partitioning is OPT-IN. Callers who don't set
//    `evidence_partition: true` get 100% back-compat behavior.
// 3. Partitioning is LOSSLESS at the aggregation layer. The
//    verdict layer still receives the full loan; only the LLM
//    rationale generation sees partitioned evidence.
// 4. The partition SCHEMA hash is bound into the attestation as
//    `evidence_partition_scheme_sha256` so a downstream auditor
//    can prove which partition scheme was in force at decision
//    time.

import { createHash } from "node:crypto";

/**
 * Canonical schema id. Bump this if the partition scheme changes.
 * Bank counsel pins this in procurement contracts so a silent
 * partition-scheme swap breaks Ed25519 verification.
 */
export const EVIDENCE_PARTITION_SCHEME_VERSION = "shadow-evidence-partition/v1";

/**
 * The five personas + the fields they see.
 *
 * Each field name here matches a key in the loan object (per
 * `lib/schemas/loan.js`). Fields not listed here for a persona
 * are omitted from the partition.
 */
const PARTITION_SCHEME = Object.freeze({
  compliance: [
    // Regulatory-relevant fields ONLY. Compliance voice reasons on
    // whether adverse-action notice is required, whether ECOA
    // applies, and whether the applicant profile triggers protected-
    // class review — not on the underwriting numbers.
    "fair_lending_review_flag",
    "adverse_action_reasons",
    "borrower_ethnicity_optional",
    "borrower_sex_optional",
    "borrower_age_optional",
    "borrower_marital_status_optional",
    "public_assistance_flag",
    "amount",
    "sector",
  ],
  credit: [
    // Underwriting numeric fields ONLY. Credit voice never sees
    // narrative or regulatory context.
    "credit_score",
    "debt_to_income",
    "loan_to_value",
    "amount",
    "borrower_rating",
    "sector",
  ],
  risk: [
    // Market-proxy + concentration fields ONLY.
    "market_proxy_prices",
    "collateral_positions",
    "borrower_exposure_weights",
    "borrower_rating",
    "sector",
    "amount",
  ],
  advocate: [
    // Applicant-narrative + hardship fields ONLY. Advocate voice
    // never sees numeric ratios.
    "applicant_narrative",
    "hardship_disclosure",
    "public_assistance_flag",
    "amount",
  ],
  contrarian: [
    // Macro + regime fields ONLY. Contrarian voice looks for
    // late-cycle timing, sector overweight, and regime-shift risks.
    "market_proxy_prices",
    "sector",
    "amount",
    "borrower_rating",
    "borrower_exposure_weights",
  ],
});

/**
 * Return the canonical partition scheme object. Frozen so callers
 * can't mutate.
 */
export function getPartitionScheme() {
  return PARTITION_SCHEME;
}

/**
 * Compute the SHA-256 of the partition scheme + version. Bank
 * counsel pins this in procurement contracts.
 */
export function partitionSchemeHash() {
  const canonical = JSON.stringify({
    version: EVIDENCE_PARTITION_SCHEME_VERSION,
    scheme: PARTITION_SCHEME,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Return the evidence subset for a given persona id.
 *
 * @param {string} personaId — "compliance" | "credit" | "risk" |
 *   "advocate" | "contrarian"
 * @param {object} loan — full loan object per `lib/schemas/loan.js`
 * @returns {object} filtered loan object containing only the fields
 *   that persona is allowed to see. Fields not listed for the
 *   persona are absent from the returned object.
 */
export function evidencePartitionFor(personaId, loan) {
  if (!loan || typeof loan !== "object") return {};
  const allowedFields = PARTITION_SCHEME[personaId];
  if (!allowedFields) {
    // Unknown persona — fail-safe closed: return empty object so
    // an unrecognized voice cannot leak evidence. A downstream
    // rationale generator will emit "insufficient evidence" which
    // is the correct fail-safe behavior.
    return {};
  }
  const out = {};
  for (const f of allowedFields) {
    if (f in loan) out[f] = loan[f];
  }
  return out;
}

/**
 * Partition the loan across all five canonical personas at once.
 * Returns an object keyed by persona id with each persona's
 * filtered evidence view.
 */
export function partitionLoanAcrossVoices(loan) {
  const out = {};
  for (const persona of Object.keys(PARTITION_SCHEME)) {
    out[persona] = evidencePartitionFor(persona, loan);
  }
  return out;
}

/**
 * Cross-persona-leak audit. Given a full loan + a persona id +
 * the partition view that was actually sent to that persona,
 * verify no field OUTSIDE the persona's allowed set is present.
 *
 * Returns { ok, leaks: [fieldName] }.
 */
export function auditPartitionLeak(personaId, partition) {
  const allowed = new Set(PARTITION_SCHEME[personaId] || []);
  const leaks = [];
  for (const k of Object.keys(partition || {})) {
    if (!allowed.has(k)) leaks.push(k);
  }
  return { ok: leaks.length === 0, leaks };
}
