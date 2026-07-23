# XREAL MR package-handoff / launch-routing contract (evidence-based)

What the SDK 3.1.0 source + AAR bytecode actually prove about how an MR app takes the glasses display.
Nothing on this page is inferred from naming or guessed; each row cites the symbol it came from.

## Evidence base
- `com.xreal.xr` 3.1.0 (operator-local package) — `Editor/Android/XREALManifestProvider.cs`,
  `Editor/Android/XREALBuildProcessor.cs`, `Editor/XREALProjectValidator.cs`, `Runtime/Scripts/XREALSettings.cs`.
- `Runtime/Plugins/Android/nractivitylife_6-release.aar` — manifest + `classes.jar` disassembled with
  `javap -p -c` (`ai.nreal.activitylife.NRXRApp`, `NRUtility`).
- Candidate-04 runtime log from the real glasses (`CANDIDATE_04_PROCESS_AWARE_DIAGNOSIS.md`).
- The official control APK built from the SDK's own HelloMR sample (`OFFICIAL_XREAL_CONTROL_BUILD.md`).

## CORRECTION to the previous version of this document
The earlier revision stated that `nractivitylife_6-release.aar` is "device type 6 = XREAL One Pro".
**That was wrong.** `Editor/Android/XREALBuildProcessor.cs` selects it purely by editor version:

```csharp
if (XREALSettings.GetSettings().SupportMultiResume) {
#if UNITY_6000_0_OR_NEWER
    ImportAsset("nractivitylife_6-release");     // "_6" = Unity 6
#else
    ImportAsset("nractivitylife-release");
#endif
}
```
The `_6` suffix is the Unity-6 build of the same library. It encodes no device identity.

## Proven contract items

| # | Symbol / string | Where it lives | Who sets it | Who reads it | Confidence | candidate-04 |
|---|---|---|---|---|---|---|
| 1 | `com.xreal.entry` | **application `meta-data`** in the APK manifest | nobody in the SDK — the app author would have to add it by hand | `NRXRApp.isEntryApp()` → `getMeta(ctx, pkg, KEY_XREAL_ENTRY, false)` | **proven** (bytecode) | **absent** → `isEntryApp=false` |
| 2 | `com.xreal.mainActivity` | application `meta-data` | nobody in the SDK | `NRXRApp.getEntryActivity()`, default `ai.nreal.activitylife.UnityPlayerActivity` | **proven** | absent → default used |
| 3 | `com.xreal.debug.noMultiResume` | application `meta-data` | nobody in the SDK | `NRXRApp.isDebugNoneMultiResume()` | **proven** | absent |
| 4 | `com.xreal.unity.version` | application `meta-data` | nobody in the SDK | `NRXRApp.getUnityVersion()`, default `2021` | **proven** | absent |
| 5 | `nreal_sdk=true` | application `meta-data` | `XREALManifestProvider` at build time | MyGlasses / Nebula (device side) | **proven** it is written; consumer inferred | **present** |
| 6 | `com.nreal.supportDevices` | application `meta-data` | `XREALManifestProvider`, from `XREALSettings.SupportDevices` | device side | **proven** it is written | **present** `1\|XrealLight\|2\|XrealAir` |
| 7 | `nr_features=multiResume` | application `meta-data` | shipped inside the AAR manifest | device side | **proven** | **present** |
| 8 | `NRXRActivity` MAIN/LAUNCHER, `singleTask`, `taskAffinity=xreal.unity`, `exported=true` | AAR manifest | the AAR itself (imported only when `SupportMultiResume=true`) | Android launcher + MyGlasses | **proven** | **present, and it IS the resolved launcher** |
| 9 | `mrPkgName` | **device side only** | MyGlasses / `NRService` | MyGlasses `LaunchManager` | **proven absent from the app SDK** — the string does not occur anywhere in the SDK or in any of its 14 AARs | app cannot set it |
| 10 | `LaunchSpaceAcrivity`, `component not found on display:19`, `go launcher` | device side (Nebula/MyGlasses) | — | — | observed in the log | fired |

## The decisive semantics (decompiled, verbatim behaviour)

