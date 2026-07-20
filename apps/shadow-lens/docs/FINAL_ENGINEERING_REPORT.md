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

## Status vocabulary (strict)
- **REAL AND TESTED** — runs in `npm test` on this host.
- **COMPILED** — only if CI or a local toolchain produced an artifact. Nothing native qualifies yet.
- **SOURCE AUTHORED / BUILD CONFIGURED / NOT COMPILED / DEVICE VALIDATION PENDING** — the ladder
  for Unity + Android. Source is written and the build is configured; it has NOT been compiled
  in a Unity/Android toolchain here, and possible issues remain (XREAL SDK class/namespace
  mismatch, Unity/package version conflicts, Manifest merge, ML Kit dep conflicts, min/target SDK
  or Gradle mismatch, JNI thread rules, SpeechRecognizer main-thread creation, R8/ProGuard
  stripping the bridge classes). Only a green build promotes these to COMPILED.
- **DEVICE-VALIDATION-PENDING** — needs XREAL One Pro + Eye / Quest hardware.
- **CREDENTIAL-BLOCKED** — needs a secret (e.g. `UNITY_LICENSE`, live LLM key) to run.
- **FIXTURE-ONLY** — exercised with fixtures, not live providers.

## Six-category status (2026-07-20)

**REAL AND TESTED (Node, `npm test` — 1651/0):** session contract + validator + resolveClaims
gate · input guards (magic-byte, size, injection boundary) · source-bound analysis · session
builder (real attest-core seal + verify + tamper) · one-shot `/api/shadow-lens-analyze` +
`/api/shadow-lens/run` · staged lifecycle (version/idempotency/pristine/serverless-boundary
guards) · restart-safety · Flow real-session export · contract-drift fingerprint · reproducible
acceptance package · web client honest-mode labels · spatial geometry (also EditMode NUnit).

**COMPILED (local toolchain):** Unity C# core — compiles + enters Play Mode in Unity 6.0.0.23f1
(Alex, 2026-07-20).

**IMPLEMENTED BUT NOT COMPILED:** the mock-scene idempotency + visible-render fix (newly authored,
pending Alex's regenerate + Play) · Android OCR AAR · Android Voice/TTS AAR (built by
`shadow-lens-android.yml` on a hosted runner) · Unity Edit/PlayMode test execution.

**DEVICE-VALIDATION-PENDING:** Eye RGB capture, One Pro 6DoF (needs the Eye), session-relative
placement, on-device OCR/voice, APK install, Quest WebXR AR.

**CREDENTIAL-BLOCKED:** live source-bound analysis (`ANTHROPIC_API_KEY`) · Unity EditMode/PlayMode
CI (`UNITY_LICENSE`).

**FIXTURE-ONLY:** the acceptance package + demos run on the sanitized fixture document with an
ephemeral demo key; no live LLM, no real customer document.

## Honest headline
The full evidence backbone — capture-metadata → source-map → source-bound analysis → signed
bundle → verify → staged/one-shot HTTP → Flow — is REAL and TESTED and reachable over HTTP.
The native client (Unity + AARs) is **SOURCE AUTHORED · BUILD CONFIGURED · NOT COMPILED ·
DEVICE VALIDATION PENDING** — no Unity/XREAL completion or compile is claimed without a build
artifact + device evidence.
