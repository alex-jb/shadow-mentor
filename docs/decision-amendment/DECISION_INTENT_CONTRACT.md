# shadow-decision-intent/1 — Unsigned CLI Input Contract

Status: IMPLEMENTED (fixture mode). Source: `validateDecisionIntent` in
`lib/decision-amendment.mjs`; consumed only by
`bin/shadow-audit-package.mjs decide`.

The intent is **an operator request to Core — never authoritative evidence.**
Core validates it strictly, then derives every binding field (predecessor
identity, case, session, target object hash, identity class, status tokens,
boundary) from the *verified predecessor package* itself. Nothing is copied
blindly; a field the operator may not assert (e.g. `identity_class`,
`authorization.status`) does not even exist in the intent schema.

## Shape (closed keys at every level)

```json
{
  "intent_schema": "shadow-decision-intent/1",
  "decision_type": "HUMAN_REVIEW_COMPLETED | DECISION_OVERRIDDEN | APPROVAL_GRANTED | DECISION_REJECTED",
  "actor": { "actor_id": "fixture:<slug>", "display_name": "…", "role": "reviewer | approver" },
  "target": { "type": "council_decision" }
              — or — { "type": "prior_decision", "decision_id": "<64-hex>" },
  "content": {
    "reason_code": "<closed fixture vocabulary>",
    "reason_text": "…",
    "review_outcome": "NO_CHANGE | OVERRIDE_PROPOSED",     // review only
    "reviewer_findings": "…",                              // review only
    "previous_disposition": "…", "new_disposition": "…",   // override only
    "approval_conditions": "…",                            // approval only, optional
    "rejection_basis": "…"                                 // rejection only
  },
  "policy": { "review_required": true, "approval_required": true, "separation_of_duties": "enforced | not_enforced" },
  "referenced_evidence": [ { "session_id": "…", "seq": 0, "payload_hash": "<64-hex>" } ],  // optional
  "decided_at_utc": "2026-07-22T01:00:00.000Z"
}
```

Reason codes (closed, synthetic fixture set): `POLICY_EXCEPTION`,
`DATA_CORRECTION_UPSTREAM`, `ANALYST_JUDGMENT`, `COMPLIANCE_DIRECTIVE`,
`INSUFFICIENT_EVIDENCE`, `PROCEDURAL_ERROR`, `NO_FINDINGS`, `OTHER_SEE_TEXT`
(requires substantive `reason_text`). Production vocabularies are a policy
decision outside this increment.

## Rejected (exit 3, nothing written)

- unknown fields anywhere (closed keys, never ignored)
- missing required fields; unsupported decision type or actor role
- `actor_id` outside the `fixture:<slug>` namespace (only operator-declared
  fixture actors exist)
- malformed target (`prior_decision` without a 64-hex `decision_id`;
  `decision_id` on a `council_decision` target)
- unsupported reason code; empty reason text
- oversized text (> 4 KiB / field; display name > 128 bytes), non-NFC text,
  control characters outside `\n`/`\t` (HTML is inert data — see contract)
- cross-type content fields (e.g. `new_disposition` on a review)
- identical previous/new dispositions on an override; `previous_disposition`
  that does not match the predecessor's effective disposition
- non-boolean policy flags; separation mode outside `enforced|not_enforced`
- non-ISO-UTC `decided_at_utc`
- there are no module/file/execution reference fields in the schema at all —
  any attempt to add one is an unknown field

Fixture intent examples are committed under `test/fixtures/decision/`.
