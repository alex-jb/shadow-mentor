// lib/decision-amendment.mjs
//
// shadow-decision-amendment/1 — the signed decision-member contract, the
// unsigned shadow-decision-intent/1 CLI input contract, the deterministic
// council-decision target extract, decision_id derivation, and the pure
// decision-lifecycle state machine. Implements the committed discovery
// decision NEW_DECISION_MEMBER_IN_PACKAGE_VERSION_RECOMMENDED
// (docs/decision-amendment/DECISION_CONTRACT_RECOMMENDATION.md).
//
// Layering rule: this module owns DECISION SEMANTICS ONLY and imports nothing
// from lib/portable-audit-package.mjs (which imports this module). Packaging,
// signing and chain verification stay where they already live.
//
// Invariants (do not weaken):
//   - Review is not Approval.
//   - Override never erases the original decision.
//   - A valid signature never proves actor authentication, decision
//     authority, separation-of-duties enforcement, or business correctness.
//   - Rejection is not package invalidity.
//   - Every effective-decision statement is derived from the locally supplied
//     package set only (DERIVED_FROM_LOCAL_SET) — never a global-latest claim.
//   - The Ed25519 package signer is NEVER the decision actor.
import { canonicalize, sha256Hex } from "../verify/verify-manifest.mjs";

// ---------------------------------------------------------------------------
// closed vocabularies
// ---------------------------------------------------------------------------

export const DECISION_SCHEMA = "shadow-decision-amendment/1";
export const DECISION_INTENT_SCHEMA = "shadow-decision-intent/1";
export const COUNCIL_EXTRACT_SCHEMA = "shadow-council-decision-extract/1";

export const DECISION_TYPES = Object.freeze([
  "HUMAN_REVIEW_COMPLETED",
  "DECISION_OVERRIDDEN",
  "APPROVAL_GRANTED",
  "DECISION_REJECTED",
]);
export const REVIEW_OUTCOMES = Object.freeze(["NO_CHANGE", "OVERRIDE_PROPOSED"]);
export const DECISION_ACTOR_ROLES = Object.freeze(["reviewer", "approver"]);
// fixture mode supports operator-declared identity ONLY; `authenticated` is a
// documented future value and is NOT accepted by this increment.
export const DECISION_IDENTITY_CLASSES = Object.freeze(["operator_declared"]);
export const DECISION_TARGET_TYPES = Object.freeze(["council_decision", "prior_decision"]);
export const DECISION_DISPOSITIONS = Object.freeze(["APPROVE", "APPROVE_WITH_CONDITIONS", "DECLINE", "REVIEW"]);
// closed FIXTURE reason codes (synthetic — production vocabularies are a policy decision)
export const DECISION_REASON_CODES = Object.freeze([
  "POLICY_EXCEPTION",
  "DATA_CORRECTION_UPSTREAM",
  "ANALYST_JUDGMENT",
  "COMPLIANCE_DIRECTIVE",
  "INSUFFICIENT_EVIDENCE",
  "PROCEDURAL_ERROR",
  "NO_FINDINGS",        // review / no-change only
  "OTHER_SEE_TEXT",     // requires non-empty reason_text
]);
export const SEPARATION_OF_DUTIES_MODES = Object.freeze(["enforced", "not_enforced"]);

// Honest fixture status tokens — carried INSIDE the signed member bytes so no
// display layer can strip them. All four are mandatory in fixture mode.
export const DECISION_STATUS_TOKENS = Object.freeze([
  "FIXTURE_DECISION_ONLY",
  "DECISION_IDENTITY_DECLARED_NOT_VERIFIED",
  "DECISION_AUTHORITY_UNVERIFIED",
  "SEPARATION_OF_DUTIES_NOT_ENFORCED",
]);

export const DECISION_BOUNDARY_STATEMENT =
  "A valid decision signature proves tamper-evidence of the recorded decision only — " +
  "never actor authentication, decision authority, separation-of-duties enforcement, " +
  "regulatory sign-off, or analytical/business correctness.";

export const LIFECYCLE_QUALIFIER = "DERIVED_FROM_LOCAL_SET";

// Closed decision failure vocabulary. Classes stay disjoint:
//   integrity (member bytes / schema)      → package verification failures
//   binding (references between objects)   → package/chain verification failures
//   actor/authorization                    → failures + permanent fixture annotations
//   business lifecycle                     → lifecycle derivation failures
// Annotation conditions (identity/authority unverified) are NOT integrity
// failures and never fail package verification on their own.
export const DECISION_FAILURE_CODES = Object.freeze([
  // integrity
  "DECISION_MALFORMED",
  "DECISION_TYPE_UNSUPPORTED",
  "DECISION_SIGNATURE_INVALID",   // reserved: manifest signature already covers the member
  "DECISION_PACKAGE_TAMPERED",    // reserved: member hash mismatch surfaces as TAMPERED
  // binding
  "DECISION_TARGET_MISSING",
  "DECISION_TARGET_MISMATCH",
  "TARGET_OBJECT_MISMATCH",
  "CASE_MISMATCH",
  "SESSION_MISMATCH",
  "REFERENCED_EVIDENCE_MISSING",
  "DECISION_DUPLICATE",
  "DECISION_REPLAYED",
  "DECISION_CHAIN_FORK",
  // actor / authorization
  "ACTOR_MISSING",
  "ACTOR_ROLE_UNSUPPORTED",
  "ACTOR_IDENTITY_UNVERIFIED",    // annotation, never fatal on its own
  "DECISION_AUTHORITY_UNVERIFIED",// annotation, never fatal on its own
  "SEPARATION_OF_DUTIES_VIOLATION",
  // business lifecycle
  "DECISION_TRANSITION_UNSUPPORTED",
  "DECISION_REASON_MISSING",
  "DECISION_REASON_CODE_UNSUPPORTED",
  "DECISION_CONFLICT",
]);

