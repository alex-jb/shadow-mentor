# Regression — layout capacity + Trust Strip rhythm (UX-02 · UX-03)

Every Unity run used a **fresh process**, and the capture harness was never run in the same process as
the full PlayMode suite — the audit proved it destroys the shared stage/bootstrap roots and leaves a
second `MainCamera`, turning 8 failures into 10. That harness defect is UX-15 and is **not** fixed
here, so process isolation is what keeps this result honest.

## Node / tooling

| check | before | after |
|---|---|---|
| `beampro-device-test.selftest.sh` | 34 / 34 | **34 / 34** |
| `npm test` | 2060 tests · 2057 pass · 0 fail · 3 skip | **2060 tests · 2057 pass · 0 fail · 3 skip** |
| `generate-tokens.mjs --check` | clean | **clean** |

No Node test changed: this increment touches Unity world-space layout only. The semantic-token schema
`/3` from `d664873` is untouched.

## Unity EditMode (fresh process)

| | before | after |
|---|---|---|
| total / passed / failed | 146 / 146 / 0 | **146 / 146 / 0** |

## Unity PlayMode — full suite, fresh process, capture disabled

| | before | after |
|---|---|---|
| total | 70 | **76** |
| passed | 60 | **66** |
| failed | **8** | **8** |
| skipped | 2 | 2 |

+6 tests: `ShadowWorkspaceGeometryTests` (a 7th, `NoSemanticLineIsTruncated`, was added afterwards —
7/7 in its own targeted run).

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

No test was weakened, skipped or deleted. `ShadowAuditWorkspaceLifecycleTests` (32 rebuild cycles,
region count, material count, orphan count) stays green with the new layout.

## Targeted geometry suite (fresh process)

`ShadowWorkspaceGeometryTests` — **7 / 7**, covering 90 combinations (5 profiles × 2 languages ×
9 states): cross-column overlap, left/centre gap, Trust Strip pair overlap, intra-region line overlap,
viewport containment including the moved rail, unintended truncation, and semantic + colour stability.

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

No APK was built. The Android manifest, the MR package handoff, the XREAL SDK state and the SDK-free
guarantee are untouched, no generated artifact was hand-edited, and no frozen evidence or attestation
hash changed. The main V11 worktree was never modified.

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

SHADOW_LAYOUT_CAPACITY_OFFLINE_PASSED = true
SHADOW_LAYOUT_CAPACITY_DEVICE_PASSED  = false
```
