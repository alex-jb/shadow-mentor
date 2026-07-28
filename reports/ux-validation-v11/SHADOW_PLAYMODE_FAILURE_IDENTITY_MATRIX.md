# PlayMode failure identity matrix (UX-06)

All eight reproduced in isolation (fail alone), so none is order/contamination.

| test | fixture | root cause | expected | observed | correction |
|---|---|---|---|---|---|
| `AnalyzeCausesVisibleStateChange` | ShadowLens | **STALE_TEST_EXPECTATION** | a top STATUS Text object changes | NullReferenceException — FindText("STATUS") is null | assert the observable state transition Ready→Analyzed (no removed STAT |
| `DecisionPanelPopulatesInView` | ShadowLens | **STALE_TEST_EXPECTATION** | a DECISION Text object populates | FindText("DECISION") is null | assert Analyzed then ShowSource surfaces the populated FindingText |
| `Reset_ReturnsToReadyAndUnsigned` | ShadowLens | **STALE_TEST_EXPECTATION** | STATUS Text contains READY TO ANALYZE | NullReferenceException — FindText("STATUS") is null | drop the removed STATUS assertion; keep State==Ready and TRUST==UNSIGN |
| `ShowSource_CreatesVisibleOverlay` | ShadowLens | **PRODUCTION_DEFECT** | LastAction == SHOW_SOURCE | LastAction == ANALYZE | FIX B: run the internal Analyze FIRST, then LogAction the top-level us |
| `BankingThenDataScience_NoStaleCrossProfileState` | ShadowSpatialAgentPanel | **PRODUCTION_DEFECT** | CitationCount == 0 after a profile switch | CitationCount == 1 | FIX A: re-parent each chip out (SetParent(null)) BEFORE the deferred D |
| `DataScienceThenCoding_SwitchesCleanly` | ShadowSpatialAgentPanel | **PRODUCTION_DEFECT** | CitationCount == 0 and FocusText == '' | CitationCount == 1 | FIX A |
| `PresenterReset_FromAnyProfile_ReturnsToBankingReady` | ShadowSpatialAgentPanel | **PRODUCTION_DEFECT** | CitationCount == 0 after reset | CitationCount == 1 | FIX A |
| `Coding_DiffFocusVisible` | ShadowSpatialAgentPanel | **STALE_TEST_EXPECTATION** | FocusText contains diff1 | FocusText == 'HIGHLIGHT: cmd_test' | assert FocusText reflects this query's final coding evidence action (c |

## Evidence per failure

### `AnalyzeCausesVisibleStateChange`

- root cause: **STALE_TEST_EXPECTATION** (confidence high)
- isolation: fails alone; order-sensitive: False
- evidence: ShadowLensMockView.cs:95 `_status = null; // no top status label — the spatial-agent panel owns the single status row`

### `DecisionPanelPopulatesInView`

- root cause: **STALE_TEST_EXPECTATION** (confidence high)
- isolation: fails alone; order-sensitive: False
- evidence: ShadowLensMockView.cs:98 `_decision = null; // the FINDING now renders inside the document footer`; the FindingText lives in the SourceOverlay group (inactive until ShowSource)

### `Reset_ReturnsToReadyAndUnsigned`

- root cause: **STALE_TEST_EXPECTATION** (confidence high)
- isolation: fails alone; order-sensitive: False
- evidence: ShadowLensMockView.cs:95 `_status = null`; the Ready+UNSIGNED(_trust) contract is intact

### `ShowSource_CreatesVisibleOverlay`

- root cause: **PRODUCTION_DEFECT** (confidence high)
- isolation: fails alone; order-sensitive: False
- evidence: ShowSource() called LogAction("SHOW_SOURCE") then `if (State==Ready) Analyze()` — Analyze's LogAction("ANALYZE") overwrote it

### `BankingThenDataScience_NoStaleCrossProfileState`

- root cause: **PRODUCTION_DEFECT** (confidence high)
- isolation: fails alone; order-sensitive: False
- evidence: ClearCitations used plain Destroy(); childCount (=CitationCount) stayed 1 until end-of-frame, so a same-frame read after SetProfile saw stale citations — exactly UX-06's recorded impact

### `DataScienceThenCoding_SwitchesCleanly`

- root cause: **PRODUCTION_DEFECT** (confidence high)
- isolation: fails alone; order-sensitive: False
- evidence: same ClearCitations deferred-Destroy defect

### `PresenterReset_FromAnyProfile_ReturnsToBankingReady`

- root cause: **PRODUCTION_DEFECT** (confidence high)
- isolation: fails alone; order-sensitive: False
- evidence: PresenterReset→SetProfile→ClearTransient→ClearCitations, same deferred-Destroy defect

### `Coding_DiffFocusVisible`

- root cause: **STALE_TEST_EXPECTATION** (confidence high)
- isolation: fails alone; order-sensitive: False
- evidence: ShadowSpatialDemoFixtures.cs:55 emits Act(focus_object,object_id,diff1) THEN Act(highlight_source,source_id,cmd_test); the single focus line shows the LATEST spatial action, so it ends on cmd_test