// Permanent fixture-mode annotations (conditions, not failures).
export const DECISION_ANNOTATIONS = Object.freeze([
  "ACTOR_IDENTITY_UNVERIFIED",
  "DECISION_AUTHORITY_UNVERIFIED",
  "SEPARATION_OF_DUTIES_NOT_ENFORCED",
]);

// Lifecycle states (business axis ONLY — package-integrity states never appear here).
export const DECISION_LIFECYCLE_STATES = Object.freeze([
  "UNREVIEWED",
  "REVIEW_COMPLETED_NO_CHANGE",
  "REVIEW_COMPLETED_OVERRIDE_PROPOSED",
  "OVERRIDE_PENDING_APPROVAL",
  "OVERRIDDEN",
  "APPROVED",
  "REJECTED",
  "FORKED",
]);

// Closed transition table: which decision types may act on a target in a given
// lifecycle state. "review_not_required" marks the single contract-defined
// policy exception: APPROVAL_GRANTED without a qualifying review is accepted
// ONLY when the approval's own signed policy carries review_required=false.
export const DECISION_TRANSITIONS = Object.freeze({
  UNREVIEWED: { HUMAN_REVIEW_COMPLETED: "always", APPROVAL_GRANTED: "review_not_required" },
  REVIEW_COMPLETED_NO_CHANGE: { HUMAN_REVIEW_COMPLETED: "always", APPROVAL_GRANTED: "always" },
  REVIEW_COMPLETED_OVERRIDE_PROPOSED: { HUMAN_REVIEW_COMPLETED: "always", DECISION_OVERRIDDEN: "always", DECISION_REJECTED: "always" },
  OVERRIDE_PENDING_APPROVAL: { HUMAN_REVIEW_COMPLETED: "always", APPROVAL_GRANTED: "always", DECISION_REJECTED: "always" },
  OVERRIDDEN: { HUMAN_REVIEW_COMPLETED: "always", DECISION_REJECTED: "always" },
  APPROVED: { HUMAN_REVIEW_COMPLETED: "always", DECISION_REJECTED: "always" },
  REJECTED: { HUMAN_REVIEW_COMPLETED: "always" },
});

// text bounds (bytes of the NFC UTF-8 form)
export const MAX_TEXT_BYTES = 4096;
export const MAX_NAME_BYTES = 128;

const HEX64 = /^[0-9a-f]{64}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
// operator-declared fixture actors are explicitly namespaced — nothing else parses
const FIXTURE_ACTOR_ID = /^fixture:[a-z0-9][a-z0-9-]{0,60}$/;
// control characters other than \n and \t are rejected; \r, BOM/ZWNBSP included
const FORBIDDEN_TEXT = /[\u0000-\u0008\u000B-\u001F\u007F\uFEFF]/;

// ---------------------------------------------------------------------------
// text rules
// ---------------------------------------------------------------------------

// Returns null when valid, else a human-readable problem string.
export function textError(value, { field, maxBytes = MAX_TEXT_BYTES, required = true } = {}) {
  if (value === null || value === undefined) return required ? `${field} is required` : null;
  if (typeof value !== "string") return `${field} must be a string`;
  if (required && value.length === 0) return `${field} must be non-empty`;
  if (FORBIDDEN_TEXT.test(value)) return `${field} contains a control character outside the documented whitespace (\\n, \\t)`;
  if (value !== value.normalize("NFC")) return `${field} is not Unicode NFC-normalized`;
  if (Buffer.byteLength(value, "utf8") > maxBytes) return `${field} exceeds ${maxBytes} bytes (UTF-8)`;
  return null;
}

// Core-side normalization applied when GENERATING a member from an intent:
// NFC only. Structure violations (control chars, size) are rejected, never repaired.
export function normalizeText(value) {
  return typeof value === "string" ? value.normalize("NFC") : value;
}

