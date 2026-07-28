# XREAL+Voice candidate — static APK audit (Phase 9)

APK: `Build/Android/shadow-lens-xreal-voice-v8-candidate.apk` (RELEASE). Built against the REAL
imported XREAL SDK 3.1.0. Audited with aapt (build-tools 34.0.0). 2026-07-22.

| Field | Value | Verdict |
|---|---|---|
| package | com.shadowlens.xrealvoice | ✅ distinct candidate id |
| versionName | 0.8-xreal-voice | ✅ |
| apk size | 134,926,402 bytes (~135 MB) | includes XREAL native libs |
| apk sha256 | 78f2d62e8c1f39646898e02d6077a68b167b33e94c3d5aa5dd9761551a894de2 | |
| minSdk | 29 | ✅ required by XREAL AARs (nr_loader=26, xreal-auto-log=29) |
| targetSdk | 34 | ✅ |
| native-code | arm64-v8a only | ✅ |
| debuggable | absent | ✅ release build |
| XREAL native libs | libXREAL*/libnr*/libQnn*/libGenie present | ✅ real SDK bundled |

## Permissions (every one XREAL-justified)
- package: com.shadowlens.xrealvoice
- uses-permission: name='android.permission.INTERNET'
- uses-permission: name='android.permission.HIGH_SAMPLING_RATE_SENSORS'
- uses-permission: name='android.permission.FOREGROUND_SERVICE'
- permission: com.shadowlens.xrealvoice.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION
- uses-permission: name='com.shadowlens.xrealvoice.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'

- **INTERNET**: required by the XREAL SDK AARs (this is the XREAL candidate, NOT the offline base — the
  base candidate strips INTERNET; this one legitimately needs it).
- **HIGH_SAMPLING_RATE_SENSORS**: XREAL head-tracking sensors.
- **FOREGROUND_SERVICE**: XREAL session/glasses service.
- **NO CAMERA / NO RECORD_AUDIO**: the camera path is gated behind SHADOW_XREAL_CAMERA (not in this
  build) and voice is TTS-only → neither permission is present. Camera stays runtime-gated for a
  device/Eye bring-up build only.

## Status
**XREAL-VOICE-APK-BUILT** — built against the real SDK. NOT **BEAM-PRO-VALIDATED** (needs the device).
