# Audit Workspace — runtime inventory

**Status: COMPLETE — repeated-update / destroy-recreate object counts are now programmatically
asserted (PlayMode). No leak, no per-instance material growth.**

## Asserted counts (`ShadowAuditWorkspaceLifecycleTests`, PlayMode 1/1)
Machine-readable: `media/spatial-ux-v11/audit-workspace/lifecycle-inventory.json`.

| Phase | regions | texts | renderers | quads | uniqueMats |
|---|---|---|---|---|---|
| baseline | 5 | 34 | 38 | 4 | 4 |
| max during 32 update cycles | 5 | 35 | 39 | 4 | **4** |
| back to the same state | 5 | **34** | 38 | 4 | 4 |
| after destroy → recreate | 5 | **34** | 38 | 4 | **4** |

What this proves:
- **Regions never duplicate** — exactly 5 for all 32 cycles.
- **No monotonic growth** — texts vary only 34↔35 with state content and return to exactly 34 for the
  same state; `renderers` bounded; nothing accumulates per update.
- **Material sharing holds** — `uniqueMats` stays **4** across every cycle AND across a destroy/recreate
  (the static `_matCache` is not re-created per Workspace instance).
- **Destroy is clean** — 0 orphan `region.*` objects remain after destroying the root.
- **Recreate == baseline** — a fresh Workspace returns to the identical baseline counts.

The 32 cycles cover: story focus changes, first-failure/downstream, review required/recorded, approval
absent/present, EN↔zh-CN, tracking Scanning/Limited/Lost/Recovering/restored, AuditWorkspace↔Primitive
Diagnostic mode round-trips, and repeated same-state binds. After each cycle deferred Destroy is allowed
to settle (frame progression) before counting — this is a real lifecycle test, not "no exception thrown".

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
