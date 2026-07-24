# First-failure information hierarchy — implementation (UX-07)

```
SHADOW_FIRST_FAILURE_HIERARCHY_OFFLINE_PASSED = true
SHADOW_FIRST_FAILURE_HIERARCHY_DEVICE_PASSED  = false
```

Committed issue verified before editing: **UX-07 — "First failure is not the visual focus"** (P2,
Audit Workspace, component `type hierarchy`, `PROVEN_IN_EDITOR_CAPTURE` + `PROVEN_IN_CODE`). No other
issue is touched or closed. **UX-12 is not resolved** — see the boundary note below.

## The defect

`◆ FIRST FAILURE` rendered at `T_LABEL 0.030`, while two unrelated titles — `Banking Audit` and the
focused entity title — rendered at `T_TITLE 0.052`. The failure conclusion was the **fourth-largest**
thing on screen, "FIRST FAILURE" appeared four times at four sizes across three regions, and the eye
landed on the story name. Repetition without hierarchy diluted the one signal that matters.

## The contract

Added to `ShadowWorkspaceLayout` (the authority `d7feb01` established, so production and tests read the
same numbers) as named presentation roles: `PrimaryAuditConclusion`, `SecondaryAuditContext`,
`SupportingEvidence`, `SystemContext`. Emphasis is applied **only while the focused entity is the
first failure**, and it is language-independent.

Three independent signals — never colour alone, never motion, never hiding:

| # | signal | value |
|---|---|---|
| 1 | **typography** | conclusion = `ConclusionSize` **0.046**; both titles step down to `ContextTitleSize` **0.040** while a failure is on screen |
| 2 | **accent rule** | a failure-red bar (`ConclusionRuleWidth` 1.05 × `ConclusionRuleHeight` 0.014) under the conclusion — a border/surface signal |
| 3 | **padding** | `ConclusionPadAbove` 0.055 / `ConclusionPadBelow` 0.045 separate it from the field rows |

### Why these numbers

- **0.046** is the largest size at which `◆ FIRST FAILURE` (7.36 em) still fits `CenterWidth`
  without wrapping or truncating: 7.36 × 0.046 × 8.60 = 2.91 ≤ 3.18. It does not touch the column
  geometry `d7feb01` fixed.
- **0.040** for the titles-while-failing is chosen so `Council Decision` (8.62 em) also stops
  wrapping — the centre column gets **shorter**, not taller — and so the conclusion clears the named
  `MinConclusionDominanceRatio` **1.12** against the largest competing label: 0.046 / 0.040 = **1.15**,
  and against a body label 0.046 / 0.026 = **1.77**.

The titles are **not shrunk when there is no failure** — `TitleSizeFor(false)` returns the original
0.052 — so a clean audit is visually unchanged.

## What changed, precisely

- The header title and the focused-entity title now take `TitleSizeFor(focus.IsFirstFailure)`.
- The first-failure line is rendered at `ConclusionSize` with padding above and below and an accent
  rule (`ConclusionRule`, a shared-material quad from the same cache as the evidence-rail quads).
- **Nothing else.** Wording, the `failure_red` colour family, status icons, field order, downstream,
  human-review, approval, source, Trust Strip, tracking header, tracking banner and the disclaimer are
  all untouched. No supporting element is hidden or shrunk below body size.

## Normal / unknown states

`FocusOn` a verified entity, or any calm state (`normal-verified`, `unknown`, `source-missing`
without a computed failure, `scanning`, `recovering`), renders **no** conclusion element and **no**
accent rule, and both titles keep their full 0.052 weight. A test asserts this so the calm state can
never inherit failure emphasis — verified stays distinct from unknown, and source-absence stays
distinct from a confirmed failure.

## UX-12 boundary

The committed UX-07 names only the **Audit Workspace**, and only the Audit Workspace was changed.
`UX-12` (Workspace vs Audit Room Flat colour grammar) is a separate cross-scene issue,
`DEFER_TO_POST_V11`; implementing UX-07 did **not** require touching the Flat surface or its
intact/failure colour model, so nothing here reconciles or closes UX-12.

## Untouched

`d664873` profile colours + token schema `/3`; `d7feb01` column widths / spacing / evidence guide;
`01864b4` tracking-banner contract — all asserted by a regression test. UX-08 and UX-14 remain open.
UX-01/02/03/04/05/09 retain their implemented-offline status, otherwise unmodified.
