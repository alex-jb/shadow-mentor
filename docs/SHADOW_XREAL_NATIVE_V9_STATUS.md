# Shadow XREAL SDK 3.1 typed integration — V9 honest status

Branch `feat/shadow-xreal-voice-device-v8` (Phase 9 continues on it). Never merged to main. Stable APK
`93f2a81a…` untouched. The licensed XREAL SDK is NOT committed (operator-local install via
`scripts/setup-local-xreal-sdk.sh`).

## Correction to the prior blocker report
The SDK was NOT yet installed in this project at the start of Phase 9 — only the tarball
(`~/Downloads/com.xreal.xr.tar.gz`, 248 MB, sha256 `fd7d0fce…`) was present, and XRI was 3.0.3 (not
3.0.11). Phase 9 actually imported + compiled it.

## What shipped (verified)
- **Reproducible operator-local install**: `scripts/setup-local-xreal-sdk.sh` (tarball → validated →
  prints the local `file:` manifest line; no committed absolute path/binary) + `check-local-xreal-sdk.sh`.
- **Real SDK imported + compiled**: adding `com.unity.modules.imageconversion` (built-in module,
  committed) resolves the SDK's Camera-Features build; `Unity.XR.XREAL.dll` builds with **0 CS errors**
  and `ShadowLens.dll` still builds.
- **Real API inventory** (`reports/xreal-v9/`): `Unity.XR.XREAL` — `XREALPlugin.GetTrackingType()` →
  `TrackingType` (MODE_6DOF/3DOF/0DOF), `GetDevicePoseFromHead(XREALComponent, ref Pose)`,
  `XREALXRLoader : XRLoaderHelper` + `OnXRLoaderStart/Stop`, `XREALRGBCamera.*`, `InputSource`.
  NOT NRSDK 2.x/NRKernal.
- **8 typed adapters** (`Assets/ShadowLens/Xreal/`, isolated `ShadowLens.Xreal` asmdef with
  `defineConstraints: SHADOW_XREAL_SDK`): loader / tracking / input / lifecycle / diagnostics /
  logcapture / capability / camera — compiled against the real API (`ShadowLens.Xreal.dll` built, 0 CS
  errors). Without the SDK + define the whole assembly is excluded → a clean clone builds the base.
- **Pure tracking mapper** (`ShadowXrealTrackingMapper`, EditMode-tested): MODE_6DOF/3DOF/0DOF →
  Core.TrackingMode; 6DoF is NEVER claimed from the reported type alone (fail-closed detector still
  needs Eye + observed translation).
- **XREAL+Voice candidate BUILT** (`com.shadowlens.xrealvoice`, **135 MB**, minSdk 29, ARM64, IL2CPP,
  release): real XREAL native libs bundled; permissions INTERNET + HIGH_SAMPLING_RATE_SENSORS +
  FOREGROUND_SERVICE (all XREAL-justified) + **no camera/mic**. sha256 `78f2d62e…`.
- Base voice candidate already built (`com.shadowlens.voice.base`, no INTERNET/mic/camera).
- Node suite green; forbidden-phrases clean; regression guards prevent committing the SDK/absolute path.

## Honest status ladder (§16)

| Status | State | Evidence |
|---|---|---|
| XREAL-SDK-LOCAL-INSTALL-DETECTED | ✅ | tarball present + imported to PackageCache |
| XREAL-SDK-VERSION-CONFIRMED | ✅ | com.xreal.xr 3.1.0 (package.json) |
| XREAL-TYPED-ADAPTERS-IMPLEMENTED | ✅ | 8 adapters against the real API |
| XREAL-LOADER-CONFIGURED | ⚠️ partial | loader adapter compiled + wired to OnXRLoaderStart/Stop; XR Plug-in Management loader-assignment asset not authored (runtime device concern) |
| XREAL-SDK-COMPILED | ✅ | Unity.XR.XREAL.dll, 0 CS errors |
| XREAL-TRACKING-ADAPTER-COMPILED | ✅ | ShadowLens.Xreal.dll, 0 CS errors |
| XREAL-INPUT-ADAPTER-COMPILED | ✅ | same |
| XREAL-CAMERA-ADAPTER-COMPILED | ⚠️ authored | compiles; live XREALRGBCamera calls behind SHADOW_XREAL_CAMERA (SDK target-platform gated); NO RGB capture claimed |
| XREAL-VOICE-BRIDGE-INTEGRATED | ✅ | Voice V8 runtime bridge (EditMode 16/16) consumes device/tracking state |
| BASE-VOICE-APK-BUILT | ✅ | com.shadowlens.voice.base |
| XREAL-VOICE-APK-BUILT | ✅ | com.shadowlens.xrealvoice 135 MB, sha256 78f2d62e… |
| XREAL-APK-STATIC-AUDITED | ✅ | reports/xreal-v9/XREAL_CANDIDATE_STATIC_AUDIT.md |
| ANDROID-INSTALLED | ❌ | no device |
| BEAM-PRO-SMOKE-TESTED | ❌ | no device |
| XREAL-3DOF-VALIDATED | ❌ | no device |
| XREAL-EYE-6DOF-VALIDATED | ❌ | no Eye/device |
| RGB-FRAME-VALIDATED | ❌ | no camera/device (path gated + unclaimed) |
| OCR-DEVICE-VALIDATED | ❌ | no device |
| BEAM-PRO-TTS-VALIDATED | ❌ | no device |
| DEVICE-PERFORMANCE-MEASURED | ❌ | no device |
| PRODUCTION-READY | ❌ | pre-1.0 |

## Blocked by (separately)
- **Beam Pro / One Pro / Eye hardware**: every *-VALIDATED / installed / device-performance. Run
  `device-test/v8` + the v6 runbook.
- **XR Plug-in Management loader asset**: XREAL-LOADER-CONFIGURED to full — the loader adapter is
  compiled; assigning the XREALXRLoader to Android in an XR settings asset is a Unity-GUI/device step.
- **SHADOW_XREAL_CAMERA + device Eye**: the RGB path (camera adapter authored; live calls + capture are
  device-only).

## Reproduce the XREAL build (operator)
1. `scripts/setup-local-xreal-sdk.sh ~/Downloads/com.xreal.xr.tar.gz` → add the printed local manifest line.
2. `-executeMethod ShadowLens.EditorTools.ShadowXrealDefineSetup.Set`.
3. `-executeMethod ShadowLens.EditorTools.ShadowV8AndroidBuild.BuildXrealVoiceCI`.
The committed tree builds the base without any of this (defineConstraints excludes the Xreal assembly).
