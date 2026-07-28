# Shadow XREAL native V6 — honest status

Branch `feat/shadow-xreal-native-v6` (from `feat/shadow-device-ready-v5 @ f11b34b`). Never merged to
main. Stable APK `93f2a81a…` untouched. No production signing. XREAL SDK NOT imported (licensing);
Beam Pro NOT available.

## What shipped (verified, non-device / non-SDK)

- **Base candidate cleaned**: INTERNET removed at source (Unity engine library default → custom main
  manifest `tools:node="remove"`), rebuilt (sha256 `3994e461…`, no INTERNET/camera/mic/storage/
  location). Regression guarded by Node test + `scripts/audit-android-permissions.mjs`.
- **Status language normalized** (Node results; XR-INPUT-ROUTING-SIMULATED; UNITY-PROFILING-INSTRUMENTED).
- **XREAL SDK import runbook** + 6 inventory templates (SDK-absent; fill on import; do not use NRSDK 2.x).
- **Loader-state model** (`ShadowXrealLoaderState`): 8 phases, transition guard, tracking-query gated on
  LOADER_STARTED, safe fallback. No SDK API names.
- **Evidence capture loop** (`ShadowEvidenceCapturePipeline`): frame validation → SHA-256 → OCR → source
  map → user confirmation → seal → independent verify, fixture-tested (synthetic frames).
- **Device package v6**: adb-autodetecting diagnostics (3 separate log domains), redaction, field
  dictionary, first-device-day runbook, stop conditions, regression checklist, bug-triage CSV.
- Unity EditMode **27/27**. Node suite **1,911 total · 1,908 passed · 3 skipped · 0 failed**. forbidden-phrases clean.

## Honest status ladder (§20)

| Status | State | Evidence |
|---|---|---|
| BASE-INTERNET-PERMISSION-REMOVED | ✅ | manifest-merger fix; APK declares no INTERNET; regression test |
| BASE-GUIDED-STORY-APK-REBUILT | ✅ | sha256 3994e461…, ARM64/IL2CPP/non-debuggable |
| XREAL-SDK-IMPORTED | ❌ | SDK not present (licensing); runbook written |
| XREAL-SDK-COMPILED | ❌ | requires the import |
| XREAL-CANDIDATE-BUILT | ❌ | requires the import |
| ANDROID-INSTALLED | ❌ | no device |
| BEAM-PRO-SMOKE-TESTED | ❌ | no device |
| XREAL-LOADER-VALIDATED | ❌ | loader-state MODEL authored + tested; real loader needs SDK + device |
| XREAL-3DOF-VALIDATED | ❌ | no device |
| XREAL-EYE-DETECTED | ❌ | no Eye / device |
| XREAL-EYE-6DOF-VALIDATED | ❌ | no Eye / device |
| BEAM-PRO-INPUT-VALIDATED | ❌ | no device |
| RECENTER-VALIDATED | ❌ | no device |
| TRACKING-RECOVERY-VALIDATED | ❌ | no device |
| RGB-NONBLACK-FRAME-VALIDATED | ❌ | no camera / device |
| RGB-FRAME-HASHED | ⚠️ fixture only | pipeline hashes synthetic frames; real frame needs the Eye |
| OCR-DEVICE-VALIDATED | ❌ | no device (fixture OCR flow tested) |
| VOICE-DEVICE-VALIDATED | ❌ | no device |
| SIGNED-DEVICE-FIXTURE-VERIFIED | ⚠️ fixture only | seal+verify proven on synthetic evidence; labelled DEVICE VALIDATION FIXTURE |
| DEVICE-PERFORMANCE-MEASURED | ❌ | no device (Editor numbers are not device numbers) |
| DEVICE-MEDIA-CAPTURED | ❌ | no device (never faked with another engine) |
| USER-STUDIED | ❌ | protocol only |
| PRODUCTION-READY | ❌ | pre-1.0; no production signing |

## Blocked by (separately)

- **XREAL SDK import (operator, logged-in):** everything XREAL-SDK / candidate. See
  `docs/UNITY_XREAL_BUILD_RUNBOOK.md`; then §5 typed adapters, §4 loader config, §8 candidate build.
- **Beam Pro / One Pro / Eye hardware + device access:** every *-VALIDATED / DEVICE-* / installed /
  smoke-tested status. Run `device-test/v6/FIRST_DEVICE_DAY_RUNBOOK.md`.
- **Camera hardware (Eye):** RGB-NONBLACK-FRAME-VALIDATED, OCR-DEVICE-VALIDATED (the pipeline logic is
  ready; it needs a real frame).
- **Participants + approval:** USER-STUDIED.

The product-critical loop (real frame → hash → OCR → source map → confirm → seal → verify) is
implemented and fixture-verified end to end; only the **real camera frame** at the front is
device-blocked. When Beam Pro + Eye arrive, run the runbook — the loop is ready to receive real frames.
