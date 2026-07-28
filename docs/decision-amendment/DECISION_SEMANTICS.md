# Decision Semantics — Human Review, Override, Approval, Rejection

Status: discovery only. No implementation. Part of the decision-amendment
contract discovery on branch `docs/decision-amendment-contract-discovery`
(base `8fae7e7`).

This document defines the four decision types as distinct semantic events so
that no future contract, CLI, or Web surface can conflate them.

## Invariants preserved throughout

1. **Review is not Approval.** A completed review is evidence that a human
   examined an object. It grants nothing.
2. **Override does not erase the original decision.** The original AI/Council
   output remains immutable, verifiable, and displayed. Override adds a new
   effective disposition alongside it.
3. **Approval is not signature verification.** A package can verify perfectly
   and still be unapproved; an approval can exist inside a package whose later
   copy was tampered.
4. **Valid signature does not prove decision correctness.** Signatures prove
   who signed which bytes, nothing about analytical or business quality.
5. **Rejection is not package invalidity.** A rejected decision lives in a
   perfectly valid, verifiable package.
6. **Package supersession does not invalidate predecessor evidence.** The
   predecessor remains independently verifiable forever; supersession only
   changes which disposition is *effective* in a local chain.

## The four decision types

### 1. HUMAN_REVIEW_COMPLETED

| Question | Answer |
|---|---|
| What event has occurred? | A named human actor finished examining a specific target object (package, Council decision, voice result, or evidence event) and recorded findings. |
| Who is the actor? | The reviewer. In fixture mode, an operator-declared fixture identity; never presented as authenticated personnel. |
| What object is decided on? | Any reviewable target (see DECISION_TARGET_AND_AMENDMENT_CONTENT.md). Most commonly the predecessor package's effective Council decision. |
| Does it alter the original AI/Council output? | **No.** Never. |
| Does it create a new effective decision? | **No.** A review with `outcome: NO_CHANGE` leaves the effective decision untouched. A review with `outcome: OVERRIDE_PROPOSED` proposes — it does not enact. |
| Does it require a reason? | Findings text is required (may be "no findings"); a reason *code* is required only when outcome is OVERRIDE_PROPOSED. |
| Does it require a reviewer role? | Yes: `role: reviewer` (operator-declared in fixture mode). |
| Does it require an approver role? | No. |
| Can the same actor review and approve? | The review itself does not constrain this; the *approval* step enforces (or records non-enforcement of) separation of duties. |
| Separation of duties | Not applicable at review time. |
| Does it close the case? | No. It adds evidence. |
| Can it be superseded? | Yes — a later review or decision successor may supersede it. |
| Which original package/result must it reference? | The predecessor package (ID + manifest SHA-256) and the exact target object (type + ID + hash). |
| Which claims must remain unchanged? | All predecessor claims. Review copies nothing forward and rewrites nothing. |
| What must never be inferred? | That review implies endorsement, approval, or correctness; that absence of findings means absence of defects. |

### 2. DECISION_OVERRIDDEN

| Question | Answer |
|---|---|
| What event has occurred? | An authorized actor replaced the effective disposition of a target decision with a different disposition (e.g. Council `block` → human `approve_with_conditions`). |
| Who is the actor? | The overrider — an actor asserting decision authority over the target. In fixture mode this authority is operator-declared, never verified. |
| What object is decided on? | Exactly one prior effective decision (Council verdict or a prior human decision). |
| Does it alter the original AI/Council output? | **No.** The original output is retained byte-for-byte in the predecessor package. Override creates a *new* effective disposition that shadows, not edits, the original. |
| Does it create a new effective decision? | **Yes** — the defining property of override. |
| Does it require a reason? | **Yes.** Both a closed reason code and bounded signed reason text. An override without a reason is malformed. |
| Does it require a reviewer role? | A completed review referencing the same target is required as predecessor evidence (policy-configurable in fixture mode, but the default state machine requires it — see DECISION_STATE_MACHINE.md). |
| Does it require an approver role? | If the deployment policy demands approved overrides, the override enters `APPROVAL_PENDING` until an approval decision lands. In fixture mode the policy flag is explicit and signed. |
| Can the same actor review and approve? | See APPROVAL_GRANTED. The override actor may be the reviewer; whether the override actor may also approve is a separation-of-duties policy decision. |
| Separation of duties | Recorded, not enforced, in fixture mode (see FIXTURE_DECISION_BOUNDARY.md). |
| Does it close the case? | No. It changes the effective disposition; case closure is a distinct (future) case-level event. |
| Can it be superseded? | Yes. A later override, rejection, or review may supersede it. |
| Which original package/result must it reference? | Predecessor package ID + manifest SHA-256, the target decision's ID + hash, and the prior effective disposition being replaced. |
| Which claims must remain unchanged? | Everything in the predecessor. Only the *effective disposition pointer* moves. |
| What must never be inferred? | That override implies the original was wrong (it may be policy-driven); that an unapproved override is effective when policy requires approval; that override authority existed merely because a signature verifies. |

