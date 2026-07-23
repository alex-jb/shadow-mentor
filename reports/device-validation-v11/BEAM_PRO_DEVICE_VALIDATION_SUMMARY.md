# Beam Pro device validation — summary

**Status: CANDIDATE APK BUILT (autonomously); PHYSICAL DEVICE TESTS PENDING ALEX.** The XREAL SDK was
found locally (`~/Downloads/package`, com.xreal.xr 3.1.0), imported into the project (operator-local,
NOT committed), and the V11 candidate **built successfully**. But this automated environment has **no
USB access** (`system_profiler` shows 0 USB devices — sandboxed), so install / logcat / on-glasses
3DoF / controller / OST / soak still require Alex on real hardware. All *device* flags stay FALSE;
only the *build* is now true. Nothing device-side is fabricated.

## Candidate APK (BUILT)
| Field | Value |
|---|---|
| File | `apps/shadow-lens/unity/Build/Android/shadow-lens-v11-beampro-candidate-01.apk` (local; gitignored) |
| SHA-256 | `8ea859df77dfeb87a06d065f11028105b52beae18fac76d6202eb1294c92e048` |
| Size | 128,213,719 bytes |
| Package | com.shadowlens.xrealvoice · versionName 0.11-beampro-candidate.1 · versionCode 111 |
| ABI / scripting | arm64-v8a · IL2CPP · minSdk 29 / target 34 |
| Camera / Eye | OFF / OFF · production-signed: false |
| Default view | ShadowAuditWorkspace (device bootstrap, Banking fixture) |
| XREAL SDK | com.xreal.xr 3.1.0 imported from tarball (operator-local, NOT committed) |
| Stable APK | `shadow-lens-xreal-voice-v10-core.apk` = `9efadf0a…` — UNCHANGED, not overwritten |

**Operator-local (intentionally NOT committed):** `Packages/manifest.json` (file: SDK ref),
`Packages/packages-lock.json` (xreal pin), `ProjectSettings/ProjectSettings.asset` (SHADOW_XREAL_SDK
define). These are left modified-but-unstaged so the project stays rebuild-ready; do not commit them
(the base candidate must build without the SDK).

## What was done here (autonomous, verifiable)
- **Stable APK preserved** — `shadow-lens-xreal-voice-v10-core.apk` (SHA-256 `9efadf0a…`, 128 MB) is
  untouched; inventory in `STABLE_AND_CANDIDATE_APK_INVENTORY.md`.
- **Candidate build infrastructure authored + compiled** (EditMode 136/136):
  - `ShadowAuditWorkspaceDeviceBootstrap` — instantiates the REAL `ShadowAuditWorkspace` as the default
    device view, binds the Banking fixture (decision=FIRST_FAILURE, pricing=AFFECTED_DOWNSTREAM),
    session-relative (3DoF-friendly), Prev/Next/Select/lang/reset input, camera OFF.
  - `ShadowV11BeamProCandidate` build script — distinct output
    `shadow-lens-v11-beampro-candidate-01.apk`, versionName `0.11-beampro-candidate.1`, versionCode 111,
    package kept (`com.shadowlens.xrealvoice`), IL2CPP/ARM64/minSdk29, camera OFF, requires XREAL SDK.
- **Build attempted** → failed honestly at the SDK gate (`build/build-summary.json`,
  `build/build-log-excerpt.txt`): `requires the official XREAL SDK import + SHADOW_XREAL_SDK … NOT
  building a placeholder.` No placeholder APK was produced. The stable APK was NOT overwritten.
- **Device-validation scaffolding** prepared for physical execution: 3DoF / controller / tracking / OST
  CSV matrices (all rows NOT_TESTED) + inventory + this summary.

## §16 flags (honest)
True: none device-side. Verifiable-here truths: STABLE-APK-UNCHANGED ✅, FROZEN-VERIFIER-UNCHANGED ✅
(c478b46f), SEMANTIC-HASHES-UNCHANGED ✅, candidate build script + bootstrap authored & compile (EditMode
136/136).

**TRUE (build side):** V11-CANDIDATE-APK-BUILT ✅ (8ea859df…, XREAL SDK 3.1.0 integrated, AuditWorkspace
default, camera OFF) · STABLE-APK-UNCHANGED ✅ (9efadf0a).

**FALSE (blocked on physical hardware — not fabricated):**
BEAM-PRO-CONNECTED (no USB in this sandbox) · BEAM-PRO-INVENTORIED · V11-CANDIDATE-APK-INSTALLED ·
V11-CANDIDATE-FIRST-LAUNCH-PASSED ·
AUDIT-WORKSPACE-RENDERED-ON-BEAM-PRO · XREAL-3DOF-DEVICE-VALIDATED · BEAM-PRO-CONTROLLER-DETECTED ·
BEAM-PRO-CONTROLLER-VALIDATED · RECENTER-DEVICE-VALIDATED · TRACKING-FALLBACK-DEVICE-VALIDATED ·
CURRENT-FOCUS/FIRST-FAILURE-DEVICE-READABLE · DOWNSTREAM-DEVICE-DISTINCT · REVIEW-APPROVAL-DEVICE-DISTINCT
· CHINESE-DEVICE-READABLE · OST-*-PASSED · OST-READABILITY-DEVICE-VALIDATED · FIFTEEN/THIRTY-MINUTE-SOAK
· DEVICE-LOGS-CAPTURED · THROUGH-THE-LENS-EVIDENCE-CAPTURED.

**FALSE (no physical proof — unchanged):** XREAL-EYE-DETECTED · XREAL-EYE-6DOF-DEVICE-VALIDATED ·
VOICE/TTS/CAMERA/OCR-DEVICE-VALIDATED · DEVICE-PERFORMANCE-MEASURED · FORMAL-USER-STUDY-COMPLETED ·
PRODUCTION-FLOW-INTEGRATION · FLOW-PARTNERSHIP-CONFIRMED · PRODUCTION-READY.

## Two blockers Alex must clear (in order)
1. **Import the XREAL SDK** into `apps/shadow-lens/unity` (sets `SHADOW_XREAL_SDK`) —
   see `docs/UNITY_XREAL_BUILD_RUNBOOK.md`. Then build:
   `Unity -batchmode -nographics -projectPath apps/shadow-lens/unity -executeMethod ShadowLens.EditorTools.ShadowV11BeamProCandidate.BuildCI`
2. **Attach the Beam Pro** (USB debugging on) and run `BEAM_PRO_DEVICE_RUNBOOK.md`.

Until both are done on Alex's hardware, this increment is PREPARED, not VALIDATED.

## UPDATE — candidate-02 (LAUNCHABLE) supersedes candidate-01 for install
candidate-01 installed but was **not launchable** (device: no MAIN/LAUNCHER, UnityPlayerActivity not
exported). **candidate-02** fixes it (stash offline manifest → default launcher manifest;
application-label "Shadow Lens"; post-build aapt launchability assertion PASSED). Install
`shadow-lens-v11-beampro-candidate-02.apk` (SHA-256 `6ee4d4ff…`, vc112). candidate-01 preserved as
failed evidence. See DEVICE_CANDIDATE_HISTORY.md. First-launch success NOT yet claimed — pending Alex.
