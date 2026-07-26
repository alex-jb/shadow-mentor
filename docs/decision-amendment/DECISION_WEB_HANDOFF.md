# Decision Web Handoff

Status: discovery only. Defines how Shadow Web (reference:
`shadow-web-audit-room` @ `d7935bf`, branch
`feat/shadow-web-package-supersession-timeline`) should *eventually* consume
and display decision amendments, and the hard limits on what Web may do
before Core signing exists. **No Web change is part of this or the next Core
increment.**

## Grounding in the existing Web surface (verified at d7935bf)

Web already has, and this design reuses rather than replaces:

- Display-only decision statuses in the presentation contract
  (`src/tokens/tokens.ts` SemanticStatus): `REQUIRES_HUMAN_REVIEW`,
  `HUMAN_REVIEW_RECORDED`, `APPROVAL_NOT_PRESENT`, `APPROVAL_PRESENT` — with
  a11y strings that already pin "a human review was recorded — NOT the same
  as approval" and "explicit human approval (brand/stamp, NEVER verification
  green)".
- Separate `HumanReview { status, reason, reviewer }` and
  `Approval { status }` interfaces and separately rendered sections
  (`src/components/HumanReviewApproval.tsx`).
- Four disjoint closed vocabularies (package failure codes, web verification
  states, chain codes/verdicts/node states, semantic statuses) — the decision
  lifecycle becomes a **fifth disjoint vocabulary**, never merged into any of
  the existing four.
- Chain derivation that is local-only, order-insensitive, recomputed on
  render, and never persisted; forks reported via `CHAIN_FORK` /
  `FORK_BRANCH`, never silently resolved; `LOCALLY OBSERVED HEAD` badge with
  three disclosure strings.
- Effective selection as an *explicit operator action* ("Use in Audit Room"),
  never automatic.
- No-HTML text rendering (React text nodes only, XSS canary e2e), IndexedDB
  package store with immutable member bytes, PEM handling that rejects any
  PRIVATE KEY block outright.

## Eventual display requirements

| Item | Display rule |
|---|---|
| Review request | Timeline node labeled as review request; lifecycle chip `REVIEW_REQUESTED`. No implication that review will change anything. |
| Review completed | Node shows reviewer actor block + findings text (signed, rendered as text). Lifecycle chip `REVIEW_COMPLETED_NO_CHANGE` or `REVIEW_COMPLETED_OVERRIDE_PROPOSED`. Existing `HUMAN_REVIEW_RECORDED` semantic status maps from the former; never from the latter alone. |
| No-change review | Explicit "reviewed, no change" — absence of change is displayed as a positive recorded fact, not as blank. |
| Override proposal | Shown as *proposal*: previous disposition and proposed disposition side by side; effective decision indicator stays on the original. |
| Approved override | Effective-decision indicator moves to the override node; the original stays rendered, marked superseded, never removed or greyed into illegibility. |
| Rejected override | Proposal node marked rejected with signed rejection basis; effective decision indicator reverts per derivation rule. |
| Direct approval | `APPROVAL_PRESENT` semantic status may now be driven by a *signed decision package* instead of only by package-carried presentation data; stamp color rule unchanged (info blue, never verification green). |
| Rejection | Rejection basis text + reason code; branch rendered as closed. |
| Actor identity status | Every actor rendered with identity class verbatim: `DECISION_IDENTITY_DECLARED_NOT_VERIFIED` in fixture mode. No checkmark iconography for declared identity. |
| Authority verification status | `DECISION_AUTHORITY_UNVERIFIED` rendered as its own chip adjacent to the actor, same prominence as the identity chip. |
| Signed decision reason | Rendered as text nodes only, size-bounded upstream by contract; Web must still clamp render length defensively. |
| Referenced evidence | Links resolve only to evidence present in the held package set; missing references render as `REFERENCED_EVIDENCE_MISSING`, never as dead links or silent omission. |
| Selected effective decision | Derived per DECISION_STATE_MACHINE.md, always with the `DERIVED_FROM_LOCAL_SET` qualifier string (parallel to the existing chain disclosures 1–3). |
| Immutable predecessor | Predecessor packages and dispositions permanently visible; supersession never hides history. |
| Decision timeline | Extends the existing supersession TimelineView node model with decision-amendment node types; ordering rules unchanged (signed links only, never import order, never wall clock). |
| Forks / conflicts | Reuse the existing fork rendering posture: all branches rendered, `CONFLICTING_DECISION` chip added, no effective decision derived, no tiebreak. |

## What Web MAY do before Core signing exists

- **Draft locally** — compose a decision intent in memory/IndexedDB, clearly
  labeled `UNSIGNED DRAFT`.
- **Validate form structure** — client-side validation against the published
  decision-amendment schema (structure only; validation success proves
  nothing about authority).
- **Preview decision intent** — render what the decision would look like,
  visually distinct from any signed artifact (no timeline insertion).
- **Export unsigned intent** — emit `decision-intent.json` for the Core CLI
  (workflow Option B, DECISION_WORKFLOW_OPTIONS.md); the export is labeled
  unsigned inside the file itself.
- **Discard draft** — local deletion, no trace requirements (drafts are not
  evidence).

## What Web MUST NOT do

- Mark a draft as approved, reviewed, rejected, or effective — drafts never
  enter lifecycle derivation and never receive lifecycle chips.
- Mutate an imported package (existing invariant, restated: decision
  amendments arrive only as new imported packages).
- Sign anything, including with browser-generated fixture keys — the existing
  "PEM private-key blocks rejected outright" rule stands; WebCrypto signing
  paths remain absent.
- Infer authorization — no heuristic promotion of `AUTHORITY_UNVERIFIED` to
  anything stronger, regardless of actor names or roles.
- Replace historical output — no view may render a superseded disposition as
  if it never existed.
- Resolve conflicting branches silently — conflicts always render as
  conflicts; any "pick one" affordance is out of scope until a re-linearizing
  amendment contract exists, and even then Web only *displays* the signed
  re-linearization, never authors an effective choice.
- Collapse the axes — one badge may never summarize integrity + identity +
  authority + lifecycle. Each axis renders its own token.
