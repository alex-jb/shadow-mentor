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

## §5 — MR launch-routing tests (run on candidate-04, NO rebuild) — decisive next step
The candidate-04 glasses log showed Shadow launched DIRECTLY → isEntryApp=false, mrPkgName empty →
Nebula reclaimed the glasses (see CANDIDATE_04_PROCESS_AWARE_DIAGNOSIS.md). These tests find whether
launching via the MyGlasses MR path fixes it WITHOUT any code change:

```
ADB=/Applications/Unity/Hub/Editor/6000.0.23f1/PlaybackEngines/AndroidPlayer/SDK/platform-tools/adb
# 1. what does the launcher resolve to?
$ADB shell cmd package resolve-activity --brief \
  -a android.intent.action.MAIN -c android.intent.category.LAUNCHER com.shadowlens.xrealvoice

# 2. standard launcher-intent start (baseline)
$ADB shell am force-stop com.shadowlens.xrealvoice
$ADB logcat -c
$ADB shell am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -p com.shadowlens.xrealvoice
#    then read: does myGlasses set mrPkgName = com.shadowlens.xrealvoice, or stay empty?
$ADB logcat -d | grep -iE 'mrPkgName|isEntryApp|component not found|NRXRApp|goLauncher'

# 3. THE decisive one — put on the glasses, open MyGlasses, and launch "Shadow Lens" FROM the MyGlasses
#    app grid (not adb, not the phone icon). Capture the log during that launch:
$ADB logcat -c ; # launch Shadow Lens from MyGlasses, then:
$ADB logcat -d | grep -iE 'mrPkgName|isEntryApp|multiResumeMode|component not found|NRXRApp|XREALXRLoader|Failed to get|3840|displayId'
```
Report back:
- Does Shadow Lens APPEAR in the MyGlasses app grid?
- When launched from there, does myGlasses log `mrPkgName = com.shadowlens.xrealvoice` (not empty)?
- Does Shadow's own NRXRActivity log `isEntryApp=true` on the glasses displayId (19, not 0)?
- Does Shadow's own `[XREALXRLoader] Init/Start End` appear (from the Shadow PID), with NO "Failed to
  get XREAL Settings"?

## candidate-05 GATE (do NOT build yet)
candidate-05 is NOT built until §5 proves the exact handoff difference. If launching from MyGlasses
already works → candidate-04 is correct + the fix was the launch method (no new APK). If §5 shows a
registration/routing gap → candidate-05 with the proven fix + the already-authored SHADOW_DEVICE_DIAG
(which will make the Shadow-vs-Nebula PID/XR state unambiguous in the next log).