// ---------------------------------------------------------------------------
// council-decision target extract (the authoritative target byte source)
// ---------------------------------------------------------------------------
//
// TARGET HASH DECISION (resolves the committed discovery unknown #1):
// the decided object is a deterministic canonical extract of the decision-
// bearing fields of the predecessor's SIGNED presentation member
// (shadow-flow-export/1.0), under the new explicit schema
// shadow-council-decision-extract/1 — discovery preference order option 2.
//   - option 1 (an existing canonical signed object in evidence) fails
//     honestly: the council conclusion lives in the model_output event
//     PAYLOAD, which is off-chain by design (payload_hash only) — the bytes
//     being decided on are not present in the package.
//   - option 3 (the raw presentation member) is a UI row table (CSV included)
//     and is explicitly not "the object actually being decided".
// The extract is re-derivable by ANY verifier from the predecessor's
// hash-bound presentation member bytes, so target_object substitution is
// detectable without trusting the decision package.
export function deriveCouncilDecisionExtract(presentation) {
  if (!presentation || typeof presentation !== "object" || !Array.isArray(presentation.rows)) {
    return { error: "presentation member is not a shadow-flow-export/1.0 object with rows" };
  }
  const rows = presentation.rows;
  if (rows.length === 0) return { error: "presentation member has no rows" };
  const first = rows[0];
  for (const f of ["recommendation", "compliance_status", "signed_result_status", "mode_label"]) {
    if (!rows.every((r) => r[f] === first[f])) {
      return { error: `presentation rows disagree on ${f} — no single council decision can be extracted` };
    }
  }
  const council = rows
    .filter((r) => r.row_type === "council")
    .map((r) => ({ voice: r.council_voice, stance: r.stance, confidence: r.confidence }))
    .sort((a, b) => String(a.voice).localeCompare(String(b.voice)));
  if (council.length === 0) return { error: "presentation member has no council rows" };
  const extract = {
    schema_version: COUNCIL_EXTRACT_SCHEMA,
    case_id: presentation.case_id,
    recommendation: first.recommendation,
    compliance_status: first.compliance_status,
    signed_result_status: first.signed_result_status,
    mode_label: first.mode_label,
    council,
  };
  const bytes = Buffer.from(canonicalize(extract), "utf8");
  return { extract, bytes, sha256: sha256Hex(bytes), object_id: `council-decision:${presentation.case_id}` };
}

// ---------------------------------------------------------------------------
// decision_id derivation
// ---------------------------------------------------------------------------
//
// decision_id = sha256( content_hash \n predecessor_package_id \n
//                       predecessor_manifest_sha256 \n case_id \n target.object_id )
// where content_hash = sha256(canonicalize(member minus decision_id)).
// Content-derived like package_id: identical decision content against a
// different predecessor, case, or target yields a DIFFERENT id, so cross-case
// and cross-predecessor replays cannot keep a valid id. No randomness, no
// wall clock.
export function computeDecisionId(member) {
  const { decision_id, ...rest } = member;
  const contentHash = sha256Hex(Buffer.from(canonicalize(rest), "utf8"));
  return sha256Hex([
    contentHash,
    member?.predecessor?.package_id ?? "",
    member?.predecessor?.manifest_sha256 ?? "",
    member?.case_id ?? "",
    member?.target?.object_id ?? "",
  ].join("\n"));
}

// ---------------------------------------------------------------------------
// intent validation (shadow-decision-intent/1 — unsigned operator input)
// ---------------------------------------------------------------------------

const INTENT_KEYS = ["intent_schema", "decision_type", "actor", "target", "content", "policy", "referenced_evidence", "decided_at_utc"];
const INTENT_ACTOR_KEYS = ["actor_id", "display_name", "role"];
const INTENT_TARGET_KEYS = ["type", "decision_id"];
const INTENT_CONTENT_KEYS = ["reason_code", "reason_text", "review_outcome", "previous_disposition", "new_disposition", "reviewer_findings", "approval_conditions", "rejection_basis"];
const INTENT_POLICY_KEYS = ["review_required", "approval_required", "separation_of_duties"];
const EVIDENCE_REF_KEYS = ["session_id", "seq", "payload_hash"];

function closedKeys(obj, allowed, label, errs) {
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) errs.push(`${label}: unknown field "${k}"`);
}

