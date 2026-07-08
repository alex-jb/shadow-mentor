// lib/typed-claims.js
// ──────────────────────────────────────────────────────────────────
// v1.5.37 (2026-07-08). Typed-claim envelope per arXiv:2605.20312
// Pramana (Kadaboina, 2026-05-19). Wraps agent outputs in typed
// claim attestations so bank counsel + auditor know WHICH claim
// class they're looking at, since different classes have different
// audit-replay expectations.
//
// Pre-v1.5.37, Shadow attestations bound the request + response
// commitments + model_id + timestamp + 9 append-only hashes. What
// they did NOT declare is the epistemic class of the claim. Was this
// decision derived from direct data observation? From LLM inference?
// From case-precedent retrieval? From a third-party assertion (bureau
// score, FinCEN response, OFAC list)? Bank auditor has to figure it
// out from context — brittle + error-prone at audit time.
//
// v1.5.37 makes the class explicit: `claim_type_sha256` is bound as
// the 10th append-only attestation field. It hashes {claim_type,
// audit_expectation} so any post-hoc reclassification (e.g. quietly
// downgrading an inference claim to a perception claim to skip seed-
// commitment verification) breaks Ed25519 verification.
//
// 4-class framing anchored in the Pramana paper's Indian-epistemology
// taxonomy but re-labeled for banking context:
//   PERCEPTION → direct observation of borrower data (deterministic)
//   INFERENCE  → LLM-derived conclusion (needs seed commitment)
//   ANALOGY    → precedent/case-retrieval reasoning (needs precedent pin)
//   TESTIMONY  → third-party assertion (needs source freshness stamp)
//
// Each class has a documented AUDIT_EXPECTATION that tells the
// auditor what to check to reproduce the claim.

import { createHash } from "node:crypto";


/**
 * Four claim types per Pramana (arXiv:2605.20312) translated to
 * banking underwriting context. String values chosen for auditor-
 * friendliness — not the Sanskrit labels the paper uses.
 */
export const CLAIM_TYPE = Object.freeze({
  PERCEPTION: "perception",
  INFERENCE: "inference",
  ANALOGY: "analogy",
  TESTIMONY: "testimony",
});


/**
 * Audit-replay expectation per claim type. Tells the auditor what to
 * check to reproduce the claim. Bank counsel pins this table in
 * procurement contracts so a post-hoc reclassification cannot skip
 * an audit step.
 */
export const AUDIT_EXPECTATION = Object.freeze({
  [CLAIM_TYPE.PERCEPTION]: {
    class: "deterministic-replay",
    what_to_verify:
      "Re-hash the borrower snapshot; compare to request_commitment. " +
      "Must match byte-for-byte.",
    additional_hashes_required: [],
  },
  [CLAIM_TYPE.INFERENCE]: {
    class: "seed-commitment-replay",
    what_to_verify:
      "Re-run the LLM with pinned seed / temperature / model_id from " +
      "sampling_seed_commitment_sha256. Compare output_commitment to " +
      "the fresh output hash. May differ within Guo-2017 calibration " +
      "band; must not differ structurally.",
    additional_hashes_required: ["sampling_seed_commitment_sha256"],
  },
  [CLAIM_TYPE.ANALOGY]: {
    class: "precedent-registry-replay",
    what_to_verify:
      "Reload the case-precedent registry from the version pinned in " +
      "citation_registry_sha256. Confirm cited precedent is present " +
      "and its citation matches. Post-hoc registry edits break the " +
      "hash.",
    additional_hashes_required: ["citation_registry_sha256"],
  },
  [CLAIM_TYPE.TESTIMONY]: {
    class: "source-freshness-replay",
    what_to_verify:
      "Confirm the third-party source (bureau, FinCEN, OFAC) was " +
      "queried within the required staleness window relative to " +
      "completed_at_utc. Source-freshness stamp is required.",
    additional_hashes_required: [],
  },
});


/**
 * Build the canonical typed-claim envelope for a single decision.
 * The envelope hashes {claim_type, audit_expectation.class}. The
 * resulting hash is bound as the 10th append-only field in the
 * attestation.
 *
 * @param {string} claimType — one of CLAIM_TYPE values
 * @returns {object} envelope {claim_type, audit_expectation_class,
 *                             audit_expectation_summary, envelope_hash_sha256}
 */
export function buildTypedClaimEnvelope(claimType) {
  if (!Object.values(CLAIM_TYPE).includes(claimType)) {
    throw new Error(
      `buildTypedClaimEnvelope: unknown claim_type "${claimType}". ` +
      `Must be one of: ${Object.values(CLAIM_TYPE).join(", ")}`,
    );
  }
  const expectation = AUDIT_EXPECTATION[claimType];
  const canonical = JSON.stringify({
    claim_type: claimType,
    audit_expectation_class: expectation.class,
  });
  const envelope_hash_sha256 = createHash("sha256")
    .update(canonical).digest("hex");
  return {
    claim_type: claimType,
    audit_expectation_class: expectation.class,
    audit_expectation_summary: expectation.what_to_verify,
    additional_hashes_required: [...expectation.additional_hashes_required],
    envelope_hash_sha256,
    anchor: "arXiv:2605.20312",
  };
}


/**
 * Compute just the hash for the given claim type. Callers who want
 * only the value to bind into the attestation (without the descriptive
 * fields) can use this directly.
 *
 * @param {string} claimType
 * @returns {string} 64-char SHA-256 hex
 */
export function claimTypeCommitment(claimType) {
  return buildTypedClaimEnvelope(claimType).envelope_hash_sha256;
}


/**
 * Heuristic classifier: given a scenario + verdict + presence-of-loan,
 * suggest the claim type. Callers can override with an explicit type
 * on the /api/deliberate request. Not authoritative — this is just a
 * default hint for callers who don't declare the class explicitly.
 *
 * @param {object} params
 * @param {string} params.scenario — e.g. "lbo", "compliance"
 * @param {object} [params.loan]   — loan payload if LBO branch
 * @param {string} [params.verdict] — final_verdict if runLoanCouncil ran
 * @returns {string} CLAIM_TYPE value
 */
export function classifyClaimType({ scenario, loan, verdict } = {}) {
  // TESTIMONY takes precedence: refuse_to_serve is grounded in
  // statute / sanctions list / third-party testimony from OFAC /
  // FinCEN. Check first so LBO branch doesn't shadow it.
  if (verdict === "refuse_to_serve") {
    return CLAIM_TYPE.TESTIMONY;
  }
  // LBO + loan + deterministic-verdict → the loan-council rule
  // resolver ran, verdict is deterministic given loan payload +
  // LOAN_DEFAULTS. That is PERCEPTION-class (byte-for-byte replay).
  if (scenario === "lbo" && loan && verdict) {
    return CLAIM_TYPE.PERCEPTION;
  }
  // Everything else without a loan payload is LLM inference over the
  // scenario prompt. INFERENCE-class.
  return CLAIM_TYPE.INFERENCE;
}
