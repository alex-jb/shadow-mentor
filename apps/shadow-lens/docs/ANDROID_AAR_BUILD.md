# Shadow Lens Android AARs — build record

**Status: COMPILED** (real artifacts produced by CI, not a code-inspection claim).

Built on a GitHub-hosted `ubuntu-latest` runner by `.github/workflows/shadow-lens-android.yml`
(self-installs JDK 17 + Android SDK platform android-34 + build-tools 34.0.0, accepts licenses,
Gradle 8.9, runs the pure-JVM voice router test, assembles debug + release AARs, computes SHA-256,
emits `build-report.json`, uploads artifacts). No `UNITY_LICENSE` required.

## CI-verified artifacts (commit `22a1e1b`, run 29796063905)

| AAR | SHA-256 | bytes |
|---|---|---|
| `ocr-aar-debug.aar` | `e5bb1861a544a5e5ef67289a1e464975e36f425f38005f514c752dc4bca96def` | 8524 |
| `ocr-aar-release.aar` | `1aa41c25ddc2b4c331f6b1666682527aa1ae568ce4471bfda4db23f50c5f0500` | 8230 |
| `voice-aar-debug.aar` | `0a1bb0ae5b70a9e72ad651ce3ba6728ff49f52d6702f7bdebef28428e5daa247` | 7499 |
| `voice-aar-release.aar` | `cdb78be3c3f6ed12b3f1501cfd04fdd2b03a0608af92f1e68906d0c2d2885b9f` | 7249 |

JVM tests (voice router, no device): **passed**. The SHA-256s change with the source; re-download
the run artifact to re-verify.

## What COMPILED does and does NOT mean

- **COMPILED**: the Kotlin sources + Gradle config compile to valid `.aar` libraries on a real
  Android toolchain; the pure-JVM voice router test passes.
- **NOT** device-validated: ML Kit OCR + on-device SpeechRecognizer need a real Android device (an
  APK on hardware) — that remains DEVICE-VALIDATION-PENDING.

## Consuming the AARs in Unity

Drop the release `.aar`s into `apps/shadow-lens/unity/Assets/Plugins/Android/` for the Android/XREAL
build. The AndroidBridge C# providers (`AndroidOcrProvider` / `AndroidVoiceProvider`, behind the
platform guards) call into them over JNI.
