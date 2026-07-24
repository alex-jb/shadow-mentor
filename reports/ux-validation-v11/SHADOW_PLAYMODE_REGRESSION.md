# Regression — PlayMode baseline (UX-06)

Every Unity run used a **fresh process**; capture was never in the same process as a full suite.

## Node / tooling

| check | before | after |
|---|---|---|
| `beampro-device-test.selftest.sh` | 34 / 34 | **34 / 34** |
| `npm test` | 2060 · 2057 pass · 0 fail · 3 skip | **2060 · 2057 pass · 0 fail · 3 skip** |
| `generate-tokens.mjs --check` | clean | **clean** |
| status-contrast matrix (d664873) | 13 / 13 | **13 / 13** |

## Unity

| suite | result |
|---|---|
| EditMode | **146 / 146** |
| both affected fixtures together | **39 / 39** |
| isolation/lifecycle (new) | **6 / 6** |
| 5 UX/lifecycle groups | **26 / 26** |
| full PlayMode run 1 | **101 total / 99 passed / 0 failed / 2 skipped** |
| full PlayMode run 2 | **101 total / 99 passed / 0 failed / 2 skipped** (identical) |
| capture workflow (separate process) | **1 / 1** |

No test weakened, skipped or deleted; no failure converted to a skip. The 2 skips are the pre-existing
env-gated capture harnesses.

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
untouched; no generated artifact hand-edited; no frozen evidence or attestation hash changed; token
schema `/3` untouched. Main V11 worktree never modified.

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
```

No PlayMode result is physical XR evidence.
