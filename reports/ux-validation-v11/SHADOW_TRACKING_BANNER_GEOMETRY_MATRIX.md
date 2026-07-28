# Tracking-banner geometry matrix (UX-04)

Bounds are the **real `TextMesh` renderer bounds** of the built workspace, projected with the
analytic pinhole model established by `d7feb01`. `Camera.WorldToScreenPoint` is not used: in
batchmode it projects into the actual window size, not 1600×1000.

`EDITOR_SIMULATION_ONLY` — no physical claim is made about any of these numbers.

## Before → after

| | before | after |
|---|---|---|
| banner local x | 2.9 (world -0.4) | **4.2** (world 0.1) |
| width bound | none | **4.0 world units → 17.89 em** |
| wrapping | none | **deterministic, ≤ 3 lines** |
| anchor / alignment | UpperLeft / left | UpperLeft (unchanged) / left (unchanged) |
| right bound | unbounded — ran past the frame edge | **4.1** (viewport-safe) |

Evidence for the defect: `media/spatial-ux-v11/audit-workspace/tracking-lost__en__AccessibilityHighContrast.png` — TRACKING LOST — switched to session-relative layout; audit state preserved ran past the right frame edge.

## The contract

| name | value |
|---|---|
| `bannerLocalX` | 4.2 |
| `bannerLocalY` | 0.06 |
| `bannerWorldX` | 0.1 |
| `bannerWidth` | 4.0 |
| `bannerEmBudget` | 17.89 |
| `bannerMaxLines` | 3 |
| `bannerTopY` | 2.11 |
| `bannerBottomBound` | 1.135 |
| `bannerMaxHeight` | 0.975 |
| `threeLineHeight` | 0.666 |
| `viewportSafeX` | 4.1 |

Derivation: starts one MinColumnGap right of the header title width; ends at the viewport-safe edge. The banner region is therefore bounded on all four sides, and a
three-line wrap (0.666 world units) still fits the 0.975 available above the columns.

## Committed tracking messages against the budget

Budget per line: **17.89 em**.

| state | EN em | EN authored lines | ZH em | ZH authored lines | wraps? |
|---|---|---|---|---|---|
| `SCANNING` | 43.94 | 3 | 31.24 | 3 | EN+ZH |
| `LIMITED` | 14.72 | 1 | 9.2 | 1 | no |
| `LOST` | 36.5 | 1 | 20.94 | 1 | EN+ZH |
| `RECOVERING` | 16.58 | 1 | 11.24 | 1 | no |

`SCANNING` ships three authored lines and must keep them: `WrapBlock` wraps each authored line
independently and caps the block, so an authored break is never lost and never doubled.

## Matrix asserted

**40 combinations** — 5 profiles × 2 languages × 4 banner-raising states,
plus the 4 non-degraded states asserted to raise **no** banner.

| profiles | `DesktopDark` · `BrowserDark` · `ProjectorPresentation` · `XrealOstBright` · `AccessibilityHighContrast` |
|---|---|
| languages | `en` · `zh-CN` |
| banner states | `SCANNING` · `LIMITED` · `LOST` · `RECOVERING` |
| silent states | `INITIALIZING` · `TRACKED_3DOF` · `TRACKED_6DOF` · `UNKNOWN_STATE` |

Assertions:

- viewport containment + safe margins
- semantic completeness (newline-insensitive) + no ellipsis
- no stranded punctuation at a line start
- no overlap with any other content
- bounded + deterministic wrap
- short tracking header stays distinct
- d664873 colours and d7feb01 geometry unchanged
- non-degraded states raise no banner

**Result: 6/6 banner geometry tests pass.**

## Untouched

| item | state |
|---|---|
| `UX-08` | open — unused capacity not treated as a goal |
| `UX-14` | open — evidence guide internals untouched |
| `UX-02_UX-03` | preserved unchanged from d7feb01 (asserted by a regression test) |
| `UX-01_UX-05_UX-09` | preserved unchanged from d664873 (asserted by a regression test) |

Machine-readable: `shadow-tracking-banner-geometry-matrix.json`.