// Strict validation of an operator-supplied decision intent. Returns a string
// array of problems (empty = valid). The intent is a REQUEST, never evidence:
// Core re-derives every binding field itself and copies nothing blindly.
export function validateDecisionIntent(intent) {
  const errs = [];
  if (!intent || typeof intent !== "object" || Array.isArray(intent)) return ["intent must be a JSON object"];
  closedKeys(intent, INTENT_KEYS, "intent", errs);
  if (intent.intent_schema !== DECISION_INTENT_SCHEMA) errs.push(`intent_schema must be ${DECISION_INTENT_SCHEMA}`);
  if (!DECISION_TYPES.includes(intent.decision_type)) errs.push(`decision_type ${JSON.stringify(intent.decision_type)} is not in the closed vocabulary (${DECISION_TYPES.join(", ")})`);

  // actor (identity_class is added by Core — an intent may not claim one)
  const a = intent.actor;
  if (!a || typeof a !== "object" || Array.isArray(a)) errs.push("actor is required (actor_id, display_name, role)");
  else {
    closedKeys(a, INTENT_ACTOR_KEYS, "actor", errs);
    if (typeof a.actor_id !== "string" || !FIXTURE_ACTOR_ID.test(a.actor_id)) {
      errs.push('actor.actor_id must match fixture:<slug> (lowercase, digits, "-"; ≤64 chars) — only operator-declared fixture actors exist in this increment');
    }
    const nameErr = textError(a.display_name, { field: "actor.display_name", maxBytes: MAX_NAME_BYTES });
    if (nameErr) errs.push(nameErr);
    if (!DECISION_ACTOR_ROLES.includes(a.role)) errs.push(`actor.role ${JSON.stringify(a.role)} is not in the closed vocabulary (${DECISION_ACTOR_ROLES.join(", ")})`);
  }

  // target
  const t = intent.target;
  if (!t || typeof t !== "object" || Array.isArray(t)) errs.push("target is required ({type} or {type, decision_id})");
  else {
    closedKeys(t, INTENT_TARGET_KEYS, "target", errs);
    if (!DECISION_TARGET_TYPES.includes(t.type)) errs.push(`target.type ${JSON.stringify(t.type)} is not in the closed vocabulary (${DECISION_TARGET_TYPES.join(", ")})`);
    if (t.type === "prior_decision" && (typeof t.decision_id !== "string" || !HEX64.test(t.decision_id))) {
      errs.push("target.decision_id must be the 64-hex decision_id of the predecessor's decision member");
    }
    if (t.type === "council_decision" && t.decision_id !== undefined) errs.push("target.decision_id is only valid for target.type prior_decision");
  }

  // content — type-specific requirements
  const c = intent.content;
  if (!c || typeof c !== "object" || Array.isArray(c)) errs.push("content is required");
  else {
    closedKeys(c, INTENT_CONTENT_KEYS, "content", errs);
    if (!DECISION_REASON_CODES.includes(c.reason_code)) errs.push(`content.reason_code ${JSON.stringify(c.reason_code)} is not in the closed fixture vocabulary (${DECISION_REASON_CODES.join(", ")})`);
    const txt = (field, required) => { const e = textError(c[field], { field: `content.${field}`, required }); if (e) errs.push(e); };
    txt("reason_text", true); // every decision carries signed reason text
    if (c.reason_code === "OTHER_SEE_TEXT" && (typeof c.reason_text !== "string" || !c.reason_text.trim())) {
      errs.push("content.reason_text must be substantive when reason_code is OTHER_SEE_TEXT");
    }
    switch (intent.decision_type) {
      case "HUMAN_REVIEW_COMPLETED":
        if (!REVIEW_OUTCOMES.includes(c.review_outcome)) errs.push(`content.review_outcome must be one of ${REVIEW_OUTCOMES.join(", ")}`);
        txt("reviewer_findings", true);
        for (const f of ["previous_disposition", "new_disposition", "approval_conditions", "rejection_basis"]) {
          if (c[f] !== undefined) errs.push(`content.${f} is not a review field`);
        }
        break;
      case "DECISION_OVERRIDDEN":
        if (!DECISION_DISPOSITIONS.includes(c.previous_disposition)) errs.push(`content.previous_disposition must be one of ${DECISION_DISPOSITIONS.join(", ")}`);
        if (!DECISION_DISPOSITIONS.includes(c.new_disposition)) errs.push(`content.new_disposition must be one of ${DECISION_DISPOSITIONS.join(", ")}`);
        if (c.previous_disposition && c.previous_disposition === c.new_disposition) errs.push("content.new_disposition must differ from content.previous_disposition — an override that changes nothing is not an override");
        for (const f of ["review_outcome", "reviewer_findings", "approval_conditions", "rejection_basis"]) {
          if (c[f] !== undefined) errs.push(`content.${f} is not an override field`);
        }
        break;
      case "APPROVAL_GRANTED":
        txt("approval_conditions", false);
        for (const f of ["review_outcome", "reviewer_findings", "previous_disposition", "new_disposition", "rejection_basis"]) {
          if (c[f] !== undefined) errs.push(`content.${f} is not an approval field`);
        }
        break;
      case "DECISION_REJECTED":
        txt("rejection_basis", true);
        for (const f of ["review_outcome", "reviewer_findings", "previous_disposition", "new_disposition", "approval_conditions"]) {
          if (c[f] !== undefined) errs.push(`content.${f} is not a rejection field`);
        }
        break;
      default: break; // unsupported type already reported
    }
  }

  // policy — all three flags explicit, no defaults hidden from the signed bytes
  const p = intent.policy;
  if (!p || typeof p !== "object" || Array.isArray(p)) errs.push("policy is required ({review_required, approval_required, separation_of_duties})");
  else {
    closedKeys(p, INTENT_POLICY_KEYS, "policy", errs);
    if (typeof p.review_required !== "boolean") errs.push("policy.review_required must be a boolean");
    if (typeof p.approval_required !== "boolean") errs.push("policy.approval_required must be a boolean");
    if (!SEPARATION_OF_DUTIES_MODES.includes(p.separation_of_duties)) errs.push(`policy.separation_of_duties must be one of ${SEPARATION_OF_DUTIES_MODES.join(", ")}`);
  }

  // referenced evidence (optional; hash/reference semantics only — no payload content)
  if (intent.referenced_evidence !== undefined) {
    if (!Array.isArray(intent.referenced_evidence)) errs.push("referenced_evidence must be an array");
    else for (const [i, r] of intent.referenced_evidence.entries()) {
      if (!r || typeof r !== "object" || Array.isArray(r)) { errs.push(`referenced_evidence[${i}] must be an object`); continue; }
      closedKeys(r, EVIDENCE_REF_KEYS, `referenced_evidence[${i}]`, errs);
      if (typeof r.session_id !== "string" || !r.session_id) errs.push(`referenced_evidence[${i}].session_id missing`);
      if (!Number.isInteger(r.seq) || r.seq < 0) errs.push(`referenced_evidence[${i}].seq must be a non-negative integer`);
      if (typeof r.payload_hash !== "string" || !HEX64.test(r.payload_hash)) errs.push(`referenced_evidence[${i}].payload_hash must be 64-hex`);
    }
  }

  if (typeof intent.decided_at_utc !== "string" || !ISO_UTC.test(intent.decided_at_utc)) {
    errs.push("decided_at_utc must be a deterministic ISO-8601 UTC string supplied by the operator (never wall clock)");
  }
  return errs;
}

