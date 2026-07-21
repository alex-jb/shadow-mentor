# Local toolchain report (B1)

Two hosts now matter: the **Claude build host** (Node only) and **Alex's macOS machine**
(has Unity 6). Native compilation happens on Alex's machine, not the Claude host.

| Tool | Claude build host | Alex's macOS |
|---|---|---|
| Node.js | ✅ v24.14.1 | ✅ |
| Unity Hub / Editor | ❌ not found | ✅ **Unity 6.0.0.23f1 — project COMPILES + enters Play Mode (2026-07-20)** |
| Java / JDK (`java`,`javac`) | ❌ not installed | (via Unity/Android toolchain) |
| Gradle | ❌ not found | (via Unity Android build) |
| Android SDK / `ANDROID_HOME` | ❌ not found | (Unity-managed, for APK) |
| `adb` | ❌ not found | — |
| `dotnet` | ❌ not found | (Unity's own compiler used) |

**Update 2026-07-20:** Alex confirmed the Unity C# core COMPILES and enters Play Mode in
Unity 6.0.0.23f1. That promotes the Unity C# core from NOT-COMPILED → **COMPILED (local
toolchain)**.

**Update 2026-07-21 — Android AARs are now COMPILED (CI):** `shadow-lens-android.yml` builds
the OCR + Voice/TTS AARs (debug + release) on a hosted `ubuntu-latest` runner — real `.aar`
artifacts + SHA-256 in `apps/shadow-lens/docs/ANDROID_AAR_BUILD.md`. No `UNITY_LICENSE` needed.

**Android APK / Eye / XREAL — operator toolchain check required.** A compiling desktop project
does NOT imply the Mac Unity has Android Build Support. Before building the mock Android APK, run
`bash scripts/check-unity-android.sh` on the Unity machine — it verifies Android Build Support,
Android SDK, NDK, OpenJDK, adb, and IL2CPP Android support, and prints exact install steps for any
missing module. The APK build, Eye capture, and XREAL SDK adapters remain DEVICE-VALIDATION-PENDING
(and, for the APK, blocked on the operator's Android modules being installed).

## Consequence (honest scope of Part B)

- **The Android AARs cannot be compiled or Gradle-tested here** (no Java/Gradle/Android
  SDK) — contrary to the "build the AAR even without Unity" path, that path is also
  blocked. Their Kotlin + Gradle + manifest are written as **SOFTWARE IMPLEMENTED,
  NOT-COMPILED**, with a CI workflow that will build+test them where a JDK + Android SDK
  exist.
- **The Unity C# cannot be compiled** (no Unity, no dotnet). Written as **SOFTWARE
  IMPLEMENTED, LOCAL UNITY COMPILE NOT EXECUTED**, structured so the Unity Editor can run
  the Editor/mock path once the SDK is imported.
- **Nothing native is DEVICE-VALIDATED.** Eye capture, One Pro 6DoF, on-device OCR/voice,
  APK install — all **DEVICE-VALIDATION-PENDING**.

Everything in `apps/shadow-lens/{contracts,backend}` + `api/shadow-lens-analyze.js` IS
real + TESTED here (Node, in `npm test`). The four-word status vocabulary
(IMPLEMENTED / TESTED / DEVICE-VALIDATED / STAGE-READY) is applied per component in
`CAPABILITY_MATRIX.md`.
