# Shadow Lens — engineering report (feat/shadow-lens-native)

## REAL AND TESTED (Node, in `npm test`)
- Session contract + validator + **resolveClaims** gate (claim citing a nonexistent
  source_id is rejected, never rendered) — `apps/shadow-lens/contracts`.
- Backend input guards: magic-byte PNG/JPEG (not Content-Type), 4.5MB cap, image hash,
  **prompt-injection boundary** (document text is fenced DATA, model cites source_ids only).
- Source-bound analysis: injectable LLM, resolvability gate, source coverage, provenance
  hashes (source_map / prompt / model).
- Session builder: seals a **real attest-core bundle** server-side, verifies, tamper fails
  at the exact seq.
- HTTP pipeline `POST /api/shadow-lens-analyze`: analyze→seal→verify + CORS allow-list +
  guards; fixture mode (offline, no key) + live Claude path.
- Flow real-session export: 3 scenes derived from a real session, each row real_or_fixture.
- **Staged session lifecycle** (create→capture→source-map→analyze→review→seal→verify) over
  an InMemory/File store + an **ephemeral HMAC request token** (request auth only, never the
  Ed25519 evidence key; constant-time verify + expiry). `POST /api/shadow-lens` dispatches the
  7 stages with the CORS allow-list and an honest `store: "in-memory-ephemeral"` flag.
- **Web client** (`apps/shadow-lens/web/lens-client.mjs`): honest `LensMode` labels
  (REAL SOURCE-BOUND / FIXTURE FALLBACK / API UNAVAILABLE / PROVIDER UNAVAILABLE); statuses
  kept separate, never one green badge.
- **Spatial geometry core** (`SpatialLayout.cs`, UnityEngine-free): source-overlay placement,
  audit arc, risk heights (clamped + floor), verification cascade, glance strip — covered by
  7 EditMode NUnit cases whose expected numbers were cross-checked in Node.
- ~60 new tests since baseline; full suite **1635/0** (+3 pre-existing skips).

## IMPLEMENTED BUT NOT COMPILED (no Java/Gradle/Android SDK/Unity on the build host)
- Android OCR AAR: real Kotlin ML Kit v2 bridge (Block/Line boxes + corners + confidence +
  language → contract source_map JSON) + Gradle + manifest.
- Android **Voice/TTS AAR**: on-device SpeechRecognizer (offline-preferred, honest network
  fallback flag), push-to-talk, TTS, and a pure JVM command router (`normalizeCommand`, 7
  JUnit cases) so document text can never route UI actions. Gradle multi-module
  (settings + wrapper) + CI (`shadow-lens-android.yml`) runs the JVM test + assembles both AARs.
- Unity C# core: provider interfaces, mock providers (Editor path), closed-enum voice router,
  API client + request builder, contract models.
- Unity **spatial UX MonoBehaviour** (`ShadowLensSceneController.cs`): thin wrapper composing
  providers + HTTP pipeline + the tested geometry into Look→Capture→…→Verify. CI
  (`shadow-lens-unity.yml`) runs the EditMode geometry tests via game-ci (UNITY_LICENSE-gated).

## STILL TO WRITE (Unity-runtime-blocked; low-integrity to author blind)
- The serialized `.unity` mock end-to-end scene and PlayMode tests (need the Unity Editor to
  author/serialize + a runtime to execute). The scan web UI already carries honest mock/real
  labels; the `LensMode` web client is the tested seam for a full swap when served with the app.

## DEVICE-VALIDATION-PENDING (needs XREAL/Quest hardware + toolchain)
- Eye frame capture, One Pro 6DoF, session-relative placement, on-device OCR + voice, APK
  install, Quest WebXR AR. Procedure: `UNITY_XREAL_BUILD_RUNBOOK.md` +
  `DEVICE_ACCEPTANCE_CHECKLIST.md`.

## Honest headline
The full evidence backbone — capture-metadata → source-map → source-bound analysis →
signed bundle → verify → Flow — is REAL and TESTED and reachable over HTTP. The native
client (Unity + AARs) is written to be compile-ready but was neither compiled nor
device-validated here. No Unity/XREAL completion is claimed without compile + device evidence.
