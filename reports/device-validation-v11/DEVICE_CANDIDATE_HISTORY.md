# Device candidate history

| Candidate | SHA-256 (prefix) | app-label | launchable | status |
|---|---|---|---|---|
| shadow-lens-v11-beampro-candidate-01.apk | 8ea859df | unity | **NO** (no MAIN/LAUNCHER; UnityPlayerActivity exported=false) | FAILED on device — preserved as evidence |
| shadow-lens-v11-beampro-candidate-02.apk | 6ee4d4ff | **Shadow Lens** | **YES** (UnityPlayerActivity exported=true + MAIN + LAUNCHER) | BUILT + aapt-launchable; on-device PENDING Alex |

## candidate-01 → candidate-02 defect + fix
- **Defect (device-diagnosed):** the final merged manifest had `UnityPlayerActivity` but no MAIN
  intent, no LAUNCHER category, `exported=false` → `monkey`: "No activities found to run";
  `am start`: SecurityException (not exported). aapt: no launchable-activity.
- **Root cause:** the offline base manifest `Assets/Plugins/Android/AndroidManifest.xml` declares
  `<application>` with **no activity** (it only strips INTERNET). Because it is present, it REPLACES
  Unity's default launcher manifest, so the MAIN/LAUNCHER + exported activity are lost. candidate-01
  did not stash it (candidate-01's build predates the fix); the XREAL candidate is not the offline
  build.
- **Fix (candidate-02):** the build now STASHES that manifest during the XREAL build (same as the
  V8/V10 XREAL builds → Unity generates its default launcher manifest with MAIN/LAUNCHER +
  exported=true), sets `productName = "Shadow Lens"`, and runs a mandatory post-build **aapt2
  launchability assertion** (package/versionName/versionCode/application-label/exactly-one
  launchable-activity == UnityPlayerActivity) that **fails the build** if any check fails. Assertion
  PASSED. candidate-01 is preserved unchanged as failed evidence.

Preserved: candidate-01 (8ea859df) · stable v10-core (9efadf0a) · frozen verifier (c478b46f) — all
unchanged. ARM64 · IL2CPP · minSdk29 · target34 · camera OFF · Eye OFF · non-production-signed ·
AuditWorkspace default — all kept.

## candidate-03 (LAUNCHABLE + MyGlasses MR registration)
| shadow-lens-v11-beampro-candidate-03.apk | 11454763 | **Shadow Lens** | YES | **BUILT + aapt: launchable AND com.nreal.supportDevices=1\|XrealLight\|2\|XrealAir + nreal_sdk=true + XREAL native lib** — on-device PENDING Alex |

**candidate-02 → candidate-03 defect + fix:** candidate-02 launched on the phone display but did NOT
appear in MyGlasses as an MR app because the final manifest lacked `nreal_sdk` + `com.nreal.supportDevices`
(the SDK's IAndroidManifestRequirementProvider did not fire, even though the XREAL AAR libs/providers/
services merged in). Fix: a deterministic, idempotent post-build `ShadowXrealManifestInjector`
(#if SHADOW_XREAL_SDK) injects those exact meta-data (values from XREALSettings SupportDevices =
[REALITY, VISION] → `1|XrealLight|2|XrealAir`, matching the SDK 3.1 FAQ); XREALSettings set to MODE_3DOF
+ Controller; launcher fix preserved; post-build assertion now also hard-fails unless supportDevices +
nreal_sdk + a XREAL native lib are all present. See MANIFEST_COMPARISON.md. candidate-01 + candidate-02
preserved unchanged.

Flags: ANDROID_LAUNCHABLE = true · MYGLASSES_MR_REGISTRATION_PRESENT = true. NOT claimed (pending Alex
on hardware): glasses rendering · 3DoF validation · controller · OST readability · production readiness.
Operator-local (NOT committed, restored to clean after build): Packages/manifest.json (SDK file: ref),
packages-lock.json, ProjectSettings (SHADOW_XREAL_SDK define + productName), XREALSettings (3DoF). The
gated ShadowXrealManifestInjector.cs (#if SHADOW_XREAL_SDK) IS committed but compiles only for local
XREAL builds; the base build excludes it (EditMode 136/136 on the restored SDK-free tree).

## candidate-04 (XREAL XR plugin can start + XREAL MR launcher)
| shadow-lens-v11-beampro-candidate-04.apk | 832c875a | Shadow Lens | YES (NRXRActivity) | **BUILT** — fixes candidate-03's runtime "Failed to get XREAL Settings" + adds the XREAL MR launcher; on-device PENDING Alex |

**candidate-03 → candidate-04 (from the real glasses log):** candidate-03 launched but the XREAL XR
plugin ABORTED at runtime — `E Unity: Unable to start XREAL XR Plugin. Failed to get XREAL Settings.`
The XREALSettings ScriptableObject was never embedded (its config object was not registered under
`com.unity.xr.management.xrealsettings`), so `GetSettings()` returned null and no XRDisplaySubsystem
started → glasses stayed in Nebula OS. candidate-03 also had only UnityPlayerActivity as launcher, not
the XREAL MR entry.

**candidate-04 fix:** `EditorBuildSettings.AddConfigObject("com.unity.xr.management.xrealsettings",
Assets/XR/Settings/XREALSettings.asset, true)` before build (+ a build-time verify that it registered)
→ XRBuildHelper<XREALSettings> embeds the settings → runtime GetSettings() succeeds. As a direct
consequence the SDK now emits the correct XREAL MR structure: **ai.nreal.activitylife.NRXRActivity is
the MAIN/LAUNCHER** (the MR entry that MyGlasses uses), with UnityPlayerActivity retained as the Unity
player activity, plus NRShadowActivity / NRFakeActivity. supportDevices + nreal_sdk + XREAL native libs
preserved. The launchability assertion was corrected to accept the XREAL MR launcher (NRXRActivity),
not just UnityPlayerActivity. See CANDIDATE_03_RUNTIME_DIAGNOSIS.md.

Flags: ANDROID_LAUNCHABLE=true, MYGLASSES_MR_REGISTRATION_PRESENT=true, XREAL-SETTINGS-EMBEDDED=true,
XREAL-MR-LAUNCHER-PRESENT=true. Still FALSE pending physical test: AUDIT-WORKSPACE-RENDERED-IN-GLASSES,
XREAL-XR-LOADER-DEVICE-PASSED, XREAL-3DOF-DEVICE-VALIDATED, BEAM-PRO-CONTROLLER-VALIDATED,
OST-READABILITY-DEVICE-VALIDATED. HelloMR control build not needed — direct log + config-object
evidence conclusively identified the root cause.

Preserved: candidate-01 (8ea859df), candidate-02 (6ee4d4ff), candidate-03 (11454763), stable v10-core
(9efadf0a), frozen verifier (c478b46f) — all unchanged.
