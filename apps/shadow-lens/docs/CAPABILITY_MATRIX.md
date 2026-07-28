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
| HTTP `/api/shadow-lens-analyze` (one-shot analyze→seal→verify) | ✅ | ✅ | n/a | ✅ |
| HTTP `/api/shadow-lens/run` (**authoritative** one-shot: full pipeline + Flow, serverless-safe) | ✅ | ✅ | n/a | ✅ |
| Staged lifecycle (store + ephemeral token; version/idempotency/pristine guards) | ✅ | ✅ | n/a | ✅ |
| Staged HTTP `/api/shadow-lens` (7 stages; refuses 501 `PERSISTENT_SESSION_STORE_NOT_CONFIGURED` w/o durable store) | ✅ | ✅ | n/a | 🟡 durable-store host |
| Flow real-session export (3 scenes, real/fixture tagged) | ✅ | ✅ | n/a | ✅ |
| Android OCR AAR (ML Kit Kotlin bridge + Gradle) | ✅ | ✅ **COMPILED (CI, debug+release .aar, SHA-256)** | ❌ pending (device OCR) | ❌ |
| Android Voice/TTS AAR (SpeechRecognizer on-device + TTS) | ✅ | ✅ **COMPILED (CI) + JVM router test green** | ❌ pending (device voice) | ❌ |
| Gradle multi-module build (hosted CI: licenses + platform + SHA-256 report) | ✅ | ✅ **runs on ubuntu-latest** | n/a | ✅ |
| Unity C# core (providers, mocks, API client, voice router) | ✅ | ✅ **COMPILED + Play Mode entered, Unity 6.0.0.23f1 (local, 2026-07-20)** | ❌ pending | ❌ |
| Spatial geometry (source overlay, audit arc, risk, cascade, glance) | ✅ | ✅ pure math, EditMode NUnit | n/a | ✅ math |
| Visible mock scene (HUD + document + buttons + state; idempotent singletons) | ✅ | 🟡 fix authored — pending Alex regenerate + Play Mode | ❌ pending | ❌ |
| Provider compile isolation (SHADOW_XREAL_SDK + platform guards; mock default) | ✅ | ✅ compiles in mock/editor mode | ❌ pending | ❌ |
| Runtime bootstrap + Editor scene generator (idempotent, no hand-authored .unity) | ✅ | 🟡 rewrite authored — pending Alex re-compile | ❌ pending | ❌ |
| Unity Edit/PlayMode tests (geometry + voice + mock e2e smoke) | ✅ authored | 🟡 run in Unity 6 to execute | ❌ pending | ❌ |
| Unity spatial-agent protocol (Gate 1: contract/validator/router/state machine/client) | ✅ | ✅ **COMPILED + 12/12 EditMode (Unity 6, local)** | ❌ pending | ❌ |
| Unity spatial-agent visual wiring (Gate 2: query bar/answer card/citations/profile selector) | ✅ | 🟡 authored — pending Alex regenerate + Play | ❌ pending | ❌ |
| Eye RGB capture (GPU readback + official still) | 🟡 interface + spec | ❌ | ❌ pending | ❌ |
| One Pro 6DoF session-relative placement | 🟡 interface | ❌ | ❌ pending | ❌ |
| On-device OCR / voice on hardware | ❌ | ❌ | ❌ pending | ❌ |
| APK build + install | ❌ | ❌ | ❌ pending | ❌ |
| Quest WebXR audit-room (preflight) | ✅ | ✅ (logic) | ❌ pending | ❌ |

**REAL + TESTED here:** contract, input guards, source-bound analysis, session builder,
HTTP pipeline, signed bundle + verification, Flow exports. **IMPLEMENTED, NOT-COMPILED:**
Android OCR AAR, Unity C# core. **DEVICE-VALIDATION-PENDING:** everything requiring the
XREAL/Quest hardware or the Android/Unity toolchain.
