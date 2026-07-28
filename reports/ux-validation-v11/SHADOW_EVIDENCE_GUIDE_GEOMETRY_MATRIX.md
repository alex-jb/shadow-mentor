# Evidence-guide geometry matrix (UX-14)

Bounds are real `TextMesh` + node-quad renderer bounds projected with the deterministic analytic
model from `d7feb01` / `01864b4` (never `Camera.WorldToScreenPoint`). `EDITOR_SIMULATION_ONLY`.

## Before → after (world y)

| row | before | after |
|---|---|---|
| top label | 0.16 | **0.42** (world -1.56) |
| node centre | 0.0 | **0.1736** |
| index | -0.16 | **0.0636** |
| action | -0.36 | **-0.2194** (world bottom -2.336) |

Region origin unchanged at y = **−1.98**; only the local stack moved. Action bottom -2.336 clears the viewport edge (-2.521); top -1.56 clears the centre column (-1.228).

## Baseline collisions fixed

- FIRST/dep top label (world bottom -1.944) overlapped its node (world top -1.935) by 0.009
- action legend (world top -2.340) ran under the current #n index (world bottom -2.365) by 0.025
- current #n at 0.040 had a 0.248 line box reaching down into the action row

## Vertical derivation

each row is separated from the next by its own line box + MinRowGap: topLabel -> (box+gap) -> node -> (halfNode+gap) -> seq -> (box+gap) -> action

## Horizontal

Step pitch {a['stepSpacing']} (unchanged). At the max {d['horizontal']['maxSteps']} steps the rightmost node is at world x 0.7, inside the ±4.1 safe width → fits = True.

## Matrix asserted

**90 combinations** — 5 profiles × 2 languages × 9 states, covering step counts [1, 2, 3, 4, 6].

| profiles | `DesktopDark` · `BrowserDark` · `ProjectorPresentation` · `XrealOstBright` · `AccessibilityHighContrast` |
|---|---|
| languages | `en` · `zh-CN` |
| states | `normal-4` · `first-failure-mid` · `first-failure-first` · `first-failure-last` · `source-missing-no-failure` · `one-step` · `two-step` · `three-step` · `max-steps` |

Assertions:

- guide stays in the viewport
- no two guide elements overlap (node/index/top-label/action)
- each index and top label is closest to its own node; order preserved
- every step count renders one node + one index per step
- guide does not overlap any other region
- evidence numbering/order + prior d664873/d7feb01/01864b4/3c5e9ba contracts unchanged

**Result: 6/6 guide geometry tests pass.**

## Out of scope

| item | state |
|---|---|
| `UX-08` | the band above the rail was borrowed for vertical room; the issue stays open |
| `UX-07` | preserved from 3c5e9ba |
| `UX-02_UX-03` | preserved from d7feb01 |
| `UX-04` | preserved from 01864b4 |
| `UX-01_UX-05_UX-09` | preserved from d664873 |
| `UX-12` | not touched |
| `UX-06_UX-15` | not touched |

Machine-readable: `shadow-evidence-guide-geometry-matrix.json`.