// ---------------------------------------------------------------------------
// decision member validation (shadow-decision-amendment/1 — signed bytes)
// ---------------------------------------------------------------------------

const MEMBER_KEYS = ["decision_schema", "decision_id", "decision_type", "predecessor", "case_id", "evidence_session_id", "target", "actor", "authorization", "content", "referenced_evidence", "policy", "status_tokens", "decided_at_utc", "effective_scope", "boundary"];
const MEMBER_PREDECESSOR_KEYS = ["package_id", "manifest_sha256", "manifest_version"];
const MEMBER_TARGET_KEYS = ["type", "object_id", "object_sha256", "object_schema_version", "prior_effective_decision_id"];
const MEMBER_ACTOR_KEYS = ["actor_id", "display_name", "role", "identity_class"];
const MEMBER_AUTHZ_KEYS = ["status", "authorization_ref"];

// Validate a parsed decision member in isolation (no predecessor bytes needed).
// Returns [{code, detail}] — codes from DECISION_FAILURE_CODES. Cross-package
// checks (target-object hashes, duplicates, forks) live at the chain layer.
export function validateDecisionMember(member) {
  const errs = [];
  const fail = (code, detail) => errs.push({ code, detail });
  if (!member || typeof member !== "object" || Array.isArray(member)) return [{ code: "DECISION_MALFORMED", detail: "decision member must be a JSON object" }];
  for (const k of Object.keys(member)) if (!MEMBER_KEYS.includes(k)) fail("DECISION_MALFORMED", `unknown field "${k}"`);
  if (member.decision_schema !== DECISION_SCHEMA) fail("DECISION_MALFORMED", `decision_schema must be ${DECISION_SCHEMA}`);
  if (!DECISION_TYPES.includes(member.decision_type)) fail("DECISION_TYPE_UNSUPPORTED", `decision_type ${JSON.stringify(member.decision_type)} is outside the closed vocabulary`);

  // predecessor binding block (must mirror the manifest's supersedes claim)
  const pred = member.predecessor;
  if (!pred || typeof pred !== "object" || Array.isArray(pred)) fail("DECISION_TARGET_MISSING", "predecessor block missing");
  else {
    for (const k of Object.keys(pred)) if (!MEMBER_PREDECESSOR_KEYS.includes(k)) fail("DECISION_MALFORMED", `predecessor: unknown field "${k}"`);
    if (typeof pred.package_id !== "string" || !HEX64.test(pred.package_id)) fail("DECISION_MALFORMED", "predecessor.package_id must be 64-hex");
    if (typeof pred.manifest_sha256 !== "string" || !HEX64.test(pred.manifest_sha256)) fail("DECISION_MALFORMED", "predecessor.manifest_sha256 must be 64-hex");
    if (typeof pred.manifest_version !== "string" || !pred.manifest_version) fail("DECISION_MALFORMED", "predecessor.manifest_version missing");
  }
  if (typeof member.case_id !== "string" || !member.case_id) fail("DECISION_MALFORMED", "case_id missing");
  if (typeof member.evidence_session_id !== "string" || !member.evidence_session_id) fail("DECISION_MALFORMED", "evidence_session_id missing");

  // target
  const t = member.target;
  if (!t || typeof t !== "object" || Array.isArray(t)) fail("DECISION_TARGET_MISSING", "target block missing");
  else {
    for (const k of Object.keys(t)) if (!MEMBER_TARGET_KEYS.includes(k)) fail("DECISION_MALFORMED", `target: unknown field "${k}"`);
    if (!DECISION_TARGET_TYPES.includes(t.type)) fail("DECISION_TARGET_MISMATCH", `target.type ${JSON.stringify(t.type)} is outside the closed vocabulary`);
    if (typeof t.object_id !== "string" || !t.object_id) fail("DECISION_TARGET_MISSING", "target.object_id missing");
    if (typeof t.object_sha256 !== "string" || !HEX64.test(t.object_sha256)) fail("DECISION_MALFORMED", "target.object_sha256 must be 64-hex");
    if (typeof t.object_schema_version !== "string" || !t.object_schema_version) fail("DECISION_MALFORMED", "target.object_schema_version missing");
    if (t.prior_effective_decision_id !== null && (typeof t.prior_effective_decision_id !== "string" || !HEX64.test(t.prior_effective_decision_id))) {
      fail("DECISION_MALFORMED", "target.prior_effective_decision_id must be 64-hex or null");
    }
    if (t.type === "council_decision" && t.object_schema_version !== COUNCIL_EXTRACT_SCHEMA) fail("DECISION_TARGET_MISMATCH", `a council_decision target must use ${COUNCIL_EXTRACT_SCHEMA}`);
    if (t.type === "prior_decision" && t.object_schema_version !== DECISION_SCHEMA) fail("DECISION_TARGET_MISMATCH", `a prior_decision target must use ${DECISION_SCHEMA}`);
    // type↔target compatibility: an override replaces the COUNCIL disposition;
    // a rejection closes a specific PRIOR DECISION branch
    if (member.decision_type === "DECISION_OVERRIDDEN" && t.type !== "council_decision") fail("DECISION_TARGET_MISMATCH", "DECISION_OVERRIDDEN must target the council_decision whose disposition it replaces");
    if (member.decision_type === "DECISION_REJECTED" && t.type !== "prior_decision") fail("DECISION_TARGET_MISMATCH", "DECISION_REJECTED must target a specific prior_decision (a proposal or decision branch), never the council decision itself");
  }

  // actor — the decision actor is NEVER the package signing key
  const a = member.actor;
  if (!a || typeof a !== "object" || Array.isArray(a)) fail("ACTOR_MISSING", "actor block missing");
  else {
    for (const k of Object.keys(a)) if (!MEMBER_ACTOR_KEYS.includes(k)) fail("DECISION_MALFORMED", `actor: unknown field "${k}"`);
    if (typeof a.actor_id !== "string" || !FIXTURE_ACTOR_ID.test(a.actor_id)) fail("DECISION_MALFORMED", "actor.actor_id must match fixture:<slug> in this increment");
    const nameErr = textError(a.display_name, { field: "actor.display_name", maxBytes: MAX_NAME_BYTES });
    if (nameErr) fail("DECISION_MALFORMED", nameErr);
    if (!DECISION_ACTOR_ROLES.includes(a.role)) fail("ACTOR_ROLE_UNSUPPORTED", `actor.role ${JSON.stringify(a.role)} is outside the closed vocabulary`);
    if (!DECISION_IDENTITY_CLASSES.includes(a.identity_class)) fail("DECISION_MALFORMED", `actor.identity_class ${JSON.stringify(a.identity_class)} — only operator_declared exists in fixture mode`);
  }

  // authorization — honestly unverified in fixture mode, always
  const z = member.authorization;
  if (!z || typeof z !== "object" || Array.isArray(z)) fail("DECISION_MALFORMED", "authorization block missing");
  else {
    for (const k of Object.keys(z)) if (!MEMBER_AUTHZ_KEYS.includes(k)) fail("DECISION_MALFORMED", `authorization: unknown field "${k}"`);
    if (z.status !== "DECISION_AUTHORITY_UNVERIFIED") fail("DECISION_MALFORMED", 'authorization.status must be "DECISION_AUTHORITY_UNVERIFIED" — no authority verification exists in fixture mode');
    if (z.authorization_ref !== null) fail("DECISION_MALFORMED", "authorization.authorization_ref must be null in fixture mode (reserved for a future external authorization record)");
  }

  // content — reuse the intent's type-specific rules on the signed form
  const contentErrs = [];
  const pseudoIntent = {
    intent_schema: DECISION_INTENT_SCHEMA,
    decision_type: member.decision_type,
    actor: a ? { actor_id: a.actor_id, display_name: a.display_name, role: a.role } : undefined,
    target: t ? { type: t.type, ...(t.type === "prior_decision" ? { decision_id: t.object_id } : {}) } : undefined,
    content: member.content,
    policy: member.policy,
    ...(member.referenced_evidence?.length ? { referenced_evidence: member.referenced_evidence } : {}),
    decided_at_utc: member.decided_at_utc,
  };
  if (DECISION_TYPES.includes(member.decision_type)) {
    for (const e of validateDecisionIntent(pseudoIntent)) contentErrs.push(e);
  }
  for (const e of contentErrs) {
    if (/reason_code .* is not in the closed/.test(e)) fail("DECISION_REASON_CODE_UNSUPPORTED", e);
    else if (/reason_text/.test(e)) fail("DECISION_REASON_MISSING", e);
    else if (/actor\.role/.test(e)) fail("ACTOR_ROLE_UNSUPPORTED", e);
    else fail("DECISION_MALFORMED", e);
  }
  // NFC + control-character check over every signed text field (defense in depth)
  if (member.content && typeof member.content === "object") {
    for (const f of ["reason_text", "reviewer_findings", "approval_conditions", "rejection_basis"]) {
      const e = textError(member.content[f], { field: `content.${f}`, required: false });
      if (e) fail("DECISION_MALFORMED", e);
    }
  }

  // status tokens — the honest fixture set is mandatory and exact
  if (!Array.isArray(member.status_tokens)) fail("DECISION_MALFORMED", "status_tokens missing");
  else {
    for (const tok of DECISION_STATUS_TOKENS) if (!member.status_tokens.includes(tok)) fail("DECISION_MALFORMED", `status_tokens must carry ${tok} (fixture honesty is signed, not display-optional)`);
    for (const tok of member.status_tokens) if (!DECISION_STATUS_TOKENS.includes(tok)) fail("DECISION_MALFORMED", `unknown status token: ${tok}`);
  }

  if (member.effective_scope !== "this_case_only") fail("DECISION_MALFORMED", 'effective_scope must be "this_case_only"');
  if (member.boundary !== DECISION_BOUNDARY_STATEMENT) fail("DECISION_MALFORMED", "boundary statement missing or altered");
  if (typeof member.decided_at_utc !== "string" || !ISO_UTC.test(member.decided_at_utc)) fail("DECISION_MALFORMED", "decided_at_utc must be an ISO-8601 UTC string");

  // decision_id — format + deterministic re-derivation
  if (typeof member.decision_id !== "string" || !HEX64.test(member.decision_id)) {
    fail("DECISION_MALFORMED", "decision_id must be 64-hex");
  } else if (errs.length === 0 && computeDecisionId(member) !== member.decision_id) {
    fail("DECISION_MALFORMED", "decision_id does not re-derive from the member content and its predecessor/case/target bindings");
  }
  return errs;
}

