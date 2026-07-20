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
