# V10 device-day runbook (Beam Pro + One Pro + XREAL Eye)

Nothing here upgrades a status without a real recorded log/sample. Stop-and-fall-back rules:
device-test/v6/STOP_CONDITIONS.md + v8. Fill DEVICE_RESULT_V10.md as you go.

## STAGE 0 — hardware prep
1. Beam Pro charged >60%, system + MyGlasses updated, developer options + USB debugging ON.
2. Connect One Pro; attach XREAL Eye; complete any firmware update.
3. USB-connect Beam Pro; accept the ADB fingerprint. `adb devices` MUST show `device` (not unauthorized/offline).
4. `device-test/v10/collect-device-info.sh` → record model/android/abi/battery/storage/firmware.
   Do NOT assume Eye recognition from physical attachment — confirm via runtime capability later.

## STAGE 1 — install (safe order) : `device-test/v10/install-order.sh`
A. stable fallback (never overwritten) → launch → Banking flow → Verify/Tamper/Restore/Reset → record.
B. base voice (com.shadowlens.voice.base) → launch → EN + ZH → detect Android TTS engine → Back/Reset interrupt.
C. XREAL V10 core (com.shadowlens.xrealvoice) → install → `launch-and-logcat.sh` (90s log). Camera stays OFF.

## STAGE A — app + loader (grep log for XREALXRLoader / OnXRLoaderStart / loader phase)
launches · no crash · scene loads · loader reaches STARTED · glasses detected · pause/resume · exit · relaunch ·
no repeated init · 2D fallback available. Capture loader start ts + transitions + SDK errors + logcat + Shadow diag.
→ ANDROID-INSTALLED / BEAM-PRO-SMOKE-TESTED / XREAL-LOADER-VALIDATED (only with logs).

## STAGE B — 3DoF (rotation only)
rotate L/R + up/down + roll · workspace session-relative · NO positional claim · Recenter works · story survives Recenter ·
tracking-loss on disconnect · clean reconnect. Record pose samples (ts/rotation/position/type/validity/reason).
Expected: XREAL 3DOF SESSION. Do NOT call noisy sub-cm position 6DoF.

## STAGE C — Beam Pro input (3DoF controller — NOT hand tracking)
ray origin/dir · Focus/Select/Back/Cancel/Next/Prev/Play-Pause/Reset/Recenter/Open-Close 2D/Switch-Language.
Safety: hover≠select · head≠approve · Select≠approve · voice≠authorize · destructive waits for Confirm · dup suppressed ·
Back + Recenter always reachable. Record input ts + results.

## STAGE D — Eye + 6DoF (only after Loader + 3DoF stable)
Eye detected via runtime capability · tracking API reports mode · rotation valid · position valid · lateral move changes pos ·
fwd/back changes pos · translation distinguishable from noise · Recenter resets origin · loss+recovery · story survives.
Timed sample: still → L/R → fwd/back → return. Record mode/pos deltas/rot deltas/validity/Eye evidence/firmware/ts.
Mark XREAL-EYE-6DOF-VALIDATED ONLY when BOTH: (1) SDK reports supported mode, (2) real translation observed + recorded.

## STAGE E — device TTS
Detect engine/version/EN+ZH voices/offline/pitch/rate. Speak: ready/success/first-failure/downstream/limitation/
persona-disagreement/abstention/tracking-limited/tracking-lost/reset-complete. Validate EN + ZH pronunciation, Back +
Reset interrupt, language switch, tracking-lost P0 interrupt, no stale narration after recovery, no voice authorization.
Measure init/first-audio/stop latency + utterance duration. No naturalness claim without listeners.

## STAGE 11 — build the camera candidate (ONLY after A–E pass)
Enable `SHADOW_XREAL_CAMERA`; build `Build/Android/shadow-lens-xreal-eye-camera-v10.apk` (separate
artifact; do NOT modify the working core). If XREALRGBCamera fails to compile for Android: inspect the
SDK's real platform defines, do NOT force symbols, do NOT modify PackageCache, document the restriction,
keep the working core. Static-audit before install.

## STAGE F — RGB frame (camera candidate only)
permission requested once · denial handled · later grant works · camera inits · non-zero frame arrives ·
valid dims · format recorded · monotonic ts · not all-black · duplicate detection · immutable byte copy ·
SHA-256 · release on pause · reinit on resume · raw frames NOT retained by default. Use a SANITIZED printed
Shadow fixture (never private docs). Evidence: non-black frame capture + metadata + frame SHA-256 + SDK logs + Shadow diag.

## STAGE G — OCR evidence loop
real frame → hash → OCR → boxes → source map → user inspect → user confirm → evidence event → fixture seal →
independent verify. OCR provider/version recorded · confidence = engine score (not truth) · original OCR
auditable · corrections create a new event referencing the original · no silent replacement · confirm required ·
seal after confirm · post-seal tamper fails verification. Output label: DEVICE VALIDATION FIXTURE (not PRODUCTION EVIDENCE).

## STAGE 14 — performance (device numbers only; never Editor)
Per condition SEPARATELY (3DoF / Eye 6DoF / TTS / camera / OCR / full seal): FPS · avg/p95/p99 frame time ·
CPU · GPU (when available) · memory · GC · startup · loader startup · first story load · Recenter latency ·
TTS latency · camera first-frame latency · OCR latency · seal latency · verify latency · 10-min stability ·
thermal · battery. Collect via device-test/v6 gfxinfo/meminfo + Shadow diagnostics.

## STAGE 15 — media (real device only)
media/device-validation-v10/ : Beam Pro launch · loader state · 3DoF · controller select · Recenter · Eye
detection · 6DoF translation · loss/recovery · EN TTS · ZH TTS · non-black RGB frame · OCR boxes · confirm ·
seal · independent verify · perf overlay. Metadata per file: device/glasses/Eye/firmware/commit/APK hash/
SDK version/tracking mode/timestamp/validation status. NEVER label desktop media as device evidence.
