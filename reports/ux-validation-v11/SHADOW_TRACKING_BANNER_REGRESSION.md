# Regression — degraded-tracking banner (UX-04)

Every Unity run used a **fresh process**, and the capture harness was never run in the same process as
the full PlayMode suite (UX-15 is not fixed here, so process isolation is what keeps this honest).

## Node / tooling

| check | before | after |
|---|---|---|
| `beampro-device-test.selftest.sh` | 34 / 34 | **34 / 34** |
| `npm test` | 2060 tests · 2057 pass · 0 fail · 3 skip | **2060 tests · 2057 pass · 0 fail · 3 skip** |
| `generate-tokens.mjs --check` | clean | **clean** |

No Node test changed and token schema `/3` is untouched — this increment is Unity world-space layout
only.

## Unity EditMode (fresh process)

| | before | after |
|---|---|---|
| total / passed / failed | 146 / 146 / 0 | **146 / 146 / 0** |

## Unity PlayMode — full suite, fresh process, capture disabled

| | before | after |
|---|---|---|
| total | 77 | **83** |
| passed | 67 | **73** |
| failed | **8** | **8** |
| skipped | 2 | 2 |

+6 tests: `ShadowTrackingBannerGeometryTests`.

**The failure identity sets are identical. No new failure appeared and no pre-existing failure changed
meaning.** The suite is *not* green and this increment does not claim it is — these eight are the
pre-existing presenter / spatial-agent-panel failures recorded as UX-06, out of scope:

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

No test was weakened, skipped or deleted. `ShadowWorkspaceGeometryTests` (UX-02/UX-03, 7 tests) and
`ShadowAuditWorkspaceLifecycleTests` both stay green with the banner change.

## Targeted banner suite (fresh process)

`ShadowTrackingBannerGeometryTests` — **6 / 6** over 40 banner combinations (5 profiles × 2 languages
× 4 banner-raising states) plus the 4 non-degraded states asserted to raise no banner: viewport
containment, semantic completeness, stranded-punctuation, neighbour separation, bounded and
deterministic wrap, and the `d664873` / `d7feb01` regression invariants.

## Capture workflow (separate fresh process)

`SHADOW_CAPTURE=1` with `-testFilter ShadowAuditWorkspaceCaptureHarness` → 1 / 1, 32 PNGs.

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

No APK was built. The Android manifest, MR package handoff, XREAL SDK state and the SDK-free
guarantee are untouched; no generated artifact was hand-edited; no frozen evidence or attestation hash
changed. The main V11 worktree was never modified.

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

SHADOW_TRACKING_BANNER_OFFLINE_PASSED = true
SHADOW_TRACKING_BANNER_DEVICE_PASSED  = false
```