// ---------------------------------------------------------------------------
// lifecycle: single-package state + pure chain derivation
// ---------------------------------------------------------------------------

// The lifecycle state a single package leaves its target in (the state a
// direct successor transitions FROM). A package without a decision member is
// UNREVIEWED — the original Council conclusion stands untouched.
export function packageDecisionState(decisionMember) {
  if (!decisionMember) return "UNREVIEWED";
  switch (decisionMember.decision_type) {
    case "HUMAN_REVIEW_COMPLETED":
      return decisionMember.content?.review_outcome === "OVERRIDE_PROPOSED"
        ? "REVIEW_COMPLETED_OVERRIDE_PROPOSED" : "REVIEW_COMPLETED_NO_CHANGE";
    case "DECISION_OVERRIDDEN":
      return decisionMember.policy?.approval_required ? "OVERRIDE_PENDING_APPROVAL" : "OVERRIDDEN";
    case "APPROVAL_GRANTED":
      return decisionMember.target?.type === "prior_decision" ? "OVERRIDDEN" : "APPROVED";
    case "DECISION_REJECTED":
      return "REJECTED";
    default:
      return "UNREVIEWED";
  }
}

// Is `decisionType` a permitted transition out of `fromState`?
// Returns null when permitted, else a {code, detail} failure.
export function transitionError(fromState, decisionMember) {
  const decisionType = decisionMember.decision_type;
  const rule = DECISION_TRANSITIONS[fromState]?.[decisionType];
  if (rule === "always") return null;
  if (rule === "review_not_required") {
    if (decisionMember.policy?.review_required === false) return null;
    return {
      code: "DECISION_TRANSITION_UNSUPPORTED",
      detail: `${decisionType} without a qualifying review requires the signed policy exception review_required=false (target state: ${fromState})`,
    };
  }
  return {
    code: "DECISION_TRANSITION_UNSUPPORTED",
    detail: `${decisionType} is not a permitted transition from ${fromState}`,
  };
}