### 3. APPROVAL_GRANTED

| Question | Answer |
|---|---|
| What event has occurred? | An actor asserting approver authority ratified a specific prior decision object (typically an override proposal or an override, possibly a Council disposition directly where policy permits). |
| Who is the actor? | The approver. Distinct role from reviewer. |
| What object is decided on? | Exactly one prior decision object (by ID + hash), not "the case in general." |
| Does it alter the original AI/Council output? | No. |
| Does it create a new effective decision? | It *activates* a pending one (override moves from proposed/pending to effective) or ratifies an existing disposition. Direct approval of a Council output creates an "approved as-is" disposition without changing content. |
| Does it require a reason? | Reason code required; reason text optional but size-bounded when present. Approval conditions, if any, are part of the signed payload. |
| Does it require a reviewer role? | Approval requires that a qualifying review exists in the chain (default policy). Approval without review is a rejected transition unless the signed policy flag `review_required: false` is present — and that flag is itself visible evidence. |
| Does it require an approver role? | **Yes**: `role: approver`. |
| Can the same actor review and approve? | Only when the signed policy flag `separation_of_duties: not_enforced` is present. When separation is declared enforced, same-actor review+approval is the closed failure `SEPARATION_OF_DUTIES_VIOLATION`. |
| Separation of duties | Declared per-decision in the signed payload; enforced only as validation against the declared policy, never claimed as organizational enforcement in fixture mode. |
| Does it close the case? | No. Adds a decision; case disposition is derived, not asserted. |
| Can it be superseded? | Yes. A later rejection or superseding review can displace an approval in the local chain. |
| Which original package/result must it reference? | Predecessor package ID + manifest SHA-256 + the exact decision object being approved (ID + hash). |
| Which claims must remain unchanged? | The approved object's content. Approval that quotes altered content is `TARGET_OBJECT_MISMATCH`. |
| What must never be inferred? | That approval means regulatory sign-off; that approval verifies actor authority; that approval makes the analytical content correct; that a later valid package cannot supersede it. |

### 4. DECISION_REJECTED

| Question | Answer |
|---|---|
| What event has occurred? | An actor asserting decision authority declined a specific prior decision object (an override proposal, a pending approval, or — where policy permits — the Council disposition itself). |
| Who is the actor? | The rejector (approver-class role by default). |
| What object is decided on? | Exactly one prior decision object (ID + hash). |
| Does it alter the original AI/Council output? | No. |
| Does it create a new effective decision? | It terminates the rejected branch. The effective decision reverts to the most recent non-rejected disposition in the local chain (derivation rule in DECISION_STATE_MACHINE.md). Rejection of the Council disposition itself without an accompanying override proposal leaves the case effective-decision-less at the business layer — an explicit, displayable state, not an error. |
| Does it require a reason? | **Yes.** Closed reason code + bounded signed rejection basis text. |
| Does it require a reviewer role? | No (rejection may occur at any post-review stage; rejecting with no prior review is permitted only against decision objects, not as a bare case action). |
| Does it require an approver role? | Yes by default. |
| Can the same actor review and approve? | Same separation-of-duties treatment as approval. |
| Does it close the case? | No — it closes a *branch*. |
| Can it be superseded? | Yes; a later decision may supersede the rejection (the rejected branch stays rejected; a new branch begins). |
| Which original package/result must it reference? | Predecessor package ID + manifest SHA-256 + rejected object ID + hash. |
| Which claims must remain unchanged? | All. |
| What must never be inferred? | That rejection invalidates the package containing the rejected object; that rejection erases the rejected proposal from history; that rejection implies the rejector had verified authority. |

## Cross-cutting distinctions

- **Package signer vs decision actor.** The fixture key that signs the
  successor package authenticates *package integrity*, not the decision. The
  decision actor is a signed field inside the payload; in fixture mode it is an
  operator assertion. These are never merged into one concept.
- **Evidence vs disposition.** Review produces evidence. Override / Approval /
  Rejection produce dispositions. Both are carried as immutable successor
  packages; only dispositions participate in effective-decision derivation.
- **Local chain, no global registry.** All effective-decision statements are
  derived from the set of packages the verifier actually holds. No contract
  field may claim "this is the latest decision globally."
