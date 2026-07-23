# Beam Pro device runbook (run on the machine with the Beam Pro attached)

Prereq: XREAL SDK imported (SHADOW_XREAL_SDK defined) + Beam Pro USB-attached + USB debugging ON.
ADB=/Applications/Unity/Hub/Editor/6000.0.23f1/PlaybackEngines/AndroidPlayer/SDK/platform-tools/adb

## 1. Build the candidate (does NOT overwrite the stable v10-core APK)
```
Unity -batchmode -nographics -projectPath apps/shadow-lens/unity \
  -executeMethod ShadowLens.EditorTools.ShadowV11BeamProCandidate.BuildCI -logFile build.log
# → Build/Android/shadow-lens-v11-beampro-candidate-04.apk  (+ reports/device-validation-v11/build/build-summary.json)
```

## 2. Inventory the device (redact serials)
```
$ADB devices -l
$ADB shell getprop ro.product.model ; $ADB shell getprop ro.build.version.release
$ADB shell getprop ro.build.version.security_patch ; $ADB shell pm list packages | grep -i xreal
```

## 3. Install (side-by-side is not used — same package replaces the stable app on the device only)
```
$ADB install -r Build/Android/shadow-lens-v11-beampro-candidate-04.apk
$ADB shell dumpsys package com.shadowlens.xrealvoice | grep -E 'versionName|versionCode'
```

## 4. First launch + logcat
```
$ADB logcat -c ; $ADB shell monkey -p com.shadowlens.xrealvoice 1 ; $ADB logcat -d > reports/device-validation-v11/runtime/first-launch-logcat.txt
```
Confirm: app launches · Audit Workspace appears · no crash/ANR · no blank/shader failure · no XREAL loader fatal.

## 5. Physical test checklists (fill the CSVs — result = PASS/FAIL/PARTIAL/NOT_REPRODUCIBLE)
- `beam-pro-3dof-results.csv` — head rotation, Prev/Next/Select/Recenter/Reset, First Failure dominant, downstream distinct, review≠approval, no approve-by-head-focus, Open 2D Audit.
- `beam-pro-controller-results.csv` — identify the real input; map each button; verify focus≠select, select≠approve, no accidental double-activation, disconnect doesn't erase state.
- `beam-pro-tracking-results.csv` — Recenter variants; Scanning/Limited/Lost/Recovering; pause/resume; state preservation.
- `ost-readability-results.csv` — dark/normal/bright/patterned × dimming × content states; critical-status vs secondary-text vs full-profile readable; Chinese; ghosting.

## 6. Soak (15–30 min) + evidence
```
$ADB logcat -c ; # use the app 15–30 min, then:
$ADB logcat -d > reports/device-validation-v11/runtime/soak-logcat.txt
```
Photos: label optical shots "THROUGH-THE-LENS DEVICE CAPTURE", setup shots "DEVICE SETUP PHOTO"; index in device-photo-index.md. Redact personal info.

## 7. Only after core PASS — optional XREAL Eye 6DoF
Attach Eye, verify SDK detects it + real pose translation (distinguish from head-rotation). Report EYE-DETECTED / POSITIONAL-TRACKING-OBSERVED / 6DOF-VALIDATED / 3DOF-FALLBACK-PASSED separately. Do NOT infer 6DoF from SDK presence.

## 8. Then set the true flags in BEAM_PRO_DEVICE_VALIDATION_SUMMARY.md based on the actual results.

## §5 — MR launch-routing test — ONE COMMAND (replaces the old manual ADB/logcat workflow)
The candidate-04 glasses log showed Shadow launched DIRECTLY → isEntryApp=false, mrPkgName empty →
Nebula reclaimed the glasses (see CANDIDATE_04_PROCESS_AWARE_DIAGNOSIS.md). The decisive question is
whether launching from the MyGlasses MR grid sets the handoff. Run:

```
bash scripts/beampro-device-test.sh \
  --package com.shadowlens.xrealvoice \
  --expected-version 0.11-beampro-candidate.4 \
  --mode myglasses-grid
```
Options: `--apk <path>` (install first) · `--device-hint X4200` (pick among several devices) ·
`--seconds 30` · `--kill-server` (only when the adb server is wedged) · `--mode direct` (CONTROL run,
launches via adb — that route can never produce PHYSICAL_PASS).

What it does, so you never touch a second terminal again:
1. finds the Unity-bundled adb, runs `adb mdns services`, resolves the CURRENT wireless-debugging
   IP:port (it changes every session), connects with bounded retries, verifies shell.
   Prints `BEAM_PRO_FOUND` / `ADB_WIRELESS_CONNECTED` / `DEVICE_MODEL` / `DEVICE_IP_PORT`.
   If nothing resolves it tells you the exact action (same Wi-Fi + Wireless debugging ON).
2. verifies the INSTALLED candidate: versionName/versionCode, resolved launcher activity,
   `NRXRActivity` MR registration, and the `nreal_sdk` + `com.nreal.supportDevices` manifest
   meta-data (read off the APK with aapt). Reinstalls only when `--apk` is given.
3. pauses with ONE instruction block (connect glasses → MyGlasses → open "Shadow Lens" from the MR
   grid → Enter), then captures 30 s of logcat + `ps -A` itself.
4. resolves the PIDs of Shadow / nebula / nebula:space and attributes every XR line to a PID, so
   Nebula's Unity process can never again be read as a Shadow success.
5. prints the §5 signal set and ONE classification enum, asks the 7 observation questions, and writes
   everything to `reports/device-validation-v11/latest-device-run/`:
   `DEVICE_RUN_SUMMARY.md` · `device-run-summary.json` · `full-logcat.txt` · `important-lines.txt` ·
   `process-map.json` · `activity-state.txt` · `display-state.txt` · `package-state.txt` ·
   `physical-observation.json`. The device serial and LAN IP are redacted from every written file.

Classifications: `MR_GRID_DISCOVERY_FAILED` · `MR_PACKAGE_HANDOFF_MISSING` · `NEBULA_FALLBACK_LAUNCHER`
· `SHADOW_XR_LOADER_NOT_STARTED` · `SHADOW_XR_DISPLAY_NOT_RUNNING` · `SHADOW_PROCESS_CRASHED` ·
`SHADOW_RUNNING_NO_VISIBLE_WORKSPACE` · `PHYSICAL_PASS` · `INSUFFICIENT_EVIDENCE`.

`physical_device_validated` in the summary is `true` only when the run itself classifies PHYSICAL_PASS.

### Harness self-test (no device required)
```
bash scripts/beampro-device-test.selftest.sh    # 34 assertions
```
Covers the mDNS parser, changing ports, missing device, multiple ADB devices, stale connection, PID
attribution, empty logs, Nebula-vs-Shadow separation, every classification branch, and the signal
extractor. Run it after any edit to the harness.

## candidate-05 GATE (do NOT build yet)
candidate-05 is permitted only after a §5 harness run produces a concrete classification AND names the
exact configuration or routing difference to change. A run that ends `INSUFFICIENT_EVIDENCE` does not
open the gate. All physical success flags stay false until a run classifies `PHYSICAL_PASS`.
candidate-05 is NOT built until §5 proves the exact handoff difference. If launching from MyGlasses
already works → candidate-04 is correct + the fix was the launch method (no new APK). If §5 shows a
registration/routing gap → candidate-05 with the proven fix + the already-authored SHADOW_DEVICE_DIAG
(which will make the Shadow-vs-Nebula PID/XR state unambiguous in the next log).
