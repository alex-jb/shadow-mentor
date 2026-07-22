# Shadow — full project handoff prompt (2026-07-22)

Copy this whole file into a fresh session to continue with full context. It describes what Shadow is,
every phase shipped, the exact repo/branch/hash state, the hard rules, and what remains (all
device-blocked).

---

## What Shadow is

Shadow is a **cryptographic-evidence + independent-audit layer for AI decisions**, demonstrated with a
banking compliance council. The product thesis: an AI decision should carry a tamper-evident, signed
provenance chain that a third party can verify offline — and the verifier proves **integrity, not
correctness** (a green chain never means the decision was right). Surfaces:

- **Guided-story engine** — one canonical semantic contract (`shadow-guided-story-v1`) compiled by a
  deterministic tool into HTML/SVG, Three.js, and Unity renderers that all share the SAME semantic hash.
- **Offline HTML verifier** (frozen), self-contained explainer animations (audit-chain, reason-code
  attestation, persona deliberation), CSP-safe + bilingual (EN/中文).
- **Unity + XREAL (Beam Pro / One Pro / Eye) spatial app** — device-capability model (fail-closed),
  guided-story player, Presenter Mode, evidence-capture pipeline, and a native voice layer.
- **Voice UX V2** — provider-independent spoken-language pipeline (planner → pronunciation → prosody →
  TTS adapter → interruptible queue → safe voice router).

Repo: `github.com/alex-jb/shadow-mentor` (private). Working tree:
`~/Desktop/AI-Projects/shadow-mentor-story-adapters` (isolated worktree; `node_modules` symlinked).
Unity project: `apps/shadow-lens/unity` (Unity **6000.0.23f1**).

---

## Current state (verified 2026-07-22)

- **Node test suite: 1,940 total · 1,937 passed · 3 skipped · 0 failed.** Pure `node:test`, stdlib only.
  Run: `node scripts/run-tests.mjs`. Guard: `node scripts/check-forbidden-phrases.mjs` (clean, 1,640+ files).
- **Never merged to main. Never published npm. Nothing production-signed.**
- **Stable fallback APK unchanged:** `apps/shadow-lens/demo/wednesday/frozen/mock-stable-5168b07.apk`
  sha256 `93f2a81aa5f965aec540526abe621b152c7507c03c0fea51d381094bd548d0b8`.
- **Frozen verifier:** `verify.html` sha256 `c478b46f42d0a9aea407a68a14178ffd638ba608b8972c806bd612c9f7d0d6bc`.
- **Fixture release-key fingerprint (NOT production):** `727d29d3204231f7`.
- **All branches pushed to origin (nothing unpushed).**

### Phase branches (each = one bounded slice, all on origin)
| Branch | HEAD | Phase |
|---|---|---|
| `feat/shadow-shared-story-adapters` | `92e3416` | Step 4 — shared story contract → HTML/Three.js/Unity adapters + cross-engine parity |
| `feat/shadow-device-ready-v5` | `f11b34b` | Device-ready productization + Three.js perf + capability model |
| `feat/shadow-xreal-native-v6` | `851bb4b` | XREAL loader-state model + evidence-capture fixture pipeline |
| `feat/shadow-voice-ux-v7` | `ec65721` | Voice UX V2 spoken-language pipeline + real comparison audio |
| `feat/shadow-xreal-voice-device-v8` | `eefc2ff` | XREAL+Voice integration + V8 candidates + **real SDK 3.1.0 typed adapters (V9 work continued on this branch)** |
| `feat/shadow-xreal-device-validation-v10` | `085ac36` | **Current.** XR loader configured + V10 core device candidate |

---

## What each phase actually shipped (with evidence)

**Step 4 (shared story):** `lib/shadow-semantic-vocabulary.mjs` (13 statuses, 15 trust dimensions,
forbidden mappings), `schemas/shadow-guided-story-v1.schema.json`, `tools/compile-shadow-guided-story.mjs`
(deterministic, fail-closed, cross-target semantic hash), HTML/Three.js/Unity adapters. Unity EditMode
11/11 + PlayMode 3/3. Cross-engine parity: html/threejs/unity/snapshot share one hash.

