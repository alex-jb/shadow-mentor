# Regression — evidence-guide internal layout (UX-14)

Every Unity run used a **fresh process**; capture was never run in the same process as the full
PlayMode suite (UX-15 unfixed → process isolation keeps this honest).

## Node / tooling

| check | before | after |
|---|---|---|
| `beampro-device-test.selftest.sh` | 34 / 34 | **34 / 34** |
| `npm test` | 2060 · 2057 pass · 0 fail · 3 skip | **2060 · 2057 pass · 0 fail · 3 skip** |
| `generate-tokens.mjs --check` | clean | **clean** |

No Node test changed; token schema `/3` untouched. Unity world-space layout only.

## Unity EditMode (fresh process)

| | before | after |
|---|---|---|
| total / passed / failed | 146 / 146 / 0 | **146 / 146 / 0** |

## Unity PlayMode — full suite, fresh process, capture disabled

| | before | after |
|---|---|---|
| total | 89 | **95** |
| passed | 79 | **85** |
| failed | **8** | **8** |
| skipped | 2 | 2 |

+6 tests: `ShadowEvidenceGuideGeometryTests`.

**Failure identity set byte-identical to the known baseline. No new failure, none changed meaning.**
The suite is *not* green and this does not claim it is — the eight are the pre-existing presenter /
spatial-agent-panel failures (UX-06), out of scope:

```
ShadowLens.Tests.PlayMode.ShadowLensPlayModeTests.AnalyzeCausesVisibleStateChange
ShadowLens.Tests.PlayMode.ShadowLensPlayModeTests.DecisionPanelPopulatesInView
ShadowLens.Tests.PlayMode.ShadowLensPlayModeTests.Reset_ReturnsToReadyAndUnsigned
ShadowLens.Tests.PlayMode.ShadowLensPlayModeTests.ShowSource_CreatesVisibleOverlay
ShadowLens.Tests.PlayMode.ShadowSpatialAgentPanelPlayModeTests.BankingThenDataScience_NoStaleCrossProfileState
ShadowLens.Tests.PlayMode.ShadowSpatialAgentPanelPlayModeTests.Coding_DiffFocusVisible
ShadowLens.Tests.PlayMode.ShadowSpatialAgentPanelPlayModeTests.DataScienceThenCoding_SwitchesCleanly
ShadowLens.Tests.PlayMode.ShadowSpatialAgentPanelPlayModeTests.PresenterReset_FromAnyProfile_ReturnsToBankingReady
```

No test weakened, skipped or deleted. The prior increments' suites stay green:
`ShadowWorkspaceGeometryTests` (UX-02/03), `ShadowTrackingBannerGeometryTests` (UX-04),
`ShadowFirstFailureHierarchyTests` (UX-07) and `ShadowAuditWorkspaceLifecycleTests` — verified in a
separate run.

## Targeted guide suite (fresh process)

`ShadowEvidenceGuideGeometryTests` — **6 / 6** over 90 combinations (5 profiles × 2 languages ×
9 states, step counts 1/2/3/4/6): containment, internal collision, index/node association, per-step
count, cross-region separation, and the evidence-semantics + prior-contract invariants.

## Capture workflow (separate fresh process)

`SHADOW_CAPTURE=1` + `-testFilter ShadowAuditWorkspaceCaptureHarness` → 1 / 1, 32 PNGs.

## Protected artifacts — unchanged

| artifact | hash prefix |
|---|---|
| candidate-01 | `8ea859df` |
| candidate-02 | `6ee4d4ff` |
| candidate-03 | `11454763` |
| candidate-04 | `832c875a` |
| stable APK | `9efadf0a` |
| frozen verifier | `c478b46f` |
| `Packages/manifest.json` | `3120f9bf73d5` |
| `Packages/packages-lock.json` | `26e2d12d485c` |

No APK built. Android manifest, MR package handoff, XREAL SDK state and the SDK-free guarantee
untouched; no generated artifact hand-edited; no frozen evidence or attestation hash changed. Main V11
worktree never modified.

## Gates

```
CANDIDATE_05_JUSTIFIED = false
CANDIDATE_05_BLOCKED   = true

SHADOW_MR_PACKAGE_HANDOFF_PASSED     false
SHADOW_XREAL_LOADER_DEVICE_PASSED    false
AUDIT_WORKSPACE_RENDERED_IN_GLASSES  false
XREAL_3DOF_DEVICE_VALIDATED          false
BEAM_PRO_CONTROLLER_VALIDATED        false
OST_READABILITY_DEVICE_VALIDATED     false
PRODUCTION_READY                     false

SHADOW_EVIDENCE_GUIDE_OFFLINE_PASSED = true
SHADOW_EVIDENCE_GUIDE_DEVICE_PASSED  = false
```
