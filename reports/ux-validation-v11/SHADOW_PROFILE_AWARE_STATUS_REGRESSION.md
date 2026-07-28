# Regression — profile-aware semantic status contrast

Every Unity run below used a **fresh process**. The capture harness was never run in the same process
as the full PlayMode suite: the audit proved it destroys the shared stage/bootstrap roots and leaves a
second `MainCamera`, which turns 8 failures into 10. That harness defect is **not** fixed here, so
process isolation is what keeps the regression result honest.

## Node / tooling

| check | before | after |
|---|---|---|
| `beampro-device-test.selftest.sh` | 34 / 34 | **34 / 34** |
| `npm test` | 2047 tests · 2044 pass · 0 fail · 3 skip | **2060 tests · 2057 pass · 0 fail · 3 skip** |
| `generate-tokens.mjs --check` | clean | **clean** |

+13 tests: `test/status-contrast.test.js`.

## Unity EditMode (fresh process)

| | before | after |
|---|---|---|
| total / passed / failed | 136 / 136 / 0 | **146 / 146 / 0** |

+10 tests: `ShadowStatusProfileContrastTests`.

## Unity PlayMode — full suite, fresh process, capture disabled

| | before | after |
|---|---|---|
| total | 70 | 70 |
| passed | 60 | 60 |
| failed | **8** | **8** |
| skipped | 2 | 2 |

**Failure identity sets are identical. No new failure appeared and no pre-existing failure changed
meaning.** The suite is *not* green and this increment does not claim it is — these eight are the
pre-existing presenter / spatial-agent-panel failures recorded as UX-06, explicitly out of scope:

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

No test was weakened, skipped or deleted to reach this result.

## Capture workflow (separate fresh process)

`SHADOW_CAPTURE=1` + `-testFilter ShadowAuditWorkspaceCaptureHarness` → 1 / 1 passed, 32 PNGs written.

## Tests deliberately updated, not weakened

`test/token-codegen.test.js` and `test/token-semantic-parity.test.js` pinned the literal schema string
`shadow-spatial-tokens/2`. The schema was intentionally bumped to `/3`, so those pins were moved to
`/3` in the same commit — the assertions still pin an exact version, they simply pin the new one.

Separately, the generator's semantic invariants were **strengthened**: they compared literal hexes and
would have silently stopped matching once a rendition changed. They now compare `color_family`, and
the guard was proven to fire by deliberately mislabelling `governance.APPROVAL_PRESENT`.

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

No APK was built. The Android manifest, the MR package handoff, the XREAL SDK state and the SDK-free
repository guarantee are untouched. The main V11 worktree was not modified.

## Intentional generated-artifact updates

`generated/shadow-semantic-tokens.generated.{js,css}` and
`Assets/ShadowLens/Generated/ShadowSemanticTokens.Generated.cs` changed **only** through
`scripts/generate-tokens.mjs`; nothing generated was hand-edited, and `--check` is clean. No frozen
evidence or attestation semantic hash was altered.

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

PROFILE_AWARE_STATUS_CONTRAST_OFFLINE_PASSED = true
PROFILE_AWARE_STATUS_CONTRAST_DEVICE_PASSED  = false
```