**V5 (device-ready):** capability model (`Assets/ShadowLens/Device/`) — fail-closed detector, 8 session
states, tracking state machine; input arch (canonical actions + safety router: passive→Focus only,
destructive→separate Confirm); Presenter Mode + failure recovery; **guided-story Android candidate built**
(ARM64/IL2CPP). Three.js perf measured (render-on-demand, adaptive DPR, disposal). Deep research
(XREAL/Unity6/Three.js, official sources). EditMode 19/19 + PlayMode 4/4.

**V6 (XREAL native + evidence):** `ShadowXrealLoaderState` (8-phase, tracking gated on LOADER_STARTED),
**`ShadowEvidenceCapturePipeline`** — frame validation (zero-byte/black/duplicate/monotonic-ts) → SHA-256
→ OCR → source map → user confirm → seal → independent verify (fixture-tested). Base candidate INTERNET
permission removed at source (Unity engine default → custom manifest `tools:node="remove"`). EditMode 27/27.

**V7 (Voice UX V2):** provider-independent pipeline in `lib/voice/*.mjs` — planner (evidence-first,
progressive disclosure, bilingual, semantic-preserving) → pronunciation lexicon → deterministic prosody
→ `shadow-spoken-utterance-v1` (SSML-free, untrusted-safe) → safe voice router → priority queue + barge-in.
**Real comparison audio (macOS say, desktop FIXTURE): en 40.3s→10.5s (−74%), zh 55.2s→12.9s (−77%)** —
measured engineering evidence, NOT a naturalness claim. Unity mirror EditMode 7/7. TTS-only Android
candidate (no INTERNET/mic/camera).

**V8 (XREAL+Voice integration):** `ShadowVoiceRuntimeBridge` — the ONE mapping device→voice
(TRACKING_LOST→P0 interrupt, APP_PAUSED→discard, LANGUAGE_CHANGED→clear old locale,
DEVICE_VALIDATION_PENDING→never "validated"). Base voice V8 candidate. EditMode 16/16.

**V9 (real SDK — on the v8 branch):** the official **XREAL SDK 3.1.0** (`com.xreal.xr`, sha256
`fd7d0fce…`, 248 MB) imports + compiles here once `com.unity.modules.imageconversion` is added.
`Unity.XR.XREAL.dll` builds 0 CS errors. **8 typed adapters** (`Assets/ShadowLens/Xreal/`, gated by
`SHADOW_XREAL_SDK`) against the REAL API (`XREALPlugin.GetTrackingType()`→MODE_6DOF/3DOF/0DOF,
`GetDevicePoseFromHead`, `XREALXRLoader`+`OnXRLoaderStart/Stop`, `XREALRGBCamera`). 6DoF NEVER claimed
from the reported type alone. **XREAL+Voice candidate built** (135 MB, minSdk 29). Camera behind a second
gate `SHADOW_XREAL_CAMERA` (off). Operator-local install via `scripts/setup-local-xreal-sdk.sh` (SDK never
committed). Regression guards prevent committing the SDK/absolute path.

**V10 (device validation prep):** **XR loader configured reproducibly** (`ShadowXrealLoaderConfig` via
official XR Management editor APIs) — `XREALXRLoader` assigned to Android + Init-on-Startup, Standalone
none. **V10 core candidate built** (`com.shadowlens.xrealvoice` v0.10-xreal-core, **128 MB**, minSdk 29,
sha256 `9efadf0a…`, camera OFF, no camera/mic). Device harness `device-test/v10/` (install-order,
launch-and-logcat, DEVICE_DAY_RUNBOOK STAGE 0–G, result template). Clean-clone verified (SDK removed →
EditMode 29/29, 0 CS errors, base builds).

### Local build artifacts (gitignored, on Alex's disk)
- `shadow-lens-voice-v8-base.apk` (24.7 MB, TTS-only, no INTERNET/mic/camera)
- `shadow-lens-xreal-voice-v8-candidate.apk` (135 MB, V9 XREAL+Voice)
- `shadow-lens-xreal-voice-v10-core.apk` (128 MB, V10 core, camera OFF) — sha256 `9efadf0a…`

---

## Hard rules (carry verbatim into any continuation)

- **Never** merge to main · publish npm · production-sign · commit API keys · overwrite the stable APK
  (`93f2a81a…`) or the frozen verifier · commit the licensed XREAL SDK tarball / PackageCache / an
  absolute `/Users/.../Downloads` SDK path.
