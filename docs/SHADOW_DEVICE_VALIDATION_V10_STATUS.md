# Shadow device validation V10 — honest status

Branch `feat/shadow-xreal-device-validation-v10` (from `feat/shadow-xreal-voice-device-v8 @ eefc2ff`).
Never merged to main. Stable APK `93f2a81a…` untouched. Licensed SDK NOT committed.

## Important reconciliation
At the start of Phase 10 the working tree did NOT have the XREAL loader assigned — the tracked
`Assets/XR/XRGeneralSettingsPerBuildTarget.asset` was empty (`Values: []`), and the SDK was absent
(Phase 9 kept the base clean). Phase 10 actually configured the loader reproducibly and rebuilt.

## What shipped (verified, non-device)
- **XR loader configured reproducibly** (`ShadowXrealLoaderConfig.ConfigureAndroid`, official XR
  Management editor APIs): `XREALXRLoader` assigned to **Android** with Initialize-XR-on-Startup;
  **Standalone left without XREAL**. Serialized evidence in `Assets/XR/XRGeneralSettingsPerBuildTarget.asset`
  (Android Providers `m_Loaders` has the loader; guid-only, no local paths). No plane/image/hand/depth/anchor.
- **V10 core candidate BUILT** against the real SDK: `com.shadowlens.xrealvoice` v0.10-xreal-core,
  **128 MB**, minSdk 29, ARM64/IL2CPP, release, sha256 `9efadf0a…`. **SHADOW_XREAL_CAMERA OFF** (asserted
  by the build); no camera/mic; permissions INTERNET + HIGH_SAMPLING_RATE_SENSORS + FOREGROUND_SERVICE
  (all XREAL-justified). Does NOT overwrite the V9 candidate (kept, 135 MB).
- **Device harness** (`device-test/v10/`): collect-device-info + install-order (safe: stable → base → core,
  separate package ids) + launch-and-logcat + DEVICE_DAY_RUNBOOK_V10 (STAGE 0–G) + DEVICE_RESULT_V10 template.
- Base still builds without the SDK (clean-clone verified: SDK removed, define cleared, 0 CS errors).

## Honest status ladder (§17)

| Status | State | Evidence |
|---|---|---|
| XR-LOADER-CONFIGURED | ✅ | XREALXRLoader assigned to Android (serialized asset) |
| XREAL-CORE-APK-BUILT | ✅ | 128 MB, sha256 9efadf0a…, camera off |
| ANDROID-INSTALLED | ❌ | no device |
| BEAM-PRO-SMOKE-TESTED | ❌ | no device |
| XREAL-LOADER-VALIDATED | ❌ | needs device logs (loader STARTED) |
| XREAL-3DOF-VALIDATED | ❌ | no device |
| BEAM-PRO-INPUT-VALIDATED | ❌ | no device |
| RECENTER-VALIDATED | ❌ | no device |
| TRACKING-RECOVERY-VALIDATED | ❌ | no device |
| EYE-DETECTED | ❌ | no device (never inferred from attachment) |
| XREAL-EYE-6DOF-VALIDATED | ❌ | needs SDK-reported mode + observed translation |
| BEAM-PRO-TTS-VALIDATED | ❌ | no device |
| ENGLISH-TTS-VALIDATED | ❌ | no device |
| CHINESE-TTS-VALIDATED | ❌ | no device |
| BARGE-IN-DEVICE-MEASURED | ❌ | host-tested only |
| CAMERA-CANDIDATE-BUILT | ❌ | build only after A–E pass on device |
| RGB-NONBLACK-FRAME-VALIDATED | ❌ | no camera/device |
| RGB-FRAME-HASHED | ❌ | no device |
| OCR-DEVICE-VALIDATED | ❌ | no device |
| DEVICE-FIXTURE-SEALED / …-INDEPENDENTLY-VERIFIED | ❌ | needs a real frame first |
| DEVICE-PERFORMANCE-MEASURED | ❌ | no device (Editor numbers are not device numbers) |
| DEVICE-MEDIA-CAPTURED | ❌ | no device (desktop media is never device evidence) |
| INTERNAL-LISTENING-EVALUATED / FORMAL-USER-STUDIED | ❌ | no listeners |
| PRODUCTION-READY | ❌ | pre-1.0 |

## Blocked by (all device)
Every status below XREAL-CORE-APK-BUILT needs the connected Beam Pro + One Pro + Eye. The core candidate
is built and the install/launch/logcat commands + STAGE runbook are ready — on the device day, run
`device-test/v10/install-order.sh` + `launch-and-logcat.sh`, follow DEVICE_DAY_RUNBOOK_V10.md STAGE A→E,
and record evidence in DEVICE_RESULT_V10.md. Only real device logs/samples upgrade these states.

## Reproduce the V10 core build (operator)
1. `scripts/setup-local-xreal-sdk.sh ~/Downloads/com.xreal.xr.tar.gz` → add the printed local manifest line.
2. `-executeMethod ShadowLens.EditorTools.ShadowXrealDefineSetup.Set`.
3. `-executeMethod ShadowLens.EditorTools.ShadowXrealLoaderConfig.ConfigureAndroid`.
4. `-executeMethod ShadowLens.EditorTools.ShadowV10CoreBuild.BuildCI`.
