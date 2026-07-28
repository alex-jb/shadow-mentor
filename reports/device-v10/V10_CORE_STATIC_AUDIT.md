# V10 core device candidate — static audit

APK: `Build/Android/shadow-lens-xreal-voice-v10-core.apk`. Built against the REAL XREAL SDK 3.1.0
with the XREAL loader configured for Android. Camera OFF. 2026-07-22.

| Field | Value |
|---|---|
| package | com.shadowlens.xrealvoice |
| versionName | 0.10-xreal-core |
| size | 128,140,499 bytes (~128 MB) |
| sha256 | 9efadf0af13fa6feef6e6470e448b4f4c6d6b062ecbc5b4e39f78b4b7b025d4e |
| minSdk / targetSdk | 29 / 34 |
| native-code | arm64-v8a only |
| debuggable | absent (release) |
| loader | XREALXRLoader assigned to Android (InitOnStart) — see XR_LOADER_CONFIGURATION.md |
| compile symbols | SHADOW_XREAL_SDK set; **SHADOW_XREAL_CAMERA NOT set** (asserted by the build) |
| permissions | INTERNET + HIGH_SAMPLING_RATE_SENSORS + FOREGROUND_SERVICE (all XREAL-justified) |
| camera / microphone | **absent** (camera path gated off for the core) |
| scenes | ShadowV8Demo (guided-story player + presenter + capability banner) |

Does NOT overwrite the V9 candidate (shadow-lens-xreal-voice-v8-candidate.apk, 135 MB, kept).
Status: **XREAL-CORE-APK-BUILT** — NOT installed, NOT device-validated (no device logs yet).

## Install + launch (connected Beam Pro)
```
# from repo root, with the device connected + authorized (adb devices shows 'device'):
bash device-test/v10/collect-device-info.sh
adb install -r apps/shadow-lens/unity/Build/Android/shadow-lens-xreal-voice-v10-core.apk
adb shell monkey -p com.shadowlens.xrealvoice -c android.intent.category.LAUNCHER 1
bash device-test/v10/launch-and-logcat.sh    # 90s logcat: grep XREALXRLoader / OnXRLoaderStart / GetTrackingType
```
Then follow device-test/v10/DEVICE_DAY_RUNBOOK_V10.md STAGE A→E and record in DEVICE_RESULT_V10.md.