- **Never** use NRSDK 2.x / `NRKernal` (the project uses the real `com.xreal.xr` 3.1.0 API); never guess
  XREAL API names — read the imported SDK.
- **Never** enable unsupported XREAL features on One-series: plane / image / hand tracking, depth mesh,
  spatial anchors (officially unsupported — fail closed).
- **Never** claim device/Eye/6DoF/RGB/OCR/Beam-Pro/naturalness results without real device logs/samples;
  6DoF needs BOTH the SDK-reported mode AND observed positional translation.
- **Never** let voice/hover/head-direction/dwell approve, sign, delete, or confirm a regulated action —
  those need an explicit non-voice Confirm.
- **Never** bend guided-story semantics for naturalness (VERIFIED/FAILED/WARNING/NOT_EVALUATED,
  first-failure, downstream, verbatim quotes, abstention/contradiction, limitations are preserved
  exactly; majority ≠ correctness; analytical correctness is always NOT_EVALUATED).
- Treat all story/utterance JSON as untrusted (caps, closed enums, `__proto__` rejection, no executable
  markup). Reply to Alex in Chinese. Run `npm`/`node` build + tests locally before any push.
- Cross-engine parity + the semantic hash must stay green; the fixture fingerprint `727d29d3204231f7`
  is FIXTURE, never described as production.

---

## What remains — ALL device-blocked (no hardware access in-session)

The V10 core candidate is built and the install/launch/logcat commands + STAGE runbook are ready. When
the **Beam Pro + One Pro + XREAL Eye** are connected, run (do not write another plan):
```
bash device-test/v10/collect-device-info.sh          # model/battery/storage/firmware; adb devices == 'device'
bash device-test/v10/install-order.sh                # stable → base voice → XREAL core (separate package ids)
bash device-test/v10/launch-and-logcat.sh            # 90s logcat; grep XREALXRLoader / OnXRLoaderStart / GetTrackingType
# then follow device-test/v10/DEVICE_DAY_RUNBOOK_V10.md STAGE A→E, record in DEVICE_RESULT_V10.md
```
Device statuses that only real evidence can upgrade: ANDROID-INSTALLED · BEAM-PRO-SMOKE-TESTED ·
XREAL-LOADER/3DOF-VALIDATED · BEAM-PRO-INPUT · RECENTER · TRACKING-RECOVERY · EYE-DETECTED ·
XREAL-EYE-6DOF · EN/ZH-TTS · BARGE-IN-DEVICE-MEASURED · CAMERA-CANDIDATE-BUILT · RGB-FRAME · OCR-DEVICE ·
DEVICE-PERFORMANCE · DEVICE-MEDIA · INTERNAL-LISTENING/USER-STUDY · PRODUCTION-READY.

**Reproduce the XREAL/V10 build (operator, needs the SDK tarball at `~/Downloads/com.xreal.xr.tar.gz`):**
```
scripts/setup-local-xreal-sdk.sh ~/Downloads/com.xreal.xr.tar.gz   # prints the local manifest line to add
# Unity: -executeMethod ShadowLens.EditorTools.ShadowXrealDefineSetup.Set
#        -executeMethod ShadowLens.EditorTools.ShadowXrealLoaderConfig.ConfigureAndroid
#        -executeMethod ShadowLens.EditorTools.ShadowV10CoreBuild.BuildCI
```
The committed tree builds the base WITHOUT any of this (the Xreal assembly is `defineConstraints`-gated).

## Where to read more
Per-phase status docs in `docs/`: `SHADOW_SHARED_STORY_ARCHITECTURE.md`, `SHADOW_CROSS_ENGINE_PARITY.md`,
`SHADOW_DEVICE_READY_V5_SUMMARY.md`, `SHADOW_XREAL_NATIVE_V6_STATUS.md`, `SHADOW_VOICE_UX_V2_STATUS.md`,
`SHADOW_XREAL_VOICE_DEVICE_V8_STATUS.md`, `SHADOW_XREAL_NATIVE_V9_STATUS.md`,
`SHADOW_DEVICE_VALIDATION_V10_STATUS.md`, `UNITY_XREAL_BUILD_RUNBOOK.md`. Reports in `reports/*`.
