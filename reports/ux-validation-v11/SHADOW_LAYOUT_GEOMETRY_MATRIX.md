# Layout geometry matrix (UX-02 · UX-03)

Bounds are the **real `TextMesh` renderer bounds** of the built workspace, projected through the
capture rig with an analytic pinhole projection. `Camera.WorldToScreenPoint` was not used: in
batchmode it projects into the actual window size, not 1600×1000, which shrinks every rectangle
about 2.5× and would have made the tests pass on false numbers.

`EDITOR_GEOMETRY_ESTIMATE` — the rig is not a headset field of view. The repository asserts none.

## Measured factors (not estimated)

| factor | measured | used | evidence |
|---|---|---|---|
| `lineBoxFactor` | 5.63 | 6.2 | one 0.026 line = 0.1464 world units |
| `multiLineAdvanceFactor` | 9.6 | 9.7 | two 0.026 lines = 0.3960 world units; the second line advances 0.2496 |
| `emAdvanceFactor` | — | 8.6 | SOURCE NOT PRESENT = 8.92 em at 0.030 -> 2.3040 world units measured |

## Before → after

| quantity | before | after |
|---|---|---|
| left → centre gap | 2.4 u (458 px) vs 438 px of content | **0.3 u** with the column sized to its widest string |
| centre → right gap | 3.15 u (601 px) vs 693 px of content | **0.3 u** with the column sized to its widest string |
| body row step | 0.12 u (22.9 px) vs a ~30 px line box | **0.1962 u (37.4 px)** |
| Trust Strip label → value | 0.1 u (19.1 px) | **0.1962 u (37.4 px)** |
| Trust Strip group → group | 0.26 u | **0.4274 u** |
| evidence rail y | -1.6 | **-1.98** (moved clear; its own UX-14 defect untouched) |

## Column budget

| column | origin | width | end | px | body em budget |
|---|---|---|---|---|---|
| `left` | -4.1 | **2.58** | -1.52 | 492.3 | 11.54 |
| `center` | -1.22 | **3.18** | 1.96 | 606.7 | 14.22 |
| `right` | 2.26 | **1.84** | 4.1 | 351.1 | 8.23 |
| `top` | -4.1 | **3.9** | -0.2 | 744.1 | 17.44 |

Left + gap + centre + gap + right = 2.58 + 0.30 + 3.18 + 0.30 + 1.84 = **8.20**, exactly the
±4.1 safe width. Right column ends at 4.1.

## Matrix actually asserted

**90 combinations** — 5 profiles × 2 languages × 9 states.

| profiles | `DesktopDark` · `BrowserDark` · `ProjectorPresentation` · `XrealOstBright` · `AccessibilityHighContrast` |
|---|---|
| languages | `en` · `zh-CN` |
| states | `source-present-normal` · `source-missing` · `location-unavailable` · `first-failure` · `source-missing+first-failure` · `human-review-required` · `approval-absent` · `trust-strip-populated` · `longest-source` |

Assertions per combination:

- cross-column overlap
- left/centre gap
- Trust Strip pair overlap
- intra-region line overlap
- viewport containment (incl. the rail)
- unintended truncation
- semantic + colour stability

**Result: 7/7 geometry tests pass.**

## Out of scope, and proven so

| item | state |
|---|---|
| `UX-04_tracking_banner` | untouched — still clipped, still open |
| `UX-14_rail_internal_collision` | untouched — the rail was only moved down so the taller centre column could not reach it |
| `UX-08_unused_space` | partially borrowed (left margin, lower band) — remains open as an issue |

Machine-readable: `shadow-layout-geometry-matrix.json`.
