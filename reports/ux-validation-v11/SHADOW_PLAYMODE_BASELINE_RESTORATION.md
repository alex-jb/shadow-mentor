# PlayMode baseline restoration (UX-06)

```
SHADOW_PLAYMODE_BASELINE_RESTORED
```

## Before → after

| | before (9958432) | after |
|---|---|---|
| full PlayMode | 95 total · 85 passed · **8 failed** · 2 skipped | **101 total · 99 passed · 0 failed · 2 skipped** |
| run twice, identical | — | **yes** — 101/99/0/2 both runs |
| EditMode | 146 / 146 | **146 / 146** |
| Node | 2057 pass / 0 fail | **2057 pass / 0 fail** |

The 8 known failures are gone; +6 isolation/lifecycle tests were added (95 → 101). The 2 skips are the
env-gated capture harnesses, unchanged.

## The corrections

**Two production fixes** (each an evidence-backed real defect, not a test workaround):

- **FIX A** `ShadowSpatialAgentPanel.ClearCitations` — re-parent each chip out before the deferred
  `Destroy`, so `CitationCount` is 0 in the same frame a profile switch happens. Fixes the three
  cross-profile citation leaks, which is precisely UX-06's recorded impact.
- **FIX B** `ShadowLensMockView.ShowSource` / `ShowAudit` — log the user's top-level action after the
  internal `Analyze()`, so `LastAction` is the user action. Fixes the one `LastAction` failure.

**Four stale test expectations** realigned to already-documented production contracts (`_status` /
`_decision` removed; the coding fixture's final focus action), each citing the production source that
makes the old expectation obsolete. No assertion weakened arbitrarily; nothing skipped or deleted.

## The five prior UX increments are intact

`ShadowWorkspaceGeometryTests` (UX-02/03), `ShadowTrackingBannerGeometryTests` (UX-04),
`ShadowFirstFailureHierarchyTests` (UX-07), `ShadowEvidenceGuideGeometryTests` (UX-14) and
`ShadowAuditWorkspaceLifecycleTests` — **26 / 26** in a targeted run. The Node status-contrast matrix
(d664873) is 13/13. Token schema `/3`, profile colours, column widths, spacing, the evidence-guide y
origin, the tracking-banner contract and the first-failure hierarchy are all unchanged — this fix
touched only the legacy mock view and the spatial-agent panel, not the ShadowAuditWorkspace surface,
whose captures are visually unchanged.
