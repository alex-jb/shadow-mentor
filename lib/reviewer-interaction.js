// Reviewer-interaction evidence — deepens a binary "approved: true" into the
// auditable record of WHAT the human reviewer actually did. Borrowed from the medical
// Clinical Algorithmic Audit Trail spec (CAAT, Frontiers in Digital Health 2026), whose
// minimum record set requires clinician-interaction metadata (approved/modified/
// rejected + review duration + override rationale). The same question a bank examiner
// asks: did a human exercise independent judgment, or rubber-stamp the model?
//
// The load-bearing rule: when the reviewer OVERRODE the model (modified/rejected), an
// override_rationale is REQUIRED — that non-empty "why did the human disagree" is the
// difference between an auditable decision and an unexplained one.

export const REVIEWER_DECISIONS = Object.freeze(["approved", "modified", "rejected"]);
const DECISION_SET = new Set(REVIEWER_DECISIONS);

/**
 * Validate a reviewer_interaction object.
 * @param {object} ri - { decision, reviewer_id?, review_duration_ms?, override_rationale?, modified_fields? }
 * @returns {{valid:boolean, errors:string[]}}
 */
export function validateReviewerInteraction(ri) {
  const errors = [];
  if (!ri || typeof ri !== "object") return { valid: false, errors: ["reviewer_interaction must be an object"] };
  if (!DECISION_SET.has(ri.decision)) errors.push(`decision must be one of ${REVIEWER_DECISIONS.join(", ")}`);
  if (ri.reviewer_id !== undefined && (typeof ri.reviewer_id !== "string" || !ri.reviewer_id.trim())) {
    errors.push("reviewer_id must be a non-empty string if present");
  }
  if (ri.review_duration_ms !== undefined && !(Number.isFinite(ri.review_duration_ms) && ri.review_duration_ms >= 0)) {
    errors.push("review_duration_ms must be a non-negative number if present");
  }
  if (ri.modified_fields !== undefined && !Array.isArray(ri.modified_fields)) {
    errors.push("modified_fields must be an array of field names if present");
  }
  // The CAAT rule: an override (modified/rejected) MUST carry a rationale.
  if ((ri.decision === "modified" || ri.decision === "rejected") &&
      (typeof ri.override_rationale !== "string" || !ri.override_rationale.trim())) {
    errors.push("override_rationale is required (non-empty) when decision is modified or rejected");
  }
  return { valid: errors.length === 0, errors };
}

/** Human-readable one-liner for a valid reviewer_interaction (for packets/details). */
export function summarizeReviewerInteraction(ri) {
  const dur = Number.isFinite(ri?.review_duration_ms) ? ` in ${ri.review_duration_ms}ms` : "";
  const why = ri?.override_rationale ? ` — "${String(ri.override_rationale).slice(0, 80)}"` : "";
  return `reviewer ${ri?.decision ?? "?"}${dur}${why}`;
}

/**
 * Fail-closed aggregation of multiple reviewer decisions.
 *
 * Rules (FINDING-C1 acceptance-blocking):
 *  1. approved only when every valid reviewer decision is approved;
 *  2. any rejected → rejected (never approved);
 *  3. no rejected but any modified → modified;
 *  4. missing / malformed / unsupported / irreconcilable → pending;
 *  5. reviewer order must never change the result;
 *  6. the session's reviewers array remains the authoritative conflict evidence.
 *
 * The existing contract enum for human_review does not include an explicit
 * "conflict" state, so this helper derives pending while preserving every
 * reviewer decision and conflict_evidence for audit.
 *
 * @param {Array<object>} reviewers - list of reviewer objects with `decision`
 * @returns {{status: "approved"|"modified"|"rejected"|"pending", reviewer_interaction: object|null, conflict_evidence: Array<object>}}
 */
export function deriveReviewState(reviewers) {
  if (!Array.isArray(reviewers) || reviewers.length === 0) {
    return { status: "pending", reviewer_interaction: null, conflict_evidence: [] };
  }

  const validDecisions = [];
  const conflict_evidence = [];

  for (const r of reviewers) {
    if (!r || typeof r !== "object") {
      conflict_evidence.push({ reason: "malformed_reviewer", value: r });
      continue;
    }
    const decision = r.decision;
    if (!DECISION_SET.has(decision)) {
      conflict_evidence.push({ reason: "unsupported_decision", reviewer_id: r.reviewer_id ?? null, decision });
      continue;
    }
    validDecisions.push({
      decision,
      reviewer_id: r.reviewer_id,
      override_rationale: r.override_rationale,
      review_duration_ms: r.review_duration_ms,
    });
  }

  // Any malformed/unsupported/missing decision voids safe aggregation (fail closed).
  if (conflict_evidence.length > 0 || validDecisions.length === 0) {
    return { status: "pending", reviewer_interaction: null, conflict_evidence };
  }

  // Any rejection → rejected (fail closed).
  const rejected = validDecisions.filter((d) => d.decision === "rejected");
  if (rejected.length > 0) {
    const representative = rejected[0];
    return {
      status: "rejected",
      reviewer_interaction: {
        decision: "rejected",
        reviewer_id: representative.reviewer_id,
        override_rationale: representative.override_rationale,
      },
      conflict_evidence,
    };
  }

  // No rejection but any modification → modified.
  const modified = validDecisions.filter((d) => d.decision === "modified");
  if (modified.length > 0) {
    const representative = modified[0];
    return {
      status: "modified",
      reviewer_interaction: {
        decision: "modified",
        reviewer_id: representative.reviewer_id,
        override_rationale: representative.override_rationale,
      },
      conflict_evidence,
    };
  }

  // All valid decisions are approved.
  const representative = validDecisions[0];
  return {
    status: "approved",
    reviewer_interaction: {
      decision: "approved",
      reviewer_id: representative.reviewer_id,
      review_duration_ms: representative.review_duration_ms,
    },
    conflict_evidence,
  };
}
