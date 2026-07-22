# First device day runbook (v6) — exact order

Nothing here upgrades a device status without a real recorded result. Follow the stages in order; if a
STOP condition fires, drop to the fallback in STOP_CONDITIONS.md and keep testing other capabilities.

## STAGE 1 — Beam Pro prep
1. Power + update Beam Pro. 2. Update MyGlasses to the required version (>=1.11.0). 3. Connect One Pro / Eye.
4. Trigger + complete glasses firmware update. 5. Enable developer mode. 6. Confirm ADB (`collect-device-info` style).
7. Capture device info. 8. Confirm storage + battery.

## STAGE 2 — Stable fallback
1. Install frozen stable APK. 2. Launch. 3. Complete Banking flow. 4. Verify / Tamper / Restore / Reset.
5. Record launch result. 6. Do NOT debug minor visual issues yet.

## STAGE 3 — Base guided story (offline, no XREAL)
1. Install cleaned base candidate (no INTERNET). 2. Launch without XREAL. 3. Test all three stories.
4. Presenter Mode. 5. Touch. 6. Pause/resume. 7. Reset. 8. Export diagnostics (redact before sharing).

## STAGE 4 — XREAL candidate
1. Install XREAL candidate. 2. Validate loader (ShadowXrealLoaderState phases). 3. Glasses detection.
4. 3DoF. 5. Controller input (3DoF only — NOT hand tracking). 6. Recenter. 7. Tracking loss/recovery.
8. App exit/relaunch.

## STAGE 5 — Eye / 6DoF
1. Confirm Eye presence. 2. Confirm firmware. 3. Confirm runtime-reported tracking type.
4. Rotate. 5. Translate positionally. 6. Record translation samples (real 6DoF proof, not noise).
7. Recenter. 8. Record tracking diagnostics.

## STAGE 6 — Camera / OCR
1. Request permission. 2. Open camera. 3. Validate non-black frame. 4. Validate timestamps. 5. Hash frame.
6. Capture a sanitized printed fixture. 7. Run OCR. 8. Inspect coordinates. 9. Confirm evidence. 10. Seal + verify.

## STAGE 7 — Performance (device numbers only)
1. Idle. 2. Story transition. 3. Tracking. 4. Camera. 5. OCR. 6. Full evidence seal. 7. Thermal.
8. 10-min stability. 9. Repeated Reset. 10. Relaunch. Record each condition SEPARATELY (no averaging across).
