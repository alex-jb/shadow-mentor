# Decision Lifecycle Derivation

Status: IMPLEMENTED. Source: `packageDecisionState`, `transitionError`,
`deriveDecisionLifecycle` in `lib/decision-amendment.mjs` (pure,
deterministic); wired through `verifyDecisionChain` and the CLI.

Implements the committed state machine (`decision-state-machine.json`, same
directory). Three axes stay separate end-to-end:

1. package/integrity state (existing verifier vocabulary)
2. actor identity + authorization state (permanent fixture annotations)
3. business decision lifecycle (this document)

Package-invalid states never enter the lifecycle axis: an unverified chain or
broken binding yields `state: null` with an honest note — never a business
state.

## States

`UNREVIEWED` · `REVIEW_COMPLETED_NO_CHANGE` ·
`REVIEW_COMPLETED_OVERRIDE_PROPOSED` · `OVERRIDE_PENDING_APPROVAL` ·
`OVERRIDDEN` · `APPROVED` · `REJECTED` · `FORKED`

(`REVIEW_REQUESTED` from the discovery state machine is representable in the
vocabulary but unreachable in this increment — the CLI records completed
reviews only. `SUPERSEDED` is a per-node effect: every non-head node is
visibly shadowed by its successors while remaining independently valid.)

## Per-package state and transitions

Each package leaves its target in the state given by its own decision member
(`packageDecisionState`); a successor's decision type must be a permitted
transition out of that state (`transitionError`, closed table
`DECISION_TRANSITIONS`):

- original → review completed (NO_CHANGE or OVERRIDE_PROPOSED)
- proposal → override (→ `OVERRIDE_PENDING_APPROVAL` when its signed policy
  has `approval_required: true`, else directly `OVERRIDDEN`) · rejection of
  the proposal · a new review round
- pending override → approval (activates it → `OVERRIDDEN`) · rejection ·
  a new review round
- `OVERRIDDEN` / `APPROVED` → superseded only by a new review round or a
  rejection (a second direct approval is `DECISION_TRANSITION_UNSUPPORTED`)
- `REJECTED` → only a new review round opens a new branch
- **Approval without a qualifying review fails** unless the approval's own
  signed policy carries the explicit exception `review_required: false` —
  the exception is inside the signed bytes, never inferred.

Unsupported transitions fail closed: at decide time the CLI refuses (exit 3);
at derivation time the offending node has **no lifecycle effect** and is
reported (`DECISION_TRANSITION_UNSUPPORTED`) while the chain remains
displayed.

## Effective disposition

- Starts at the original council recommendation (re-derived from the root
  package's presentation member — never asserted by a decision).
- An effective override moves it to the override's `new_disposition`.
- `APPROVED` (approve-as-is) ratifies the original without changing it.
- `DECISION_REJECTED` reverts to the most recent non-rejected disposition,
  else the original. **The original Council conclusion is never erased.**

## Determinism and honesty rules

- Input is the root→head order derived from **signed links only** —
  `verifyPackageChain`'s order. Import order and timestamps are never used;
  the CLI test suite pins import-order insensitivity.
- Forks: `FORKED`, no effective decision, every branch reported,
  `DECISION_CONFLICT` when branches carry decisions. No tiebreak of any kind.
- Every lifecycle output carries the qualifier `DERIVED_FROM_LOCAL_SET` and
  the note that it says nothing about packages not supplied. No global-latest
  claim exists anywhere.
- Partial-chain caveat: when the supplied root is itself a decision package
  (its own predecessor absent — the `decide` self-check case), its inbound
  transition cannot be re-checked; the node is annotated
  `ROOT_TRANSITION_NOT_RECHECKED_PREDECESSOR_NOT_SUPPLIED` and seeds the
  state. With `requireCompleteChain: true` (the default verify-chain path)
  such chains fail with `PREDECESSOR_NOT_SUPPLIED` instead and no lifecycle
  is derived.
- Separation of duties: a same-actor approval/rejection under a signed
  `separation_of_duties: "enforced"` policy is reported
  (`SEPARATION_OF_DUTIES_VIOLATION`) and has no lifecycle effect. This is a
  structural check against the declared policy — organizational enforcement
  is never claimed, and every decision node carries the annotations
  `ACTOR_IDENTITY_UNVERIFIED`, `DECISION_AUTHORITY_UNVERIFIED`,
  `SEPARATION_OF_DUTIES_NOT_ENFORCED`.
