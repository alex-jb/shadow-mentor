# Shadow Lens — Capability Matrix

Four-state vocabulary. Nothing hardware-dependent is marked past DEVICE-VALIDATED without
a device report. Build host had Node only (no Java/Gradle/Android SDK/Unity) — see
`LOCAL_TOOLCHAIN_REPORT.md`.

| Component | IMPLEMENTED | TESTED (CI) | DEVICE-VALIDATED | STAGE-READY |
|---|---|---|---|---|
| Session contract + validator + resolveClaims gate | ✅ | ✅ | n/a | ✅ |
| Backend input guards (magic-byte, size, injection boundary) | ✅ | ✅ | n/a | ✅ |
| Source-bound analysis (gate, coverage, provenance) | ✅ | ✅ | n/a | ✅ |
| Session builder (real attest-core seal + verify + tamper) | ✅ | ✅ | n/a | ✅ |
| HTTP pipeline `/api/shadow-lens-analyze` (guards, CORS, fixture+live) | ✅ | ✅ | n/a | ✅ |
| Flow real-session export (3 scenes, real/fixture tagged) | ✅ | ✅ | n/a | ✅ |
| Android OCR AAR (ML Kit Kotlin bridge + Gradle) | ✅ | ❌ NOT-COMPILED (CI dispatch) | ❌ pending | ❌ |
| Android Voice/TTS AAR (SpeechRecognizer on-device + TTS) | ✅ | 🟡 pure JVM router test (device path NOT-COMPILED) | ❌ pending | ❌ |
| Gradle multi-module (settings + wrapper + CI dispatch) | ✅ | ❌ needs SDK runner | n/a | ❌ |
| Unity C# core (providers, mocks, API client, voice router) | ✅ | ❌ NO UNITY COMPILE | ❌ pending | ❌ |
| Unity spatial UX (panels, source overlay, audit arc) | 🟡 interfaces only | ❌ | ❌ pending | ❌ |
| Eye RGB capture (GPU readback + official still) | 🟡 interface + spec | ❌ | ❌ pending | ❌ |
| One Pro 6DoF session-relative placement | 🟡 interface | ❌ | ❌ pending | ❌ |
| On-device OCR / voice on hardware | ❌ | ❌ | ❌ pending | ❌ |
| APK build + install | ❌ | ❌ | ❌ pending | ❌ |
| Quest WebXR audit-room (preflight) | ✅ | ✅ (logic) | ❌ pending | ❌ |

**REAL + TESTED here:** contract, input guards, source-bound analysis, session builder,
HTTP pipeline, signed bundle + verification, Flow exports. **IMPLEMENTED, NOT-COMPILED:**
Android OCR AAR, Unity C# core. **DEVICE-VALIDATION-PENDING:** everything requiring the
XREAL/Quest hardware or the Android/Unity toolchain.
