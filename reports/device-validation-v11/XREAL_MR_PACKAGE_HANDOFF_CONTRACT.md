# XREAL MR package-handoff / launch-routing contract

What the SDK 3.1 + Nebula evidence shows about how a Shadow-style MR app takes the glasses display.

## Evidence base
- Runtime log (candidate-04) — the decisive fields + the MyGlasses fallback.
- `nractivitylife_6-release.aar` (device type 6 = XREAL One Pro) manifest + classes.
- `Editor/Android/XREALManifestProvider.cs` + `XREALSettings` (SupportMultiResume).

## The activities the SDK ships (from the AAR manifest, package `ai.nreal.activitylife`)
- **`NRXRActivity`** — `launchMode=singleTask`, `taskAffinity="xreal.unity"`, `exported=true`, MAIN +
  LAUNCHER + LEANBACK_LAUNCHER + DEFAULT. The MR entry activity.
- `NRShadowActivity` — `noHistory`, `excludeFromRecents`, `reverseLandscape`. A transient router.
- `ai.nreal.activitylife.UnityPlayerActivity` — the actual Unity player (`taskAffinity="xreal.unity"`,
  `meta-data unityplayer.UnityActivity=true`).
- `NRFakeActivity` — `excludeFromRecents`, `reverseLandscape`. Placeholder for multi-resume.
- Application meta-data **`nr_features = multiResume`**.

## How MyGlasses decides what to show on the glasses (from the log)
- MyGlasses (`NRService`, PID 24440) maintains **`mrPkgName`** = the package of the current MR app.
- On glasses-display add, `LaunchManager.onDisplayAdded` looks for the MR component for that package; if
  it can't (`component not found on display:19`) and `mrPkgName is empty`, it calls `goLauncher` and
  Nebula's `LaunchSpaceAcrivity` owns the glasses.
- The MR app's `NRXRActivity.onCreate` logs **`isEntryApp`** and **`multiResumeMode`**. In candidate-04
  these were BOTH `false` and the activity was on `displayId 0` (phone) — i.e. the app was NOT launched
  as the MR entry for the glasses display.

## Inference (to be proven by §5 test, not assumed)
`isEntryApp` / `multiResumeMode` / `mrPkgName` are set when the app is launched **through the MyGlasses
MR path** (from the MyGlasses app grid / MR launcher), which routes the app onto the glasses display and
registers its package. A **direct launch** (adb `am start`, phone home-screen icon) starts the app on
the phone display as a non-entry app, so MyGlasses never records `mrPkgName` → Nebula reclaims.

Corollary about `SupportMultiResume=true` (current setting): `XREALManifestProvider` REMOVES the plain
MAIN/LAUNCHER intent-filter for multi-resume apps (they are launched via the MR flow, not the normal
launcher). candidate-04 still exposes NRXRActivity MAIN/LAUNCHER (from the AAR manifest), so it CAN be
listed — but the entry/mrPkgName state still depends on the launch route.

## The decisive test (does NOT need a rebuild) — see §5 commands in BEAM_PRO_DEVICE_RUNBOOK
1. Confirm the resolved launcher + whether Shadow appears in the MyGlasses app grid.
2. Launch Shadow **from the MyGlasses app selector** (not adb/icon) and check whether MyGlasses logs
   `mrPkgName = com.shadowlens.xrealvoice` and Shadow's NRXRActivity logs `isEntryApp=true` on the
   glasses displayId.

Outcomes:
- If launching from MyGlasses sets mrPkgName + entry → **candidate-04 is correct; the fix is the launch
  method, not code.**
- If Shadow does NOT appear in the MyGlasses grid, or launching it there still leaves mrPkgName empty →
  a manifest/registration gap remains → candidate-05 with the proven fix.

## Not invented
No intent-extra name, action, or metadata key has been fabricated. The `mrPkgName`, `isEntryApp`,
`multiResumeMode`, `nr_features=multiResume`, and the activity set are all directly from the log +
AAR manifest. The exact intent-extra MyGlasses uses to pass the package (if any) is NOT yet extracted
from bytecode — the §5 launch-from-grid test resolves the routing question without needing it.
