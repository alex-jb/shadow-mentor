# Layout capacity + Trust Strip rhythm — implementation (UX-02 · UX-03)

```
SHADOW_LAYOUT_CAPACITY_OFFLINE_PASSED = true
SHADOW_LAYOUT_CAPACITY_DEVICE_PASSED  = false
```

Scope is the committed issue IDs, not a renumbering:

- **UX-02** — column capacity **and** the long-text cross-column collision. Both are the same
  committed issue ("left→center gap 2.40u (458px) vs 438px content; center→right gap 3.15u (601px) vs
  693px content … three claims overprint each other in the first-failure state").
- **UX-03** — body and Trust Strip vertical rhythm ("body row step 0.12u=22.9px and trust label/value
  step 0.10u=19.1px vs ~30px rendered line box").
- **UX-04** (degraded-tracking banner) — untouched, still clipped, still open.
- **UX-08** (unused frame area) — capacity borrowed where UX-02 needed it; the issue stays open.

## Root cause

The column origins, truncation budgets and row steps were inline literals in `ShadowAuditWorkspace`,
and **nothing related them to the width or the line box of the text they had to hold**. A column could
be narrower than its own longest string and a row step smaller than its own line box, and no test
could notice.

## 1. One production layout definition

New `Workspace/ShadowWorkspaceLayout.cs` — the single source for type scale, column origins and
widths, minimum gaps, derived row steps, truncation budgets and the capture-rig constants. Production
renders from it and the geometry tests assert against it, so a threshold cannot drift from what is
drawn. No second table, no test-only magic number, and the semantic-token schema `/3` from `d664873`
is untouched (this is world-space layout, not a colour token).

## 2. Two factors measured, not estimated

The audit's "≈30 px line box" was an eyeball estimate from a capture. Real `TextMesh` renderer bounds
in PlayMode say:

| quantity | measured | used |
|---|---|---|
| one `0.026` line | 0.1464 world units → **5.63 × charSize** | `LineBoxFactor = 6.20` (margin) |
| two `0.026` lines stacked | 0.3960 world units → the second line advances 0.2496 → **9.60 × charSize** | `MultiLineAdvanceFactor = 9.70` |
| `SOURCE NOT PRESENT` at `0.030` | 2.3040 world units for 8.92 em → **8.61 × em × charSize** | `EmAdvanceFactor = 8.60` |

The multi-line advance is far larger than one line box. Stepping a wrapped block by
`lines × LineHeight` left a 0.004-unit overlap — which the geometry test caught. Block height now uses
the real advance: `LineHeight + (lines−1) × charSize × MultiLineAdvanceFactor`.

## 3. Columns re-apportioned to measured demand (UX-02)

Each width is the measured requirement of the widest string that column must hold:

| column | origin → end | width | drives |
|---|---|---|---|
| left | −4.10 → −1.52 | **2.58** | `resolution: NOT PRESENT` = 11.5 em → 2.571 |
| gap | | **0.30** | `MinColumnGap` |
| centre | −1.22 → 1.96 | **3.18** | `Human review: REQUIRES REVIEW` = 14.2 em → 3.175 |
| gap | | **0.30** | `MinColumnGap` |
| right | 2.26 → 4.10 | **1.84** | `Decision Support` = 8.10 em → 1.812 |

2.58 + 0.30 + 3.18 + 0.30 + 1.84 = **8.20**, exactly the ±4.10 safe width. That is why the left column
moved out into the previously unused left margin — the horizontal counterpart of the capacity recorded
as UX-08. The camera, the viewer distance, the panel plane and the type scale are all unchanged.

## 4. Wrapping instead of truncation (UX-02)

`ShadowLabelMetrics.WrapToWidth(text, maxEm, maxLines)` — deterministic: Latin breaks on spaces and
never inside a word, CJK breaks between glyphs (it has no spaces), a leading space on a fresh line is
dropped, and the last permitted line still gets the usual truncation affordance so a wrap can never
silently grow a column. Applied to the source name, the location line, the focused-entity title and
the next-action hint.

The focused title now **wraps** (`Council` / `Decision`) rather than becoming `Council Deci…`. Nothing
semantic is elided anywhere; a test enforces it.

**The one sanctioned ellipsis** is an operator-supplied evidence identifier
(`evidence.bundle.loan-origination-2026-Q3.income-verification.pdf`) — unbounded by nature, elided by
design, and pinned as the single exception in `NoSemanticLineIsTruncated`.

## 5. Vertical rhythm derived from the line box (UX-03)

| step | before | after |
|---|---|---|
| body row | 0.12 u / 22.9 px | **0.1962 u / 37.4 px** |
| Trust Strip label → value | 0.10 u / 19.1 px | **0.1962 u / 37.4 px** |
| Trust Strip group → group | 0.26 u | **0.4274 u** |

All four label/value pairs are separated by a full line box plus `MinRowGap`, and consecutive groups
by twice that. The strip keeps its region, its order and its semantics. The same derivation was
applied to the top region's own rows, whose 0.30 step could not clear a 0.32 title line box — the same
defect class in the same component. **The banner inside that region was not touched** (UX-04).

## 6. One consequence, handled rather than ignored

A taller centre column reached the evidence rail. The rail moved from y −1.60 to **−1.98** — into the
unused lower band — so the in-scope regions stop colliding with it. The rail's own internal
label/index collision is **UX-14 and is untouched**; the geometry test treats the rail as a boundary
that in-scope content must not cross, and now also asserts the rail itself is still on screen.

## Deferred, untouched

UX-04 tracking banner · UX-06 presenter/spatial-agent-panel PlayMode failures · UX-07 hierarchy ·
UX-08 as a standalone issue · UX-10 `role:` value localisation · UX-11 absence encoding ·
UX-12 Workspace-vs-Flat grammar · UX-13 interaction model · UX-14 rail internals ·
UX-15 capture-harness pollution and PNG non-determinism.
