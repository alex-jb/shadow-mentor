# PlayMode baseline — root-cause analysis (UX-06)

```
SHADOW_PLAYMODE_BASELINE_RESTORED
```

Committed issue verified: **UX-06 — "Eight PlayMode tests fail at the audited baseline"** (P1,
Presenter / Spatial Agent Panel, `PROVEN_IN_PLAYMODE`, disposition `DEFER_TO_POST_V11`; impact recorded
as "presenter state does not clear between profiles"). No other issue touched or closed.

All eight failed **both** in the full suite and when their class ran alone — so none was order or
contamination. Two root-cause clusters, four production defects and four stale expectations. **Not one
cause** — the brief warned against assuming that, correctly.

## Cluster 1 — production defect: citations do not clear synchronously (3 failures)

`BankingThenDataScience_NoStaleCrossProfileState`, `DataScienceThenCoding_SwitchesCleanly`,
`PresenterReset_FromAnyProfile_ReturnsToBankingReady` all read `CitationCount` immediately after a
profile switch and got **1** where **0** was required.

Root cause: `ShadowSpatialAgentPanel.ClearCitations()` destroyed each chip with a plain `Destroy()`,
which Unity defers to end-of-frame. `CitationCount => _citations.childCount` therefore still returned
the old count in the **same frame** the profile switched. This is exactly the impact UX-06 recorded:
"presenter state does not clear between profiles" — the state *does* clear, but not until the frame
ends, so any same-frame reader (a UI update, or a profile switch immediately followed by a query) saw
stale cross-profile citations.

**FIX A** — re-parent each chip out of the citation host before the deferred `Destroy`:

```csharp
for (int i = _citations.childCount - 1; i >= 0; i--)
{
    var t = _citations.GetChild(i);
    t.SetParent(null, false);   // childCount drops now
    Destroy(t.gameObject);      // memory freed end-of-frame
}
```

`childCount` — and therefore `CitationCount` — is 0 in the same frame. This is a standard Unity
pattern, not a `DestroyImmediate` in production and not a broad sweep.

## Cluster 2 — production defect: internal orchestration overwrote the user's action (1 failure)

`ShowSource_CreatesVisibleOverlay` expected `LastAction == "SHOW_SOURCE"` and got `"ANALYZE"`.

Root cause: `ShowSource()` logged `SHOW_SOURCE`, then ran `if (State == Ready) Analyze()` — and
`Analyze()` logs `ANALYZE`, overwriting the user's top-level action.

**FIX B** — run the internal `Analyze()` first, then log the user's action so it wins
(`ShowSource` and `ShowAudit`; a directly-invoked `Analyze()` still logs `ANALYZE`).

## Cluster 3 — stale test expectations vs an already-documented contract (4 failures)

These test a legacy mock view whose contract changed with in-source documentation; the tests (headed
"AUTHORED … not yet executed by Alex") never ran, so they encode the old contract.

| test | stale expectation | production contract (cited) |
|---|---|---|
| `AnalyzeCausesVisibleStateChange` | a top `STATUS` Text changes | `ShadowLensMockView.cs:95` `_status = null; // the spatial-agent panel owns the single status row` → assert the `Ready→Analyzed` state transition |
| `DecisionPanelPopulatesInView` | a `DECISION` Text populates | `:98` `_decision = null; // the FINDING now renders inside the document footer`; the finding lives in the source overlay (inactive until `ShowSource`) → assert Analyzed then `ShowSource` surfaces `FindingText` |
| `Reset_ReturnsToReadyAndUnsigned` | `STATUS` contains "READY TO ANALYZE" | `_status = null`; the `Ready` + `TRUST == UNSIGNED` contract is intact → drop the removed `STATUS` line, keep the rest |
| `Coding_DiffFocusVisible` | `FocusText` contains `diff1` | `ShadowSpatialDemoFixtures.cs:55` emits `focus_object=diff1` **then** `highlight_source=cmd_test`; the single focus line shows the LATEST action → assert `cmd_test` |

Every updated expectation cites the production source that makes the old one obsolete. No assertion was
weakened arbitrarily, no failure was skipped or deleted.

## What was NOT done

No broad "destroy every object" cleanup, no `DestroyUnusedAssets`, no fixed-second waits, no retries,
no exception suppression, no test-only production branches, no skips. The two fixtures are unchanged in
structure — only four expectations were realigned to the documented contract and two production
lifecycle methods were corrected.
