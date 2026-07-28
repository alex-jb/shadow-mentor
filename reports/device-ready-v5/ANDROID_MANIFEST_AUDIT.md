# Guided Story Android Candidate — Manifest audit

APK: `Build/Android/shadow-lens-guided-story-v5-candidate.apk` (RELEASE build).
Audited with `aapt dump badging / permissions / xmltree` (Android build-tools 34.0.0). Accessed 2026-07-21.

| Field | Value | Verdict |
|---|---|---|
| package | `com.shadowlens.guidedstory` | ✅ candidate id, distinct from the stable mock (`com.shadowlens.lens`) |
| versionName | `0.5-guided-story-candidate` | ✅ deterministic |
| versionCode | 1 | ✅ |
| minSdkVersion | 24 | ✅ (≥ official min 23; Beam Pro is newer) |
| targetSdkVersion | 34 | ✅ current |
| compileSdkVersion | 34 | ✅ |
| native-code | `arm64-v8a` only | ✅ ARM64-only (no armeabi / x86) |
| debuggable | **absent** | ✅ release build is not debuggable |
| launch activity | `com.unity3d.player.UnityPlayerGameActivity`, `exported=true`, `launchMode=singleTask` | ✅ a launcher activity must be exported; standard Unity |
| second activity | `com.unity3d.player.UnityPlayerActivity`, `exported=false` | ✅ standard Unity, not exported |
| WebView | none | ✅ native rendering, no WebView |
| cleartext traffic | not applicable | the base candidate makes no network requests |

## Findings

1. **INTERNET permission is still declared** even though the base candidate makes no network
   requests. This is Unity's Android default (Internet Access = Auto). **Least-privilege
   recommendation:** ship a custom `Assets/Plugins/Android/AndroidManifest.xml` with
   `<uses-permission android:name="android.permission.INTERNET" tools:node="remove"/>` for a
   production release, or set Internet Access = "Not required" if the project never needs it. Filed,
   not blocking — the candidate is a fixture demo.
2. No camera / microphone / storage / location permissions are requested (correct — none are used).
   The XREAL candidate (separate build) would add `RECORD_AUDIO` + `FOREGROUND_SERVICE_MEDIA_PROJECTION`
   only if RGB recording is enabled, per official XREAL docs.
3. The only other permission is Unity's standard `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`
   (self-scoped, Android 13+ receiver export requirement) — benign.

No exported components beyond the required launcher were found. No content providers declared by app
code (Unity ships its own file provider for its needs).
