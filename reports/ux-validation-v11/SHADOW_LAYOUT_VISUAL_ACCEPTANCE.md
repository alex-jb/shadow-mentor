# Visual acceptance — layout capacity + Trust Strip rhythm (UX-02 · UX-03)

Every artifact:

```
EDITOR_SIMULATION_ONLY
NOT_BEAM_PRO_EVIDENCE
NOT_OST_PHYSICAL_EVIDENCE
NOT_PHYSICAL_XR_VALIDATION
```

Captures regenerated with the existing harness in a **separate Unity process** from the full PlayMode
suite, so its known session pollution could not contaminate the regression result. Byte-identical PNG
output was not required and is not achievable: the dynamic OS font atlas makes this harness's output
non-byte-deterministic, so acceptance is the deterministic geometry tests plus human review.

## Human review

| check | result |
|---|---|
| source ↔ verification text collision | **gone** — clear separation in every reviewed profile |
| `LOCATION NOT AVAILABLE` × `Verification: FIRST FAILURE` | **gone** — the location line wraps inside its own column |
| Trust Strip label/value overlap | **gone** — all four pairs cleanly separated, consistent rhythm |
| body-line overlap | **gone** in every in-scope region |
| new truncation of core semantic text | **none** — `Banking Audit`, `resolution: NOT PRESENT`, `Human review: REQUIRES REVIEW` and `Decision Support` are all full where they were previously elided |
| status-colour regression | **none** — the `d664873` profile palettes render unchanged |
| disclaimer regression | **none** — wording, placement and colour untouched |
| new edge clipping | **none** — asserted for every in-scope region *and* for the rail that this increment moved |
| English and Chinese readable | **yes** — Chinese shows no overlap and no truncation |
| all five profiles structurally valid | **yes** — asserted across the full matrix |

## Two defects this review caught that the tests initially did not

Recorded because they show where the tests were blind, and both were fixed:

1. **A truncated story title and over-truncated left column.** Overlap tests pass happily on truncated
   text. `NoSemanticLineIsTruncated` was added and the column widths were re-apportioned to the
   measured demand of their widest strings.
2. **The rail pushed off the bottom edge.** The viewport assertion excluded `region.bottom`, so a rail
   moved below y=0 still passed. The rail is now included in the clipping assertion.

## Deliberately still visible

The `role: decision` value stays English in the Chinese capture — that is **UX-10**, untouched. The
degraded-tracking banner still runs past the right edge — **UX-04**, untouched. The rail's own
label/index collision remains — **UX-14**, untouched. Considerable frame area is still unused —
**UX-08**, only partially borrowed and still open.

## Not claimed

No physical optical readability, no field-of-view occupation, no viewing comfort, no head-movement
burden, no waveguide colour appearance, no controller interaction. `SHADOW_LAYOUT_CAPACITY_DEVICE_PASSED`
remains **false**.
