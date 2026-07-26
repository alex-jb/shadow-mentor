# Decision State Machine

Status: discovery only. Machine-readable form: `decision-state-machine.json`
(same directory). The JSON file is the normative artifact; this document is
the rationale.

## Design rule: two orthogonal state axes

The single most important structural decision: **package-integrity states and
decision-lifecycle states are separate axes and never share an enum.**

- **Integrity axis** (already owned by the existing package verifier): whether
  the bytes verify. Example outcomes: verified, invalid signature, manifest
  mismatch, tampering. A decision successor package participates in this axis
  exactly like any other package. Nothing here is new.
- **Identity/authority axis**: whether the decision *actor* is verified and
  whether their *authority* is verified. In fixture mode these are permanently
  `DECLARED_NOT_VERIFIED`. These are annotations, not lifecycle states.
- **Lifecycle axis** (new, this discovery): where a decision target sits in
  the review → override → approval/rejection flow, derived purely from the
  set of valid decision amendments the verifier holds.

A package can therefore be simultaneously: integrity=VERIFIED,
actor_identity=DECLARED_NOT_VERIFIED, lifecycle=APPROVAL_PENDING. Collapsing
these into one badge is forbidden (see DECISION_WEB_HANDOFF.md).

The states `DECISION_IDENTITY_UNVERIFIED`, `DECISION_AUTHORITY_UNVERIFIED`
and `DECISION_PACKAGE_INVALID` proposed in the task brief are therefore
**rejected as lifecycle states** and adopted as axis annotations:

- `DECISION_PACKAGE_INVALID` → integrity axis (existing verifier vocabulary).
  An invalid decision package contributes **nothing** to the lifecycle; the
  lifecycle is computed as if it does not exist, and the invalid package is
  listed separately.
- `DECISION_IDENTITY_UNVERIFIED` / `DECISION_AUTHORITY_UNVERIFIED` →
  per-decision annotations displayed alongside whatever lifecycle state the
  chain reaches.

## Lifecycle states (closed set)

Scope: states apply to a **decision target** (normally one effective Council
decision within one case), derived per-target from the local package set.

| State | Meaning |
|---|---|
| `UNREVIEWED` | No valid decision amendment references the target. Initial state. |
| `REVIEW_REQUESTED` | A valid review-request amendment exists (optional state — a chain may begin directly with a completed review). |
| `REVIEW_COMPLETED_NO_CHANGE` | A completed review with outcome NO_CHANGE is the newest disposition-relevant amendment. Effective decision: unchanged original. |
| `REVIEW_COMPLETED_OVERRIDE_PROPOSED` | A completed review proposes an override. Effective decision: still the original. |
| `OVERRIDE_PENDING_APPROVAL` | An override amendment exists whose signed policy requires approval, and no approval/rejection for it exists. Effective decision: still the original. |
| `OVERRIDDEN` | An override is effective (either its policy did not require approval, or it has been approved). Effective decision: the override disposition. |
| `APPROVED` | A direct approval of the original disposition (approve-as-is) is the newest effective amendment. Effective decision: original, ratified. |
| `REJECTED` | The newest decision on the active branch is a rejection. Effective decision: reverts to most recent non-rejected disposition; if none, the original Council disposition with a visible `HUMAN_DECISION_ABSENT` note. |
| `SUPERSEDED` | This target's amendment has itself been superseded by a newer valid amendment in the local chain. Terminal for the superseded node, not for the target. |
| `FORKED` | Two or more valid amendments reference the same predecessor without referencing each other. Not an error state — a display state. No silent resolution permitted. |

Rejected candidate states and why:

- `APPROVAL_PENDING` as a bare state → renamed `OVERRIDE_PENDING_APPROVAL` to
  make the pending object explicit; "approval pending" with no object invited
  case-level misreading.
- A distinct `ESCALATED` lifecycle state → the existing Council verdict
  vocabulary already contains `escalate` as a *disposition value*; escalation
  is an input to review, not a review state.

## Permitted transitions