// Pure, deterministic lifecycle derivation over ONE locally supplied chain.
//
// nodes: root→head array of { package_id, manifest_version, decision } where
//   decision is the parsed decision member or null. The caller guarantees the
//   order came from verified signed links (verifyPackageChain), NEVER from
//   import order or timestamps.
// chainMeta: { chain_ok, forked, original_disposition }.
//
// Returns { state, effective_disposition, effective_decision_id, nodes[],
//           failures[], annotations[], qualifier, note }.
// Integrity states never appear here: an invalid chain yields state=null with
// an honest note, not a business state.
export function deriveDecisionLifecycle(nodes, { chain_ok, forked = false, original_disposition = null } = {}) {
  const qualifier = LIFECYCLE_QUALIFIER;
  const failures = [];
  const annotations = [];
  if (forked) {
    // every fork head is displayed; no effective decision is derived, no tiebreak
    failures.push({ code: "DECISION_CHAIN_FORK", detail: "two or more valid successors share one predecessor — forks are reported, never resolved (no timestamp or import-order tiebreak)" });
    return { state: "FORKED", effective_disposition: null, effective_decision_id: null, nodes: [], failures, annotations, qualifier, note: "fork observed in the locally supplied set — no effective decision is derivable until a signed re-linearization exists" };
  }
  if (!chain_ok) {
    return { state: null, effective_disposition: null, effective_decision_id: null, nodes: [], failures, annotations, qualifier, note: "package chain did not verify — the business lifecycle is not derived from an unverified chain" };
  }

  let state = "UNREVIEWED";
  let effective = original_disposition;
  let effectiveDecisionId = null;
  const dispositionStack = [];  // overrides in effect (supports revert on rejection)
  const outNodes = [];

  for (const [index, node] of nodes.entries()) {
    if (!node.decision) {
      outNodes.push({ package_id: node.package_id, decision_id: null, state_after: state, effect: "original" });
      continue;
    }
    const d = node.decision;
    const nodeAnnotations = [...DECISION_ANNOTATIONS];
    // The root of the SUPPLIED set may itself be a decision package whose own
    // predecessor was not supplied (partial-chain verification). Its inbound
    // transition cannot be re-checked without that predecessor — it seeds the
    // state directly and is annotated, never silently trusted as re-verified.
    const isUnverifiableRoot = index === 0;
    const terr = isUnverifiableRoot ? null : transitionError(state, d);
    if (isUnverifiableRoot) nodeAnnotations.push("ROOT_TRANSITION_NOT_RECHECKED_PREDECESSOR_NOT_SUPPLIED");
    if (terr) {
      failures.push({ ...terr, decision_id: d.decision_id });
      outNodes.push({ package_id: node.package_id, decision_id: d.decision_id, state_after: state, effect: "none (unsupported transition)", annotations: nodeAnnotations });
      continue; // fail closed: the node has no lifecycle effect; the chain remains displayed
    }
    // separation of duties: structural check against the DECLARED policy only —
    // fixture mode never claims organizational enforcement
    if ((d.decision_type === "APPROVAL_GRANTED" || d.decision_type === "DECISION_REJECTED") && d.policy?.separation_of_duties === "enforced") {
      const priorActors = outNodes
        .map((n) => n.actor_id)
        .filter(Boolean);
      const targetNode = outNodes.find((n) => n.decision_id && n.decision_id === d.target?.object_id);
      const conflicting = targetNode ? targetNode.actor_id === d.actor?.actor_id
        : priorActors.includes(d.actor?.actor_id);
      if (conflicting) {
        failures.push({ code: "SEPARATION_OF_DUTIES_VIOLATION", decision_id: d.decision_id, detail: `actor ${d.actor?.actor_id} appears on both sides of a decision whose signed policy declares separation_of_duties=enforced — the ${d.decision_type} has no lifecycle effect (structural check only; organizational enforcement is NOT claimed)` });
        outNodes.push({ package_id: node.package_id, decision_id: d.decision_id, actor_id: d.actor?.actor_id, state_after: state, effect: "none (separation-of-duties violation)", annotations: nodeAnnotations });
        continue;
      }
    }
    const next = packageDecisionState(d);
    if (next === "OVERRIDDEN" && d.decision_type === "DECISION_OVERRIDDEN") {
      dispositionStack.push({ disposition: d.content.new_disposition, decision_id: d.decision_id });
      effective = d.content.new_disposition;
      effectiveDecisionId = d.decision_id;
    } else if (next === "OVERRIDDEN" && d.decision_type === "APPROVAL_GRANTED") {
      // approval activates the pending override it targets
      const pending = nodes.map((n) => n.decision).find((x) => x && x.decision_id === d.target?.object_id);
      const dispo = pending?.content?.new_disposition ?? null;
      dispositionStack.push({ disposition: dispo, decision_id: pending?.decision_id ?? d.decision_id });
      effective = dispo;
      effectiveDecisionId = pending?.decision_id ?? d.decision_id;
    } else if (next === "APPROVED") {
      effective = original_disposition;
      effectiveDecisionId = d.decision_id;
    } else if (next === "REJECTED") {
      // the rejected branch closes; effective reverts to the most recent
      // non-rejected disposition, else the original (which is never erased)
      if (dispositionStack.length && d.target?.object_id === dispositionStack[dispositionStack.length - 1].decision_id) dispositionStack.pop();
      else if (dispositionStack.length) dispositionStack.pop();
      effective = dispositionStack.length ? dispositionStack[dispositionStack.length - 1].disposition : original_disposition;
      effectiveDecisionId = dispositionStack.length ? dispositionStack[dispositionStack.length - 1].decision_id : null;
    }
    state = next;
    outNodes.push({ package_id: node.package_id, decision_id: d.decision_id, actor_id: d.actor?.actor_id, decision_type: d.decision_type, state_after: state, effect: next, annotations: nodeAnnotations });
  }
  annotations.push(...DECISION_ANNOTATIONS.filter(() => outNodes.some((n) => n.decision_id)));
  return {
    state,
    effective_disposition: effective,
    effective_decision_id: effectiveDecisionId,
    nodes: outNodes,
    failures,
    annotations: [...new Set(annotations)],
    qualifier,
    note: "derived from the locally supplied packages only — never a claim about packages that were not supplied",
  };
}
