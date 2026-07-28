# Evidence-guide internal layout — implementation (UX-14)

```
SHADOW_EVIDENCE_GUIDE_OFFLINE_PASSED = true
SHADOW_EVIDENCE_GUIDE_DEVICE_PASSED  = false
```

Committed issue verified: **UX-14 — "Rail label collides with the rail index"** (P3, Audit Workspace,
component `evidence rail`, `PROVEN_IN_EDITOR_CAPTURE`). No other issue touched or closed.

## The defect (measured, not eyeballed)

The rail stacked four things in ~0.16-unit steps while their line boxes are 0.14–0.25 tall. Real
renderer bounds at baseline:

| element | world-y | overlap |
|---|---|---|
| node quad | `[-2.025, -1.935]` | — |
| `FIRST` / `↓dep` top label (0.022) | `[-1.944, -1.820]` | its **bottom −1.944 is below the node top −1.935** → 0.009 overlap |
| `#3` current index (0.040) | `[-2.365, -2.140]` | 0.248 line box reaches down |
| action legend (0.022) | `[-2.464, -2.340]` | its **top −2.340 is above `#3`'s bottom −2.365** → 0.025 overlap |

So the top label touched its node and the action legend ran under the current index — exactly the
audit's finding.

## The contract

Added to `ShadowWorkspaceLayout` (the authority from `d7feb01`; production and tests read the same
numbers). The vertical stack is **re-derived from the real line boxes** so each row clears the next:

```
topLabel → (its line box + MinRowGap) → node → (half node + MinRowGap) → index → (its line box + MinRowGap) → action
```

| row | local y | world y |
|---|---|---|
| top label (`RailTopLabelY`) | 0.42 | −1.56 |
| node centre (`RailNodeCenterY`) | 0.174 | −1.806 |
| index (`RailSeqY`) | 0.064 | −1.916 |
| action (`RailActionY`) | −0.219 | −2.199 |

The whole stack is lifted into the empty band **above** the rail (the UX-08 space): its top is at
world −1.56 with 0.33 to the centre column's lowest content (−1.228), and the action legend's bottom
is at world −2.336 with 0.185 to the viewport-safe edge (−2.521). **The region origin
(`BottomX`, `BottomY` = −1.98) is unchanged** — only the local layout inside it moved, which the
brief permits.

## Horizontal

`RailStepSpacing` stays **0.62** — the baseline measurement showed the top labels do not collide
horizontally at that pitch, and at the maximum 6 steps the rightmost node reaches world x 0.70, well
inside the ±4.10 safe width. No spacing change was needed.

## What changed, precisely

- The node, index, top-label and action rows now take their y from the contract instead of the inline
  `+0.16 / 0 / −0.16 / −0.36` literals.
- Font sizes, colours, wording, evidence order, sequence numbering, node scales and the step pitch are
  **unchanged**. Nothing was shrunk to force a fit — the fix is pure vertical spacing.

## Evidence semantics preserved

Sequence order `#1..#4` left-to-right, the first-failure step's `FIRST` marker, the downstream
`↓dep` marker, and the node status colours all render exactly as before; a test asserts the numbering
and order. No step was reordered, renumbered, merged or removed; no label was hidden or reduced to an
icon.

## Step counts

The guide adapts to every fixture step count (1, 2, 3, 4, 6), rendering exactly one node and one index
per step, with the max-6 case still inside the viewport and not overlapping any other region.

## Untouched

`d664873` colours + schema `/3`; `d7feb01` columns / spacing / evidence-guide **region** position;
`01864b4` banner; `3c5e9ba` first-failure hierarchy — all asserted by a regression test. UX-08 stays
open (its band was only borrowed for vertical room). UX-01/02/03/04/05/07/09 retain their
implemented-offline status, otherwise unmodified. UX-12 not touched.
