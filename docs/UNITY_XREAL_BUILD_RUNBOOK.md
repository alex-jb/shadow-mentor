# Unity XREAL build runbook (SDK 3.1.0)

Status at time of writing: **XREAL SDK is NOT present in this repo** (licensing — the package is not
committed). This runbook is the exact import procedure + what to record. SDK-dependent build steps are
blocked until the import is done by the operator; every non-SDK Phase-6 task proceeds without it.

## Prerequisites (official)
- Unity **6000.0.23f1** (this project). XREAL Unity SDK **3.1.0** supports Unity 6000.0.x.
- Android build support + NDK/SDK/JDK (already installed here).
- Beam Pro path: **MyGlasses ≥ 1.11.0**; connect the glasses to Beam Pro to trigger the firmware
  update; 6DoF needs the **XREAL Eye** add-on. (One / One Pro base is 3DoF.)

## Import steps (operator, logged-in)
1. Download the official **XREAL Unity SDK 3.1.0** package (`com.xreal.xr`) from
   https://developer.xreal.com/download/ (requires an XREAL developer login). **Do NOT use NRSDK 2.x**
   (the old `NRKernal` namespace) — that is a different, older SDK.
2. Record the exact tarball name + SHA-256 into `reports/xreal-v6/XREAL_PACKAGE_HASHES.txt`.
3. Import via Package Manager → Add package from tarball (or add the `com.xreal.xr` line + version to
   `Packages/manifest.json`, pinning the exact version).
4. Import ONLY the approved samples into an isolated dev folder — keep samples out of runtime builds.
5. Enable the scripting define symbol `SHADOW_XREAL_SDK` for the **Android → XREAL candidate build only**
   (not the base candidate).
6. Configure the XREAL loader via **XR Plug-in Management → Android** (do not hand-fake loader state).
7. Fill in every `reports/xreal-v6/*` inventory file from the real imported package.

## After import — inspect the REAL APIs before editing adapters
`Assets/ShadowLens/Xreal/*` adapters must be written against the **actual** imported SDK types. Do NOT
guess class/namespace names, and do NOT keep the NRSDK-2.x `NRKernal` reference in
`Providers/XrealProviders.cs` — replace it with the real SDK 3.1.0 API surface once imported. Key
official behaviors to honor:
- Call the tracking-type API **only after the XREAL loader has started** (SDK 3.1 fixed a pre-start crash).
- Handle the `Scanning` not-tracking reason as a limited (not lost) state.
- Wire the SDK 3.1 **automatic Logcat capture on launch** option.
- Handle the **glasses-exit → app-exit** lifecycle notification.
- One-series limits stay hard-disabled: no plane / image / hand tracking, depth mesh, or spatial anchors.

## Build the XREAL candidate (after import)
```
SHADOW_XREAL_SDK build → Shadow Lens → Build XREAL Candidate (runtime-gated 3DoF/6DoF)
→ Build/Android/shadow-lens-xreal-v6-candidate.apk
```
Record everything in `reports/xreal-v6/`. Status after a successful build is **XREAL-CANDIDATE-BUILT**,
never **XREAL-DEVICE-VALIDATED** (that needs real hardware + `device-test/v6/FIRST_DEVICE_DAY_RUNBOOK.md`).
