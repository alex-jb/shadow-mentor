# Audit Workspace — runtime inventory

**Status: partial — code-level guarantees verified; a fully instrumented object-count dump is a
follow-up.**

## Verified this increment
- **Material sharing** — `ShadowAuditWorkspace` uses a single static `_matCache` keyed by colour hex;
  quads call `SharedMat(hex)` → no per-card material instantiation. `TextMesh` labels share the CJK
  font's material. This is a code guarantee, not a per-frame allocation.
- **Per-region incremental rebuild** — `Region(key)` reuses the region GameObject and clears its
  children before repopulating, rather than recreating the whole workspace. Regions are keyed
  (top/left/center/right/bottom) so a rebuild does not spawn duplicate roots.
- **Repeated updates without failure** — the capture harness calls `BindDirect` / `FocusOn` /
  `SetZh` / `SetTracking` 32 times in one PlayMode run (14 states × profiles/langs) with no crash and
  no growth in captured file behaviour; two full runs (before + after the label fixes) both completed
  1/1.

## Not yet captured (honest gap)
A fully instrumented count (total GameObjects, active, Renderers, unique vs shared materials, text
objects, backplates, transparent renderers, rail nodes, estimated draw-call-relevant renderers) is
NOT dumped in this increment — it needs a harness instrumentation pass that walks the workspace
hierarchy and logs counts after N repeated updates. The material-sharing + region-reuse code paths
are in place; asserting the counts programmatically (no duplicate Source Card / Trust Strip / banner /
rail after repeated updates; no material-instance growth) is the next step.

## Not claimed
- WORKSPACE-REPEATED-UPDATE-CLEANUP-PASSED → **not asserted** (code paths present; not yet
  count-verified). Kept honest as pending.
- No device-performance claim.
