# Decision Target and Amendment Content

Status: discovery only.

## Target model

A decision amendment acts on **exactly one target object**, addressed through
two layers:

1. **Package layer** (reuses `shadow-package-supersession/1` binding
   verbatim): predecessor package ID + predecessor manifest SHA-256 (over the
   prior `manifest.json` file bytes, signature included) + predecessor
   manifest version + case ID + evidence session ID. This is already signed,
   already verified, already fork/cycle-checked by the chain verifier.
2. **Object layer** (new): which object *inside* that predecessor the
   decision addresses.

### Supported target object types (closed set for the first increment)

| `target.type` | Addressed by | Notes |
|---|---|---|
| `council_decision` | the effective Council result carried in the predecessor's presentation/evidence members | The default and, for the first increment, likely the only enabled type. |
| `council_voice_result` | voice ID within the Council result | Deferred: enable only when a per-voice hash is exposed. |
| `evidence_event` | `session_id` + `seq` + event hash | Deferred. |
| `prior_decision` | decision_id + decision member hash of an earlier amendment | Required for approval/rejection of overrides. |

`first_failure` and `downstream_consequence` are **not addressable**: Core
classifies business first-failure and downstream impact as `MISSING` and
"never synthesized" (contract-gap.json), and the flow-export contract forbids
those keys. A decision cannot target an object the producing system does not
emit. Case-level disposition is likewise not a target — it is *derived* from
the chain, never asserted.

### Minimum signed target reference

```
target: {
  type,                    // closed set above
  object_id,               // type-specific ID (e.g. decision_id for prior_decision)
  object_hash_sha256,      // sha256 over the exact bytes being decided on
  object_schema_version,   // schema of the target object (e.g. "1.1.0-mode-a")
  prior_effective_decision_id | null   // the disposition being displaced, when applicable
}
```

plus the package-layer `supersedes` block (unchanged fields). `case_id` and
`evidence_session_id` are NOT duplicated in `target` — they are already
signed in the manifest bindings and the supersedes block; duplication invites
divergence (`CASE_MISMATCH` exists to catch cross-object inconsistency, not
to make it representable twice).

`object_hash_sha256` is what prevents substituted-Council-result attacks: an
approval quoting a target hash that no longer matches the predecessor's bytes
fails `TARGET_OBJECT_MISMATCH` regardless of valid signatures.

## Amendment payload ("what changed")

```
decision: {
  decision_schema: "shadow-decision-amendment/1",
  decision_id,             // derived, see DECISION_SIGNING_BOUNDARY.md
  decision_type,           // HUMAN_REVIEW_COMPLETED | DECISION_OVERRIDDEN |
                           // APPROVAL_GRANTED | DECISION_REJECTED
  previous_disposition,    // e.g. "escalate" (from run-loan-council vocabulary)
  new_disposition | null,  // null for review/rejection; required for override
  reason_code,             // closed set (below)
  reason_text,             // signed, bounded (≤4 KiB), NFC UTF-8
  reviewer_findings | null,      // review only, bounded
  approval_conditions | null,    // approval only, bounded
  rejection_basis | null,        // rejection only, bounded
  referenced_evidence: [ {session_id, seq, event_hash} ],  // may be empty
  added_evidence: [],      // reserved, empty in first increment (new evidence
                           // arrives as evidence members, not inline)
  removed_reliance: [ {session_id, seq, event_hash} ],  // evidence the decision
                           // explicitly declines to rely on; never deletes it
  policy: {
    review_required,       // bool, signed
    approval_required,     // bool, signed
    separation_of_duties   // "enforced" | "not_enforced", signed
  },
  effective_scope: "this_case_only",   // closed; only value in first increment
  actor: { ... },          // per ACTOR_AND_AUTHORIZATION_MODEL.md
  decided_at_utc,          // deterministic from fixture input, never wall clock
  status_tokens: ["FIXTURE_DECISION_ONLY", ...]   // per FIXTURE_DECISION_BOUNDARY.md
}
```

Supersession marker: the successor package's `supersedes.marker` gains one
new value, `DECISION_AMENDMENT` — deliberately a single neutral marker rather
than four decision-type markers, so the chain layer stays semantics-free and
the decision type lives only in the signed decision member (single source of
truth; no marker↔member drift possible).

### Reason codes (closed starter set, fixture increment)

`POLICY_EXCEPTION`, `DATA_CORRECTION_UPSTREAM`, `ANALYST_JUDGMENT`,
`COMPLIANCE_DIRECTIVE`, `INSUFFICIENT_EVIDENCE`, `PROCEDURAL_ERROR`,
`NO_FINDINGS` (review-no-change only), `OTHER_SEE_TEXT` (requires non-empty
reason_text). Synthetic; production sets are a policy decision.

## Rules

- **No unsigned prose changes the effective decision.** Every
  disposition-affecting field above is inside the signed decision member,
  hash-bound in the signed manifest. Anything outside the signed bytes is
  display annotation at most.
- **Which human-authored text is signed:** `reason_text`,
  `reviewer_findings`, `approval_conditions`, `rejection_basis`,
  `actor.display_name`. All size-bounded at signing time (privacy model),
  NFC-normalized, control-characters restricted, rendered as text only.
- **The CAAT invariant carries over:** `decision_type` of
  `DECISION_OVERRIDDEN` or `DECISION_REJECTED` with empty
  `reason_code`/`reason_text` is `REASON_MISSING` — the existing
  `override_rationale` rule from `lib/reviewer-interaction.js`, promoted into
  signed bytes.
- **Claims that must remain unchanged:** the amendment carries no copy of
  predecessor content beyond hashes. Nothing in the predecessor is restated,
  so nothing can be restated wrongly.