```
UNREVIEWED                          → REVIEW_REQUESTED
UNREVIEWED                          → REVIEW_COMPLETED_NO_CHANGE
UNREVIEWED                          → REVIEW_COMPLETED_OVERRIDE_PROPOSED
REVIEW_REQUESTED                    → REVIEW_COMPLETED_NO_CHANGE
REVIEW_REQUESTED                    → REVIEW_COMPLETED_OVERRIDE_PROPOSED
REVIEW_COMPLETED_NO_CHANGE          → REVIEW_REQUESTED            (new review round)
REVIEW_COMPLETED_NO_CHANGE          → APPROVED                    (approve-as-is, review exists)
REVIEW_COMPLETED_OVERRIDE_PROPOSED  → OVERRIDE_PENDING_APPROVAL   (override filed, policy requires approval)
REVIEW_COMPLETED_OVERRIDE_PROPOSED  → OVERRIDDEN                  (override filed, signed policy: approval not required)
REVIEW_COMPLETED_OVERRIDE_PROPOSED  → REJECTED                    (proposal rejected)
OVERRIDE_PENDING_APPROVAL           → OVERRIDDEN                  (approval granted for the override)
OVERRIDE_PENDING_APPROVAL           → REJECTED                    (approval declined)
OVERRIDDEN                          → REVIEW_REQUESTED            (later review of the override)
OVERRIDDEN                          → REJECTED                    (later rejection supersedes the override)
APPROVED                            → REVIEW_REQUESTED            (later review supersedes the approval)
APPROVED                            → REJECTED                    (rejection after approval — permitted, supersedes)
REJECTED                            → REVIEW_REQUESTED            (new branch begins)
REJECTED                            → REVIEW_COMPLETED_OVERRIDE_PROPOSED (new proposal on new branch)
any state                           → FORKED                      (second valid amendment with same predecessor observed)
FORKED                              → (no automatic exit; a new amendment that explicitly references both fork heads as predecessors re-linearizes)
```

## Rejected transitions (closed failures, see DECISION_FAILURE_VOCABULARY.md)

| Attempt | Failure token |
|---|---|
| Approval when no qualifying review exists and signed policy has `review_required: true` (default) | `UNSUPPORTED_TRANSITION` |
| Override with no reason code/text | `REASON_MISSING` |
| Approval/rejection targeting an object that has no amendment chain entry | `MISSING_DECISION_TARGET` |
| Second decision with identical decision ID | `DUPLICATE_DECISION` |
| Amendment whose predecessor package hash does not match a held package | `TARGET_PACKAGE_MISMATCH` (displayed; excluded from lifecycle derivation) |
| Amendment referencing a different case's target | `CASE_MISMATCH` |

## Answers to the required questions

- **Can Approval occur without Human Review?** Only when the amendment's
  signed policy flags `review_required: false`. Default policy: no. The flag
  is itself signed evidence, so a lax policy is visible, never silent.
- **Can Rejection occur after Approval?** Yes — as a superseding amendment.
  The approval remains in history; the rejection becomes the newest node.
- **Can an Override be approved or rejected separately?** Yes. The override
  and its approval/rejection are separate amendments with separate actors,
  linked by target object ID + hash.
- **Can a later review supersede an earlier approval?** Yes. A new review
  round moves the target back to `REVIEW_REQUESTED`/completed states; the
  approval stays visible as a superseded node.
- **How are forks represented?** As `FORKED`: both heads displayed, neither
  chosen, with the derivation rule refusing to pick an effective decision
  until a re-linearizing amendment (referencing both heads) exists. Web must
  render both branches (DECISION_WEB_HANDOFF.md).
- **How are conflicting approvals represented?** A special case of `FORKED`
  plus the annotation `CONFLICTING_DECISION`. No timestamp-based tiebreak:
  fixture timestamps are operator-supplied and prove nothing.
- **Missing required predecessor?** The amendment verifies (integrity axis)
  but is lifecycle-excluded with `REFERENCED_EVIDENCE_MISSING` /
  `TARGET_PACKAGE_MISMATCH`; Web shows it as an orphan node, never spliced in.
- **Valid package, unknown actor authorization?** Lifecycle proceeds
  normally; every derived state carries the annotation
  `DECISION_AUTHORITY_UNVERIFIED`. Authority never gates integrity or
  lifecycle math in fixture mode — it gates *presentation and claims*.

## Effective-decision derivation (local, deterministic)

Given the set of *integrity-valid* decision amendments held locally for one
target:

1. Exclude amendments with binding failures (wrong case, wrong target hash,
   missing predecessor).
2. Build the predecessor graph by (predecessor package ID, predecessor
   manifest SHA-256, prior decision ID).
3. If the graph has >1 head: state `FORKED`; no effective decision is derived;
   both heads are reported.
4. Otherwise walk to the single head; the newest disposition-bearing node
   (override approved / approval / rejection / no-change review) determines
   the state per the table above.
5. Output is always qualified: "derived from N packages held locally" — never
   a global-latest claim.

Determinism requirement: same package set in, same state out, independent of
import order, wall-clock, and locale.
