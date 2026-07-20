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
- ~25 new tests; full suite green (baseline 1614 preserved + extended).

## IMPLEMENTED BUT NOT COMPILED (no Java/Gradle/Android SDK/Unity on the build host)
- Android OCR AAR: real Kotlin ML Kit v2 bridge (Block/Line boxes + corners + confidence +
  language → contract source_map JSON) + Gradle + manifest. Build where a JDK + Android SDK
  exist; CI workflow committed (gated on a runner).
- Unity C# core: provider interfaces (tracking/capture/OCR/voice/TTS/placement), mock
  providers (Editor path), closed-enum voice router (never LLM-routed), API client + request
  builder, contract models. Project opens (Packages/manifest.json + ProjectSettings + asmdef);
  XREAL SDK imported from tarball per the runbook (not committed — licensing).

## STILL TO WRITE (software, next)
- Android Voice/TTS AAR (spec'd), Unity spatial UX MonoBehaviours (glance strip / document
  plane / source overlay / audit arc / cascade), Unity Edit/PlayMode test sources, the mock
  end-to-end scene, the web UI migration off worked-mock onto `/api/shadow-lens-analyze`.

## DEVICE-VALIDATION-PENDING (needs XREAL/Quest hardware + toolchain)
- Eye frame capture, One Pro 6DoF, session-relative placement, on-device OCR + voice, APK
  install, Quest WebXR AR. Procedure: `UNITY_XREAL_BUILD_RUNBOOK.md` +
  `DEVICE_ACCEPTANCE_CHECKLIST.md`.

## Honest headline
The full evidence backbone — capture-metadata → source-map → source-bound analysis →
signed bundle → verify → Flow — is REAL and TESTED and reachable over HTTP. The native
client (Unity + AARs) is written to be compile-ready but was neither compiled nor
device-validated here. No Unity/XREAL completion is claimed without compile + device evidence.
