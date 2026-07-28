# Device acceptance checklist (One / One Pro + Beam Pro)

Pre-reqs (official): MyGlasses ≥ 1.11.0, firmware updated, XREAL SDK 3.1.0.
Nothing here is "device-validated" until a real result is recorded in RESULT_TEMPLATE.md.

## Base guided-story candidate (no XREAL SDK)
- [ ] `collect-device-info.sh` shows model + ARM64 abi
- [ ] `install-guided-story.sh` installs (APK sha256 matches `reports/device-ready-v5/APK_SHA256.txt`)
- [ ] `launch.sh` starts to **Banking READY** deterministically
- [ ] Capability banner shows **ANDROID MOCK** (no false XREAL/6DoF claim)
- [ ] Next/Prev/Reset/Recenter reachable via touch
- [ ] 2D audit fallback opens
- [ ] EN / 中文 switch works
- [ ] Reduced motion works
- [ ] `reset-app-data.sh` → relaunch returns to Banking READY (recovery)
- [ ] `collect-logcat.sh` shows no repeated AndroidRuntime:E

## XREAL 3DoF (glasses, no Eye) — only when the XREAL candidate exists
- [ ] Banner shows **XREAL 3DOF SESSION** only after loader start + reported 3DoF
- [ ] Head rotation moves the session-relative workspace; Recenter works
- [ ] No positional-movement / anchor / plane / image / hand / depth claim anywhere
- [ ] Tracking-lost banner appears if you cover the sensors; recovery works

## XREAL Eye 6DoF — only after real Eye detection
- [ ] Banner shows **XREAL EYE 6DOF SESSION** only with Eye + reported 6DoF + observed translation
- [ ] `collect-performance.sh` gfxinfo/meminfo captured (device numbers, not Editor)
- [ ] Camera path stays **CAMERA UNAVAILABLE** until a real non-black frame
