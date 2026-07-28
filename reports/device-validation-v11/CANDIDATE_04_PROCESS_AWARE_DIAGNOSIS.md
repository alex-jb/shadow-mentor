# candidate-04 process-aware diagnosis (real Beam Pro + glasses)

Source: `~/Desktop/beam-pro-v11-test/candidate-04-glasses-launch.txt` (12250 lines). Corrects the prior
increment's WRONG attribution: the successful XREAL loader lines were Nebula's, not Shadow's.

## PID → process (from the log)
| PID | lines | process |
|---|---|---|
| 24440 | ~1400 | MyGlasses / Nebula manager (`myGlasses` / `NRService`) |
| 31828 | ~5023 | **com.xreal.evapro.nebula:space** — Nebula's OWN Unity XR space |
| 31505 | ~634 | **com.shadowlens.xrealvoice** — Shadow Lens |

**Correction:** `[XREALXRLoader] Init End`, `Start End`, `NRGlasses START/RUN`, `start GlassesDisplay in
second screen` are all emitted by **PID 31828 (Nebula's space)** — NOT Shadow. Shadow's own XR loader
never started. Do not cite those lines as Shadow XR success.

## §2 — what PHYSICALLY passed (real hardware/display path)
- XREAL One Pro recognized: `_equalsPidVid … current display is Nreal glasses. glassType=6, name=XREAL One Pro`.
- MyGlasses service started; `set2D3D` succeeded; external XREAL display added (displayId 19, HDMI,
  1920×1080 @ up to 120 Hz; `deviceProductInfo … name=XREAL One Pro`).
- These prove the Beam Pro ↔ glasses connection, MyGlasses service, and external-display path work.
- They do NOT prove Shadow owns the XR display.

## §3 — primary failure evidence + classification
1. `13:22:31.481` (Shadow 31505, NRXRActivity): `displayId: 0, isNrealDisplay: false` +
   **`onCreate: isEntryApp=false, multiResumeMode=false, mainActivity=UnityPlayerActivity`** →
   Shadow started on the PHONE display as a NON-entry MR app (it was launched directly, not routed by
   MyGlasses).
2. `13:22:31.555` (Shadow): `NRUnityPlayerActivity onResume, multiResumeMode:false` → Shadow's Unity
   player runs on the phone.
3. `13:22:44.252` (MyGlasses LaunchManager): **`onDisplayAdded: component not found on display:19`** →
   no MR component to place on the glasses display.
4. `13:22:46.413` (MyGlasses): **`mrPkgName is empty, display remove, go launcher`** → `goLauncher`.
5. Nebula (`com.xreal.evapro.nebula`) `LaunchSpaceAcrivity` owns the resumed UI in the glasses.

**Primary classification: `MR_PACKAGE_HANDOFF_MISSING`.**
Secondary: `NEBULA_FALLBACK_LAUNCHER_TAKES_CONTROL`.
NOT yet `XR_ORIGIN_OR_CAMERA_MISSING` — Shadow's own XR loader never started, so scene/XR-Origin fixes
are premature.

## Root-cause statement
Shadow Lens was launched **directly** (adb / phone icon), so it started on displayId 0 (phone) with
`isEntryApp=false` and MyGlasses never set `mrPkgName = com.shadowlens.xrealvoice`. When the glasses
display appeared, MyGlasses found no MR component + empty mrPkgName → fell back to Nebula's launcher.
candidate-04's BUILD is not disproven (XREALSettings + NRXRActivity + supportDevices are correct); the
missing link is the **MyGlasses → Shadow MR package handoff / launch routing**. See
`XREAL_MR_PACKAGE_HANDOFF_CONTRACT.md`.

## Not claimed
SHADOW-MR-PACKAGE-HANDOFF-PASSED, SHADOW-XREAL-LOADER-DEVICE-PASSED, AUDIT-WORKSPACE-RENDERED-IN-GLASSES,
XREAL-3DOF/CONTROLLER/OST — all FALSE. Shadow's XR loader did not run in this test.
