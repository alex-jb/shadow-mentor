# PlayMode order / isolation analysis (UX-06)

Every one of the eight failures was run: (1) individually in a fresh Unity process, and (2) as its
fixture class alone in a fresh process. **All eight fail alone**, so none is caused by test ordering,
shared-state contamination between fixtures, or a surviving object from a prior test.

| fixture | in the full suite | run alone |
|---|---|---|
| `ShadowLensPlayModeTests` | 16 total, 4 failed | **16 total, 4 failed** (identical set) |
| `ShadowSpatialAgentPanelPlayModeTests` | 23 total, 4 failed | **23 total, 4 failed** (identical set) |

Because the failures are not order-dependent, the fix is at the source of each defect, not in test
isolation. Nonetheless the new `ShadowPresenterIsolationTests` prove the two production fixes are
order-independent and survive repetition:

- `ClearingCitations_IsVisibleSameFrame_NoCrossProfileLeak` — a banking query's citations are 0 in
  the same frame a switch to data-science happens.
- `RepeatedProfileSwitches_NeverAccumulateCitations` — four banking→coding switches never leave a
  citation behind.
- `ShowSourceFromReady_RecordsShowSourceNotAnalyze` / `ShowAuditFromReady_RecordsShowAuditNotAnalyze`
  — the user's top-level action wins over the internal Analyze.
- `DirectAnalyze_StillRecordsAnalyze` — the fix does not change a directly-invoked Analyze.
- `ExactlyOneBootstrapAndOneMainCamera` — one bootstrap root, one Camera.main after setup (ownership).

Full suite run twice, fresh process each time, capture disabled: **101 / 99 / 0 / 2** both times.
Identical. The 2 skips are the env-gated capture harnesses (`CaptureAuditWorkspace`,
`CaptureReviewMedia`) — not converted from failures.
