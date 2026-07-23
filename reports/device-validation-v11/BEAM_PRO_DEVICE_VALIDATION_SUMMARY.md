# Beam Pro device validation — summary

**Status: PREPARED, NOT YET PHYSICALLY VALIDATED.** This automated environment has **no Beam Pro
attached** (`adb devices` empty) and **the XREAL SDK is not imported** (`scriptingDefineSymbols {}`),
so the candidate cannot be built or run here. All physical/device flags stay FALSE and must be set
only by Alex after running the on-device checklist. Nothing device-side is fabricated.

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

**FALSE (blocked — not fabricated):**
BEAM-PRO-CONNECTED (no adb device) · BEAM-PRO-INVENTORIED · V11-CANDIDATE-APK-BUILT (blocked on XREAL
SDK import) · V11-CANDIDATE-APK-INSTALLED · V11-CANDIDATE-FIRST-LAUNCH-PASSED ·
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
