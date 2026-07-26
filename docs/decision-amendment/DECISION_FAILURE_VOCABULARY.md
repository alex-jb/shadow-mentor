# Decision Failure Vocabulary

Status: discovery only. Machine-readable form:
`decision-failure-vocabulary.json`. Closed set — a future implementation may
not emit tokens outside this vocabulary without a contract version bump.

## Design rules

1. **Three disjoint classes.** Integrity failures (bytes/signatures), binding
   failures (references between objects), and authorization/business-state
   failures never share a token. A verifier reports the *first failing class*
   it can prove and does not speculate about later classes.
2. **Failures are facts, not judgments.** `ACTOR_AUTHORITY_UNVERIFIABLE`
   states that authority could not be verified — not that the actor lacked
   authority.
3. **A failed decision amendment never poisons its predecessor.** Predecessor
   packages keep their own verification results.

## Class I — Integrity (package/bytes layer; extends the existing package verifier vocabulary, does not replace it)

| Token | Meaning |
|---|---|
| `DECISION_AMENDMENT_MALFORMED` | Member fails schema parse / canonical form. |
| `DECISION_TYPE_UNSUPPORTED` | `decision_type` outside the closed set of four. |
| `DECISION_SIGNATURE_INVALID` | Signature over the decision member/package fails. |
| `DECISION_PACKAGE_TAMPERED` | Manifest hash mismatch for the decision member. |
| `DECISION_SIZE_BOUND_EXCEEDED` | Reason text / findings exceed signed size bounds. |
| `DECISION_TEXT_UNSAFE` | Text member violates safe-text constraints (e.g. embedded control characters beyond the allowed set). Rendering-layer escaping is Web's job; this token covers contract-level constraints only. |

## Class II — Binding (references between decision, target, case, session, package)

| Token | Meaning |
|---|---|
| `MISSING_DECISION_TARGET` | No target reference present. |
| `TARGET_PACKAGE_MISMATCH` | Referenced predecessor package ID/manifest SHA-256 matches no held package, or ID and hash disagree. |
| `TARGET_OBJECT_MISMATCH` | Target object hash does not match the object bytes in the predecessor. |
| `CASE_MISMATCH` | Amendment case_id differs from the target's case_id. |
| `SESSION_MISMATCH` | Amendment evidence session binding differs from the target's. |
| `REFERENCED_EVIDENCE_MISSING` | A referenced evidence event / prior decision is not present in the held set. |
| `DUPLICATE_DECISION` | decision_id already present in the held set with different bytes. |
| `REPLAYED_DECISION` | Identical decision bytes presented bound to a different case/target (cross-case substitution). |
| `FORKED_DECISION_CHAIN` | Multiple heads share one predecessor (display state — see note below). |
| `DECISION_CYCLE` | Predecessor references form a cycle. |

Note: `FORKED_DECISION_CHAIN` and `CONFLICTING_DECISION` are *reportable
conditions*, not verification failures — the packages involved remain valid.
They are listed here so the vocabulary is closed, and tagged
`severity: condition` in the JSON.

## Class III — Actor / authorization

| Token | Meaning |
|---|---|
| `ACTOR_MISSING` | No actor block in the signed payload. |
| `ACTOR_IDENTITY_UNVERIFIABLE` | Actor identity is operator-declared and no verification path exists (permanent in fixture mode; annotation-level, non-fatal). |
| `ACTOR_ROLE_UNSUPPORTED` | Role outside the closed role set. |
| `ACTOR_AUTHORITY_UNVERIFIABLE` | No authorization evidence resolvable (annotation-level, non-fatal in fixture mode). |
| `SEPARATION_OF_DUTIES_VIOLATION` | Same actor on review and approval while the signed policy declares separation enforced. Fatal to the approval's lifecycle effect; not fatal to package integrity. |

## Class IV — Business/lifecycle state

| Token | Meaning |
|---|---|
| `UNSUPPORTED_TRANSITION` | Amendment asserts a transition outside the closed transition table (e.g. approval without required review). |
| `REASON_MISSING` | Override/rejection without reason code + text. |
| `REASON_CODE_UNSUPPORTED` | Reason code outside the closed reason-code set. |
| `CONFLICTING_DECISION` | Two valid, non-superseding decisions assert incompatible dispositions for one target (condition, surfaced, never auto-resolved). |

## Severity model

- `fatal_integrity`: package/member excluded from all use.
- `fatal_binding`: amendment excluded from lifecycle derivation; displayed as
  orphan/mismatch.
- `fatal_lifecycle`: amendment displayed but has no lifecycle effect.
- `annotation`: non-fatal; carried alongside derived state (identity/authority
  unverified).
- `condition`: chain-level observation (fork, conflict); requires display,
  forbids silent resolution.
