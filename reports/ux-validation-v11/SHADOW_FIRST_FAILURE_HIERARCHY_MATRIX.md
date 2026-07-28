# First-failure hierarchy matrix (UX-07)

The hierarchy metric is the primary conclusion's rendered character size divided by the largest
competing label's size, plus the presence of the accent rule and padding signals. It proves the
**design contract is applied** — not that the result is aesthetically good or salient through a
waveguide; that needs the device.

Measurements are real `TextMesh` character sizes and renderer bounds projected with the deterministic
analytic model from `d7feb01` / `01864b4` (never `Camera.WorldToScreenPoint`).

`EDITOR_SIMULATION_ONLY` — no physical claim.

## Roles

- `PrimaryAuditConclusion`
- `SecondaryAuditContext`
- `SupportingEvidence`
- `SystemContext`

## Signals (≥ 2, never colour alone)

| signal | value |
|---|---|
| **typography** | conclusion is the single largest label; both titles step down to ContextTitleSize while a failure is on screen |
| **accentRule** | a failure-red bar under the conclusion (border/surface, not colour alone) |
| **padding** | ConclusionPadAbove/Below separate it from the field rows |

## Before → after

| | before | after |
|---|---|---|
| `◆ FIRST FAILURE` size | 0.03 (4th-largest) | **0.046** (largest) |
| title size while failing | 0.052 | **0.04** (steps down) |
| title size, no failure | 0.052 | **0.052** (unchanged) |
| conclusion / largest competitor | 0.030 / 0.052 = 0.58 | **1.15** (≥ 1.12) |
| conclusion / body label | 0.030 / 0.026 = 1.15 | **1.769** |
| accent rule | none | **1.05 × 0.014** failure-red |
| padding above / below | none | **0.055 / 0.045** |

The dominance ratio is measured against the largest *competing* label. Because the titles step down
to 0.040 only while a failure is on screen, the conclusion at 0.046 is unambiguously the primary
element in every failure state, and the calm state is left at the original 0.052.

## Matrix asserted

**110 combinations** — 5 profiles × 2 languages × (6 failure + 5 calm) states.

| profiles | `DesktopDark` · `BrowserDark` · `ProjectorPresentation` · `XrealOstBright` · `AccessibilityHighContrast` |
|---|---|
| languages | `en` · `zh-CN` |
| failure states | `first-failure` · `first-failure+downstream` · `first-failure+human-review` · `first-failure+approval-absent` · `first-failure+source-missing` · `first-failure+tracking-degraded` |
| calm states | `normal-verified` · `unknown` · `source-missing-no-failure` · `scanning` · `recovering` |

Assertions:

- first-failure state applies the primary role (size + rule)
- calm states apply NO failure emphasis and keep both titles at full size
- conclusion uses >= 2 non-colour signals and clears the dominance ratio
- supporting context stays visible and subordinate; nothing hidden
- conclusion stays in region, no wrap/truncation/overlap/clipping
- hierarchy survives colour removal; d664873/d7feb01/01864b4 invariants unchanged; Chinese carries the same roles

**Result: 6/6 hierarchy tests pass.**

## Out of scope

| item | state |
|---|---|
| `UX-12` | NOT resolved — only the Audit Workspace changed; Room Flat colour grammar untouched |
| `UX-08` | open |
| `UX-14` | open |
| `UX-01_UX-05_UX-09` | preserved from d664873 |
| `UX-02_UX-03` | preserved from d7feb01 |
| `UX-04` | preserved from 01864b4 |

Machine-readable: `shadow-first-failure-hierarchy-matrix.json`.
