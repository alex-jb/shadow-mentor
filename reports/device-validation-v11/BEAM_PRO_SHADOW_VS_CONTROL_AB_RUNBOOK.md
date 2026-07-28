# Beam Pro A/B runbook — Shadow candidate-04 vs official XREAL HelloMR control

One home session, two phases, one harness. Every command below is the harness's **actual** CLI
(verified from `scripts/beampro-device-test.sh`; flags: `--package --expected-version --mode --apk
--device-hint --seconds --kill-server`). The harness discovers the Beam Pro via `adb mdns services`,
resolves the changing Wi-Fi-debugging port itself, installs **only** when `--apk` is given, pauses for
the one manual MyGlasses action, captures 30 s of PID-attributed logcat, asks 7 observation questions,
and writes everything to `reports/device-validation-v11/latest-device-run/` with the device serial and
LAN IP redacted.

**The MyGlasses MR-grid launch is the authoritative launch path.** A direct `adb shell am start` (or
the phone's app icon) leaves `mrPkgName` empty and Nebula reclaims the glasses — that is the proven
candidate-04 failure mode, not a test of the handoff. `--mode direct` exists only as a control run and
can never produce `PHYSICAL_PASS`. Nebula's own `XREALXRLoader Init/Start End` lines are **not**
Shadow/control success — the harness enforces PID attribution (`process-map.json` records the Shadow,
`com.xreal.evapro.nebula` and `nebula:space` PIDs; XR lines count only when the line's PID matches).

## Preconditions (both phases)

- Beam Pro and this Mac on the **same Wi-Fi**; Wireless debugging ON (Settings → Developer options).
- XREAL glasses cable at hand. MyGlasses installed and working (Nebula home visible in the glasses).
- Repository at `chore/shadow-v11-pre-device-gate` (or any descendant of `aae8bea`).
- Artifact identity check (do not skip):

```
shasum -a 256 apps/shadow-lens/unity/Build/Android/shadow-lens-v11-beampro-candidate-04.apk
# must begin 832c875a
shasum -a 256 <OPERATOR_CONTROL_DIR>/xreal-sdk31-hello-mr-control.apk
# must begin 0d629d75bd03ffce   (operator-local; NOT in the repository — do not copy it in)
```

`<OPERATOR_CONTROL_DIR>` is the disposable control project's `Build/` directory on this machine.
If the control APK is missing, STOP — rebuilding it is a separate task, and Phase B cannot run.

- candidate-04 is already installed on the Beam Pro from the previous session
  (`com.shadowlens.xrealvoice`, versionName `0.11-beampro-candidate.4`). **Do not uninstall it** —
  it is part of the evidence boundary. The harness verifies the installed version and only
  reinstalls when `--apk` is passed.

## PHASE A — Shadow candidate-04 (`com.shadowlens.xrealvoice`)

```
bash scripts/beampro-device-test.sh \
  --package com.shadowlens.xrealvoice \
  --expected-version 0.11-beampro-candidate.4 \
  --mode myglasses-grid
```

1. The harness prints `BEAM_PRO_FOUND / ADB_WIRELESS_CONNECTED / DEVICE_MODEL / DEVICE_IP_PORT`.
   If it prints an ACTION line instead, fix Wi-Fi/wireless-debugging and rerun.
2. It verifies the installed package (`VERSION_MATCH true`). If `VERSION_MATCH false`, STOP —
   do not reinstall in this session unless you explicitly decide to pass `--apk`.
3. It clears logcat itself, then pauses with the exact prompt:
   **CONNECT THE XREAL GLASSES → OPEN MYGLASSES → LOOK FOR "SHADOW LENS" IN THE MR APP GRID →
   DO NOT USE THE BEAM PRO ANDROID APP ICON → DO NOT USE ADB TO LAUNCH IT → PRESS ENTER AFTER YOU
   ATTEMPT TO OPEN IT.**
4. Put the glasses on, open MyGlasses, find **Shadow Lens** in the MR grid, open it, press Enter on
   the Mac. The harness captures **30 s** (extend with `--seconds 60` if the launch feels slow).
5. Answer the 7 y/n observation questions honestly (grid visible? left Nebula? workspace appeared?
   head rotation? controller select? text readable? returned to Nebula/black?).
6. The harness prints `CLASSIFICATION <one of the nine>` and writes the evidence set.
7. **Save Phase A evidence before Phase B** (the output directory is fixed):

```
cp -R reports/device-validation-v11/latest-device-run \
      reports/device-validation-v11/ab-run-shadow-$(date +%Y%m%d-%H%M)
```

## Between phases

- Confirm the Phase A copy exists and contains `DEVICE_RUN_SUMMARY.md`, `device-run-summary.json`,
  `important-lines.txt`, `process-map.json`, `physical-observation.json`.
- No manual log rotation is needed — the harness clears logcat at the start of each run, so Phase B
  starts from a clean window. Never analyse the two apps from one mixed window.
- Close Shadow Lens on the device (return to Nebula home) so Phase B starts from the launcher.

## PHASE B — official HelloMR control (`com.shadowlens.xrealcontrol`)

The control has never been installed (`OFFICIAL_XREAL_CONTROL_INSTALLED=false`), so Phase B passes
`--apk` once:

```
bash scripts/beampro-device-test.sh \
  --package com.shadowlens.xrealcontrol \
  --expected-version 3.1.0-control \
  --mode myglasses-grid \
  --apk <OPERATOR_CONTROL_DIR>/xreal-sdk31-hello-mr-control.apk
```

Steps are identical to Phase A, except the MR-grid entry is **"XREAL HelloMR Control"**. When the
harness pauses, look for that label in the MyGlasses grid. Then:

```
cp -R reports/device-validation-v11/latest-device-run \
      reports/device-validation-v11/ab-run-control-$(date +%Y%m%d-%H%M)
```

## After both phases

Read the two `CLASSIFICATION` values and apply `BEAM_PRO_AB_INTERPRETATION_MATRIX.md` — it maps every
(Shadow, control) outcome pair to the single permitted next action. **Do not promote any capability
flag in this session**; flag promotion happens in a follow-up offline task against the saved evidence.
Do not build candidate-05 regardless of outcome — at most the matrix can make candidate-05
*planning* eligible.

## Troubleshooting

- No `_adb-tls-connect` service → same Wi-Fi? wireless debugging on? Try `--kill-server` once.
- Multiple Android devices on the LAN → add `--device-hint X4200`.
- Launch feels slow → rerun with `--seconds 60`.
- The harness never launches apps itself in `myglasses-grid` mode — if you never opened the app from
  the grid, the classification will honestly come back `INSUFFICIENT_EVIDENCE` or
  `MR_PACKAGE_HANDOFF_MISSING`; that is the harness working, not failing.
