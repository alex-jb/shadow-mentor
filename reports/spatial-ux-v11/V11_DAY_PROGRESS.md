# V11 spatial-UX — progress (2026-07-22)

Branch `feat/shadow-spatial-ux-asset-audit-v11`, based on security baseline `9f889dd`. Honest status:
some of the day-plan is DONE + verified; the device-dependent + larger-refactor items are explicitly
PENDING. No fabricated results. **All device-evidence flags remain false** (no hardware run occurred).

## Done + verified
| # | Item | Evidence |
|---|---|---|
| 1 | V11 rebased onto security baseline `9f889dd` | `SECURITY_BASELINE_INTEGRATION.md`; ancestry V10→sec→V11; 45/45 targeted security tests; frozen verify.html hash matches; no security commit touches Unity/APK |
| 2 | Unity asset inventory (real data) | `UNITY_{MESH,MATERIAL,TEXTURE,FONT,SCENE}_INVENTORY.csv` + `UNITY_ASSET_RISK_REPORT.md` — **0 imported assets; visuals procedural**; allocation risks located at file:line |
| 3 | Three.js runtime inventory | `THREEJS_RUNTIME_INVENTORY.json` + `THREEJS_ASSET_INVENTORY.csv` + `THREEJS_RENDER_RISK_REPORT.md` — ~64 transparent objs, no instancing, `layout()` leak, no render-on-demand |
| 4 | **XREAL_OST_BRIGHT profile implemented** | `ShadowDesignTokens.cs` additive `ShadowVisualProfile`+`Resolve()`; 6 EditMode tests (bright/dark-text/bold-outline/high-occlusion/back-compat/preserved-semantics) |
| 5a | Status system = color+shape+text | VERIFIED in audit (`ShadowGuidedStoryStatus.cs:14-19`, 13 statuses, `ShapeOf`+`ColorKeyOf`+text) — consolidation not rewrite |
| 5b | Scanning explicitly handled + 3DoF model | 6 tracking pin tests (`ShadowTrackingStatePinTests.cs`) — Scanning→Limited (never default→Lost), fail-closed, loader-gate |
| 6 | 1 high-confidence perf fix | shared LineRenderer material (`ShadowStageController.cs:162,199`) |
| — | Compile + tests | Unity EditMode **117/117** (was 105), 0 compile errors; Node **1982 pass / 0 fail / 3 skip**; frozen verify.html + stable APK unchanged |

### PlayMode — 8 pre-existing failures (NOT introduced by V11 today)
ShadowLens PlayMode: **59/67 pass, 8 fail** (`ShadowLensPlayModeTests` mock-view visibility tests —
`AnalyzeCausesVisibleStateChange`, `DecisionPanelPopulatesInView`, `Reset_ReturnsToReadyAndUnsigned`, …),
all `NullReferenceException`. **Attribution proven:** re-running PlayMode with my Unity changes reverted to
the pre-change baseline produced the *identical* 59/67 · 8-fail (evidence:
`evidence/shadowlens-playmode-baseline-same-8-fail.xml` vs `evidence/shadowlens-playmode-59of67-8preexisting.xml`).
So these are a pre-existing condition (the mock-view visibility PlayMode tests appear to need a real
camera/graphics context that batch-headless does not fully provide) — **my changes did not introduce them.**
The `ShadowStagePlayModeTests` (which exercise the LineRenderer change) **pass**. Fixing the 8 pre-existing
mock-view PlayMode tests is out of today's scope and tracked here honestly rather than claimed green.

## Pending (honest — NOT done today)
| Item | Why / next step |
|---|---|
| **Unity desktop screenshots** (01–06) + **OST simulations** (bright-office/dark-room/patterned) | Project compiles, so feasible via a render harness (Editor script: load demo scene → run bootstrap → render camera to RenderTexture → PNG). Not built yet. The runtime UI is bootstrap-built, so the harness must drive the build (Play-mode or an edit-mode build entry) before capture. **Must NOT fabricate — no capture is presented until the harness renders the real UI.** OST simulations must carry `SIMULATED OST BACKGROUND / NOT DEVICE VALIDATED`. |
| Remaining 5 perf fixes | Pool GuidedStory nodes (`ShadowGuidedStoryPlayer.cs:84-107`); MPB for hover recolor (`ShadowHeadDirectedFocus.cs:46-58`); kill per-frame string in hover Update (`:38-44`); split static/dynamic overlay canvas (`ShadowInstitutionalLayoutController.cs:52-63`); reduce Outline overdraw (`ShadowMaterials.cs:20`). Each needs its own EditMode/PlayMode verification. |
| Auto-degrade to safe 3DoF/2D on TrackingLost | The state machine + 2D-audit capability exist, but render controllers don't subscribe to tracking health; the fallback is a manual `_mode2D` toggle. Wiring `ShadowStageController`/`ShadowLensMockView`/`ShadowGuidedStoryPlayer` to auto-restore the safe layout on loss is the gap. |
| StageController color-only council nodes | Minor a11y gap — apply the `ShapeOf` shape encoding to the 5 council spheres. |
| Three.js `layout()`/`buildTrustBadges` disposal leak fix | `scene.js:213-214`, `scene.js:163` — call `disposeMesh` on card teardown. |

## Honest device-status flags (ALL false — no hardware evidence exists)
```
BEAM-PRO-VISUAL-VALIDATED          false
BEAM-PRO-READABILITY-VALIDATED     false
BEAM-PRO-PERFORMANCE-MEASURED      false
XREAL-3DOF-VALIDATED               false
XREAL-EYE-6DOF-VALIDATED           false
CONTROLLER-VALIDATED               false
DEVICE-TTS-VALIDATED               false
CAMERA-VALIDATED                   false
OCR-DEVICE-VALIDATED               false
```
All Unity numbers are Editor/static; no frame-time, no readability, no device conclusion is asserted.

## Frozen-artifact integrity (unchanged)
- `verify.html` sha256 `c478b46f…` — matches documented frozen hash.
- Stable APK path is operator-local (empty git placeholder); no commit touches any APK path.
- `ProjectSettings.asset` icon-slot churn from Unity batch runs was reverted (not committed).