```java
// NRXRApp.init(Activity)
boolean isEntry      = isEntryApp();                 // application meta-data com.xreal.entry, default FALSE
boolean debugNoMulti = isDebugNoneMultiResume();     // application meta-data
mMainActivityName    = getEntryActivity();           // application meta-data, default UnityPlayerActivity
mMultiResumeMode     = isEntry || (findNrealDisplay(true) != null);
if (debugNoMulti) mMultiResumeMode = false;
Log.i("NRXRApp", "onCreate: pacakge=" + pkg + ", isEntryApp=" + isEntry +
                 ", multiResumeMode=" + mMultiResumeMode + ", debugClose=" + debugNoMulti +
                 ", mainActivity=" + mMainActivityName);
```
and

```java
private static <T> T getMeta(Context c, String pkg, String key, T def) {
    Bundle b = c.getPackageManager().getApplicationInfo(pkg, GET_META_DATA).metaData;   // 128 = GET_META_DATA
    return b == null ? null : (b.get(key) != null ? (T) b.get(key) : def);
}
```
`findNrealDisplay(boolean)` walks `DisplayManager.getDisplays()` and asks
`GlassesInitSetting.isXREALDisplay(display)` (from `GlassesDisplayPlugEvent-2.4.2.aar`), logging
`displayId:<n>, isNrealDisplay:<bool>` per display.

**Therefore, in candidate-04's log, `multiResumeMode=false` means BOTH:** the app has no
`com.xreal.entry` meta-data **and** no XREAL display was visible to the Shadow process at
`NRXRApp.init` time. Those two facts are separable in the next run: the full log line also carries
`debugClose=` and `mainActivity=`, and the per-display `isNrealDisplay` lines appear alongside.

## Answers to the ten questions

1. **How is an MR application discovered by MyGlasses?** Not proven from the app side. The only
   app-side registration the SDK emits is `nreal_sdk=true` + `com.nreal.supportDevices` +
   `nr_features=multiResume` + the `NRXRActivity` MAIN/LAUNCHER entry. candidate-04 has all four, and
   they are byte-identical to the official control APK. The scanning logic lives in MyGlasses, which
   is not part of this SDK — **incomplete, resolvable only on-device.**
2. **How is its package selected?** By the user picking it in the MyGlasses MR grid; the app has no
   API to select itself. **Incomplete on the app side, but bounded: `mrPkgName` exists only device-side.**
3. **How does `mrPkgName` become non-empty?** MyGlasses sets it when *it* launches an MR app. No SDK
   symbol writes it. **Proven negative** (string absent from SDK + all 14 AARs).
4. **What makes `isEntryApp=true`?** The application `meta-data` `com.xreal.entry` being present and
   true. **Proven.** Note the official control APK does **not** have it either — so
   `isEntryApp=false` is the normal state for a stock XREAL app, not a Shadow defect.
5. **Does a direct ADB launch bypass the contract?** It bypasses the *MyGlasses* half: MyGlasses never
   records `mrPkgName`, and the app starts on the phone display. It does **not** change `isEntryApp`,
   which is a manifest fact. **Proven for `isEntryApp`; consistent-with-evidence for `mrPkgName`.**
6. **Is an activity alias required?** No. Neither the official control APK nor candidate-04 declares
   one. **Proven.**
7. **Is a MyGlasses-side selection action required?** Everything the app can declare is already
   declared identically in both APKs, and `mrPkgName` is device-side only, so the remaining variable
   is the selection itself. **Strongly indicated, not yet proven** — this is exactly what the harness
   run must decide.
8. **Does the official sample contain any registration candidate-04 lacks?** **No.** All 16
   MR-critical manifest fields are identical (`shadow-vs-control-diff.json`,
   `mrCriticalIdentical: true`).
9. **Is the handoff purely runtime/user selection rather than APK config?** All *app-declarable* APK
   config is already equal to the official control, so no APK-config gap remains to be closed. That
   makes runtime/user selection the only remaining app-side explanation — **strongly indicated, and
   falsifiable by one harness run.**
10. **Can this be resolved without candidate-05?** **Yes, potentially.** If the MyGlasses-grid launch
    sets `mrPkgName` and Shadow's own loader then starts, no new APK is needed. candidate-05 becomes
    justified only if the harness shows a failure whose fix is not the launch route.

## What is still incomplete (labelled, not guessed)
- The MyGlasses-side discovery predicate (which meta-data it scans for) is not in this SDK. No intent
  action, extra, or metadata key has been invented to fill that gap.
- Whether `com.xreal.entry=true` would *help* is untested. It is not what the official sample does, so
  it must not be added speculatively.
