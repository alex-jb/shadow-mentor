# Local toolchain report (B1)

Detected on the build host 2026-07-20 (`command -v` + version probes):

| Tool | Status |
|---|---|
| Node.js | ✅ v24.14.1 |
| Java / JDK (`java`,`javac`) | ❌ not installed |
| Gradle | ❌ not found |
| Android SDK / `ANDROID_HOME` | ❌ not found |
| `adb` | ❌ not found |
| Android NDK | ❌ not found |
| Unity Hub / Editor | ❌ not found |
| `dotnet` | ❌ not found |

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
