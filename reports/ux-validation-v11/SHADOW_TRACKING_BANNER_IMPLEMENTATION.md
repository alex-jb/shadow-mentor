# Degraded-tracking banner viewport safety — implementation (UX-04)

```
SHADOW_TRACKING_BANNER_OFFLINE_PASSED = true
SHADOW_TRACKING_BANNER_DEVICE_PASSED  = false
```

Scope is the committed issue: **UX-04 — "The degraded-tracking banner is clipped mid-sentence"**
(P1, Audit Workspace, `degraded tracking banner`, `PROVEN_IN_EDITOR_CAPTURE` via
`tracking-lost__en__AccessibilityHighContrast.png`, disposition `SAFE_V11_UX_MAINTENANCE`).
No other issue is touched or closed.

## The defect

The banner was placed at `top` + local x **2.90** with `UpperLeft` anchoring, **no width bound and no
wrapping**. `TRACKING LOST — switched to session-relative layout; audit state preserved` measures
**36.5 em ≈ 8.16 world units**; from its origin it ran straight past the right frame edge and the
explanation of a degraded spatial mode was cut mid-sentence — exactly when a user needs it.

It also shared its row with the story title with no horizontal separation rule, so a long title and
the banner could occupy the same x.

## The contract

Added to `ShadowWorkspaceLayout` — the authority `d7feb01` established, so production and tests read
the same numbers:

| name | value | meaning |
|---|---|---|
| `BannerLocalX` | `TopWidth + MinColumnGap` = **4.20** | starts one gap right of the header title's own width, so title and banner can never share x |
| `BannerLocalY` | **0.06** | lifts the block so the tallest wrap still clears the column tops |
| `BannerWidth` | `ViewportSafeX − BannerWorldX` = **4.00** | ends exactly at the viewport-safe edge |
| `BannerEm` | **17.89 em** | the per-line budget derived from that width |
| `BannerMaxLines` | **3** | `SCANNING` already ships three authored lines |
| `BannerBottomBound` | `ColumnY + MinRowGap` = **1.135** | the banner may not reach the columns |
| `BannerMaxHeight` | **0.975** | a three-line block is 0.666 — it fits with room |

**Anchor and alignment are unchanged (`UpperLeft`, left).** The audit offered "truncate … or
right-anchor it"; a bounded width plus wrapping removes the clipping without inverting the reading
rhythm — every other label in this workspace is left-aligned — and without deleting any words.

## Wrapping, not truncation

`ShadowLabelMetrics.WrapBlock(text, maxEm, maxLines)` is new and additive: it wraps **each authored
line independently** and caps the block. `WrapToWidth`'s own contract from `d7feb01` is untouched.

This matters because the `SCANNING` copy ships three authored lines
(`SCANNING FOR POSITION` / `Hold still and slowly look around.` / `Core 3DoF review remains
available.`). Wrapping the whole string naively would have lost or doubled those breaks.

| state | EN | ZH | result |
|---|---|---|---|
| `SCANNING` | 43.94 em over 3 authored lines | 31.24 em over 3 authored lines | authored breaks preserved, no re-wrap |
| `LOST` | 36.50 em, 1 line | 20.94 em, 1 line | wraps to 3 / 2 lines |
| `LIMITED` | 14.72 em | 9.20 em | fits on one line |
| `RECOVERING` | 16.58 em | 11.24 em | fits on one line |

**No truncation anywhere.** Wording, font size, colour family (`warning_amber` through the profile),
and Chinese terminology are all unchanged. A test asserts that the rendered text with line breaks
removed equals the committed copy exactly — Chinese has no spaces, so a legitimate wrap lands
mid-phrase and completeness must be judged newline-insensitively.

A further rule from the brief is enforced: **no line may begin with closing punctuation** stranded by
the wrap.

## The distinction that was preserved

The short **tracking header** (`tracking: lost`) and the explanatory **degradation banner** remain two
separate elements. The banner was **not** routed back into the status-glyph table, and a test asserts
the two never overlap and that the header wording is unchanged.

## Untouched

`d664873` profile-aware colours and token schema `/3`; `d7feb01` column widths (2.58 / 3.18 / 1.84),
gaps (0.30), body and Trust Strip spacing (0.1962), evidence-guide y (−1.98) — all asserted by a
regression test in the new suite. UX-08 and UX-14 remain open. UX-01/02/03/05/06/07/09/10–15 are
untouched.
