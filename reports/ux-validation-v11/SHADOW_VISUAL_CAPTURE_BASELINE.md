# Shadow Lens V11 — visual capture baseline

All artifacts referenced here are labelled:

```
EDITOR_SIMULATION_ONLY
NOT_BEAM_PRO_EVIDENCE
NOT_OST_EVIDENCE
NOT_PHYSICAL_XR_VALIDATION
```

## The existing harness (used unchanged — no replacement was built)

| Property | Value |
|---|---|
| Entry | `SHADOW_CAPTURE=1` + Unity `-runTests -testPlatform PlayMode` (`ShadowAuditWorkspaceCaptureHarness.CaptureAuditWorkspace`) |
| Editor | 6000.0.23f1 |
| Scene | none loaded — the harness builds the real `ShadowAuditWorkspace` component in an empty PlayMode scene |
| Fixture | the banking guided-story model, `FirstFailure = decision`, `AffectedDownstream = [pricing]` |
| Camera | `(0, 0.1, −7.2)` → `(0, 0.1, 0)`, FOV 40, `SolidColor` |
| Resolution | 1600 × 1000, `RenderTexture` ARGB32 |
| Profiles | `DesktopDark`, `XrealOstBright`, `AccessibilityHighContrast` |
| Languages | `en`, `zh-CN` |
| Output | `media/spatial-ux-v11/audit-workspace/<state>__<lang>__<profile>.png` + `harness-capture-list.json` |
| Play Mode | required |
| Golden comparison | **none** — no automatic image diff exists |

### Pre-run safety inspection (§6)

Scanned for `PlayerSettings` / `EditorBuildSettings` / `AssetDatabase` / `BuildPipeline` / `adb` /
`UnityWebRequest` / scene saving: **none present**. The only writes are the PNGs and the JSON list,
both inside `media/spatial-ux-v11/audit-workspace/`. It does not build APKs and does not touch the
XREAL SDK. Safe to run under the hard boundaries — and it was run unchanged.

## State matrix actually present (32 PNGs, 14 states)

| State | en/DesktopDark | zh-CN/DesktopDark | en/XrealOstBright | en/AccessibilityHighContrast |
|---|---|---|---|---|
| overview | ✓ | ✓ | ✓ | ✓ |
| current-focus | ✓ | — | — | — |
| source-card | ✓ | — | — | — |
| trust-strip | ✓ | — | — | — |
| first-failure | ✓ | ✓ | ✓ | ✓ |
| downstream-affected | ✓ | ✓ | ✓ | ✓ |
| human-review-required | ✓ | — | — | — |
| human-review-recorded | ✓ | — | — | — |
| approval-not-present | ✓ | — | — | — |
| approval-present | ✓ | ✓ | ✓ | ✓ |
| tracking-scanning | ✓ | ✓ | ✓ | ✓ |
| tracking-limited | ✓ | — | — | — |
| tracking-lost | ✓ | ✓ | ✓ | ✓ |
| tracking-recovering | ✓ | — | — | — |

Plus 6 contact sheets and the preserved `BEFORE-overlap/` + `INTERMEDIATE-partial/` sets.

### States requested by the audit brief that the fixtures cannot produce

| Requested state | Result |
|---|---|
| source present | `NOT_CAPTURED_WITH_EXISTING_FIXTURES` — the fixture's focused entity resolves to `SOURCE NOT PRESENT` in every captured state; a source-present capture would need a new fixture, which the brief forbids |
| loading | `NOT_CAPTURED_WITH_EXISTING_FIXTURES` — no loading state exists in the product |
| error | `NOT_CAPTURED_WITH_EXISTING_FIXTURES` — no error state exists in the product |
| empty / unavailable | `NOT_CAPTURED_WITH_EXISTING_FIXTURES` — no empty state exists |
| reset / default | `NOT_CAPTURED_WITH_EXISTING_FIXTURES` — `Reset` exists as a rail affordance but has no distinct captured state |
| tracking unknown | partially covered by `tracking-lost` / `tracking-scanning`; a literal `UNKNOWN` tracking value is pinned by EditMode tests but not captured |

None of these were fabricated.

## Reproducibility finding

Re-running the harness at the same commit regenerated **all 39 PNGs with different bytes** (e.g.
`first-failure__en__DesktopDark` 326,014 → 326,309 bytes) while remaining visually equivalent. The
dynamic OS font atlas (`Font.CreateDynamicFontFromOSFont`) is not byte-stable across runs.

**Consequence:** this harness is a *capture* tool, not a *visual-regression gate*. It cannot be wired
to a byte-comparison check without either an image-similarity comparison or a bundled deterministic
font. The regenerated files were reverted; the committed baseline is unchanged.

## Audit Room Flat

No committed capture exists. Its state in this audit is `PROVEN_FROM_GENERATOR_CODE` only.
