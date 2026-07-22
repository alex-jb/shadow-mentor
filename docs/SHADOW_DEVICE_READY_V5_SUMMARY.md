# Shadow device-ready V5 — summary + honest status ladder

Branch `feat/shadow-device-ready-v5` (from `feat/shadow-shared-story-adapters @ 92e3416`). Never
merged to main. Stable fallback APK `93f2a81a…` untouched. No production signing / npm publish.

## What shipped (verified)

- **Deep research** (official sources, 2026-07-21): XREAL / Unity 6 / Three.js — `docs/research/`.
- **Capability model** (`Assets/ShadowLens/Device/`): fail-closed detector, 8 honest session states,
  tracking state machine, evidence-free report. EditMode **16/16**.
- **Input architecture** (`Assets/ShadowLens/Input/`): canonical actions + pure router with safety
  (passive→Focus only; destructive→separate Confirm; Back/Cancel/Recenter always reachable). Input
  System sources isolated in `ShadowLens.InputV5.Runtime`.
- **Presenter + failure recovery** (`Assets/ShadowLens/Presenter/`): deterministic Banking READY,
  last-known-safe-state, pause/resume. PlayMode **4/4**.
- **Guided-story Android candidate** (`Shadow Lens → Build Guided Story Android Candidate`): RELEASE
  build, ARM64 + IL2CPP, **24.6 MB**, non-debuggable, least-privilege. Static audit in
  `reports/device-ready-v5/`. SHA-256 `d3113741…`.
- **Three.js perf** (measured, Chromium 149): render-on-demand (idle draws → 0 under reduced motion),
  adaptive DPR, disposal (24 switches → +0.13 MB). `media/device-ready-v5/threejs/`.
- **Product-quality fixtures** (`fixtures/product-quality-v5/`): Banking / Data Science / Coding, real
  domain kinds, pristine + tampered + limitation + human-review boundary. Node **8/8**.
- **Label readability presets**, **device test package** (`device-test/v5/`, adb-autodetecting),
  **security/privacy docs** (`docs/security/`), **user study protocol** (`docs/research/`).
- Node suite **1908 / 1905 pass / 3 skip / 0 fail**. forbidden-phrases clean.

## Honest status ladder

| Status | State | Evidence |
|---|---|---|
| DEVICE-READY-RESEARCH-COMPLETE | ✅ | docs/research/ (official sources + matrices) |
| CAPABILITY-MODEL-IMPLEMENTED | ✅ | Device/ + EditMode 16/16 |
| GUIDED-STORY-ANDROID-BUILT | ✅ | 24.6 MB APK, sha256 d3113741…, build report |
| ANDROID-STATIC-AUDITED | ✅ | reports/device-ready-v5/ (manifest/permission/AAR) |
| PRESENTER-MODE-IMPLEMENTED | ✅ | Presenter/ + PlayMode 4/4 |
| FAILURE-RECOVERY-TESTED | ✅ | PlayMode reset/pause-resume |
| XR-SIMULATOR-TESTED | ⚠️ partial | official XR Device Simulator is a PM sample (import documented); router/state tested via EditMode, not the sample GUI |
| UNITY-DESKTOP-PROFILED | ⚠️ authored | instrumentation authored; Editor numbers are non-representative per Unity docs — real numbers need on-device |
| THREEJS-PROFILED | ✅ | media/device-ready-v5/threejs/ (measured before/after) |
| XREAL-SDK-COMPILED | ❌ | SDK not imported; adapters gated behind SHADOW_XREAL_SDK |
| XREAL-CANDIDATE-BUILT | ❌ | requires the SDK import |
| ANDROID-INSTALLED | ❌ | no device |
| BEAM-PRO-SMOKE-TESTED | ❌ | no device |
| XREAL-3DOF-TESTED | ❌ | no device |
| XREAL-EYE-6DOF-TESTED | ❌ | no Eye / device |
| RGB-FRAME-VALIDATED | ❌ | no camera / device |
| OCR-DEVICE-VALIDATED | ❌ | no device |
| DEVICE-PERFORMANCE-MEASURED | ❌ | no device (Editor numbers are not device numbers) |
| USER-STUDIED | ❌ | protocol only; no participants |
| PRODUCTION-READY | ❌ | pre-1.0; no production signing |

## Blocked by (separately)

- **Android hardware / Beam Pro / device access:** ANDROID-INSTALLED, BEAM-PRO-SMOKE-TESTED,
  XREAL-3DOF/EYE-6DOF-TESTED, RGB-FRAME-VALIDATED, OCR-DEVICE-VALIDATED, DEVICE-PERFORMANCE-MEASURED.
  Run `device-test/v5/` + `DEVICE_ACCEPTANCE_CHECKLIST.md` when a device is available.
- **XREAL SDK import (operator):** XREAL-SDK-COMPILED, XREAL-CANDIDATE-BUILT. Adapters are authored +
  gated (`Providers/XrealProviders.cs`, `SHADOW_XREAL_SDK`).
- **GUI Unity session:** real Unity screenshots/video (headless `-nographics` cannot render pixels —
  not faked). The Three.js media is real browser rendering.
- **Participants + approval:** USER-STUDIED.

## Unity build reproduce

```
UNITY=/Applications/Unity/Hub/Editor/6000.0.23f1/Unity.app/Contents/MacOS/Unity
$UNITY -batchmode -nographics -projectPath apps/shadow-lens/unity -buildTarget Android \
  -executeMethod ShadowLens.EditorTools.ShadowGuidedStoryAndroidBuild.BuildCI -quit -logFile -
# SHADOW_DEV_BUILD=1 for a Development (debuggable, profiling) build instead of the release candidate.
```
