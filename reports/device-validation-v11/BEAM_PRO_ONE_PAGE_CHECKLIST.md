# Beam Pro A/B — one-page checklist

Details + troubleshooting: `BEAM_PRO_SHADOW_VS_CONTROL_AB_RUNBOOK.md`.

## Setup
- [ ] Correct glasses connected (XREAL One Pro cable seated)
- [ ] Correct Beam Pro on the same Wi-Fi, Wireless debugging ON
- [ ] `shasum` candidate-04 → begins `832c875a`
- [ ] `shasum` control APK → begins `0d629d75bd03ffce`

## Phase A — Shadow (`com.shadowlens.xrealvoice`)
- [ ] Harness started (`--package com.shadowlens.xrealvoice --expected-version 0.11-beampro-candidate.4 --mode myglasses-grid`)
- [ ] `BEAM_PRO_FOUND` + `VERSION_MATCH true` seen
- [ ] MyGlasses MR grid opened — **"Shadow Lens"** selected there (not the phone icon, not adb)
- [ ] 30 s observation completed, 7 questions answered honestly
- [ ] `CLASSIFICATION` recorded: ______________________
- [ ] Evidence copied to `ab-run-shadow-<date>/`

## Between phases
- [ ] Phase A copy verified (summary + json + important-lines + process-map + observation)
- [ ] Shadow closed on device (back at Nebula home)

## Phase B — Control (`com.shadowlens.xrealcontrol`)
- [ ] Harness started with `--apk <OPERATOR_CONTROL_DIR>/xreal-sdk31-hello-mr-control.apk --expected-version 3.1.0-control`
- [ ] MyGlasses MR grid opened — **"XREAL HelloMR Control"** selected there
- [ ] 30 s observation completed, 7 questions answered
- [ ] `CLASSIFICATION` recorded: ______________________
- [ ] Evidence copied to `ab-run-control-<date>/`

## Close-out
- [ ] Interpretation matrix row identified (A–F): ____
- [ ] **No capability flag promoted** in this session
- [ ] candidate-04 still installed (not uninstalled, not overwritten)
- [ ] No APK rebuilt
