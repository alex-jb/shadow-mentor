# Unity Spatial-Agent — Gate 2 wiring map (prepared, NOT applied)

Gate 1 (the protocol + pure logic) is authored + drift-tested and touches **nothing** in the
running scene. This is the precise map Gate 2 will apply **only after Alex confirms the current
Unity foundation compiles green + all six mock buttons work**. No scene change happens before that.

## What Gate 1 did NOT touch (per the directive)
`ShadowLensRuntimeBootstrap` · `ShadowLensSceneGenerator` · the document workspace hierarchy ·
Analyze/Verify behavior · the button listeners · the design tokens. The new code lives in its own
assembly (`ShadowLens.SpatialAgent`), so it cannot break the existing scene compile.

## Binding table (new controller → existing component)

| New (Gate 1, authored) | Binds to (existing scene, Gate 2) | Visible effect |
|---|---|---|
| `IShadowSpatialRenderer` impl | `ShadowLensMockView` (adds Query/Answer, drives modes/highlight) | mode switch + node highlight/focus |
| `IShadowActionStatusView` | the HUD `STATUS` + a new `LAST ACTION` line | `LAST ACTION: highlight_source — EXECUTED` |
| `IShadowAnswerView` / `IShadowCitationView` | a new **Grounded Answer Card** (right, under decision card) | answer text + citation chips + grounded state |
| Query Bar | a new input on the bottom rail (next to the existing buttons) | submit a grounded question |
| Profile selector | a new 3-button row (Banking / Data Science / Coding) | reloads the fixture session + scene |
| `ShadowSpatialSceneIndex` | built from the server `load` scene (source of truth) | id resolution for highlight/focus |
| `ShadowSpatialQueryController` | new component on `ShadowLensMockDemoRoot` | orchestrates READY→…→DONE |

## Per-profile visible actions Gate 2 will wire
- **Banking** — exact source highlight + claim↔source connector (reuse the existing source-overlay).
- **Data Science** — selected-model focus + cited metric/evaluation focus + experiment lineage.
- **Coding** — relevant diff focus + test-evidence focus + final-commit relation.

One primary UI mode at a time (the existing mode discipline is preserved).

## Gate 2 exact steps for Alex (after approval)
1. Let Unity recompile · **Shadow Lens → Create Mock Demo Scene** (idempotent regenerate) ·
   **Shadow Lens → Validate Project Setup** (expect all singletons = 1).
2. Enter Play · submit each of the three profile questions · confirm answer card + citations +
   `LAST ACTION` + the visible highlight/focus/mode change · Reset restores Document Mode.
3. Run the authored PlayMode tests (Gate 2 adds them) · inspect Game view + Console · screenshot.

## Trigger
Gate 2 proceeds immediately (no further product choice) once Alex reports: zero red Console
errors · ShadowLensMockDemo enters Play Mode · institutional UI renders · Analyze / Show Source /
Show Audit / Verify / Tamper / Reset all produce visible change.
