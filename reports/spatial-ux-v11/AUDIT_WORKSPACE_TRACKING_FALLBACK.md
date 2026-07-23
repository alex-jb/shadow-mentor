# Audit Workspace — tracking fallback

Seven explicit states: INITIALIZING · SCANNING · TRACKED_3DOF · TRACKED_6DOF · LIMITED · LOST ·
RECOVERING. SCANNING is user-visible and distinct from LIMITED.

Exact SCANNING copy (`ShadowTrackingBanner`):
```
SCANNING FOR POSITION
Hold still and slowly look around.
Core 3DoF review remains available.
```
```
正在扫描空间位置
请保持稳定并缓慢环视。
核心 3DoF 审查仍可继续。
```

On degraded tracking (`LOST`/`LIMITED`/`RECOVERING`), `ApplyDegraded` changes only the tracking field
and switches to a safe session-relative layout, **preserving** story step, current focus, selection,
language, verification, and review/approval state. Recenter and Open 2D Audit stay reachable; the
story is never reset and stale voice is never replayed.

Tests: `Tracking_Scanning_DistinctFromLimited_And_DegradedPreservesState` (EditMode, pass). The
workspace reads the real tracking value (`ShadowAuditWorkspace.Tracking`); wiring it to a live
tracking-health provider (not only a debug field) is the next integration step — recorded in
AUDIT_WORKSPACE_REMAINING_GAPS.md.
