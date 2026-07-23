# Manifest comparison — candidate-02 vs candidate-03 (vs official SDK 3.1 requirement)

| Element | candidate-02 | candidate-03 | SDK 3.1 / FAQ requirement |
|---|---|---|---|
| package | com.shadowlens.xrealvoice | com.shadowlens.xrealvoice | (project) |
| versionName / code | 0.11-beampro-candidate.2 / 112 | 0.11-beampro-candidate.3 / 113 | — |
| application-label | Shadow Lens | Shadow Lens | — |
| launchable-activity | UnityPlayerActivity (MAIN+LAUNCHER, exported) | UnityPlayerActivity (MAIN+LAUNCHER, exported) | required |
| XREAL native libs | libXREALXRPlugin.so, libnr_loader.so ✓ | ✓ | required |
| XREAL providers/services | AutoLogProvider, GlassesInitProvider, MediaProjectionService ✓ | ✓ | required |
| meta-data nreal_sdk | **ABSENT** | **true** ✓ | required |
| meta-data com.nreal.supportDevices | **ABSENT** | **1\|XrealLight\|2\|XrealAir** ✓ | required by FAQ for MyGlasses MR |
| meta-data autoLog | absent | 0 ✓ | provider default |

## Why candidate-02 failed in MyGlasses
candidate-02 shipped the XREAL AAR content (libs/providers/services, auto-merged) but the SDK's
`Unity.XR.XREAL.Editor.XREALManifestProvider` (IAndroidManifestRequirementProvider) did NOT fire in
this build, so `nreal_sdk` + `com.nreal.supportDevices` were missing → glasses stayed in Nebula OS and
Shadow Lens did not appear as a selectable MR app (per XREAL SDK 3.1 FAQ).

## candidate-03 fix
- XR loader for Android confirmed active (Assets/XR loader = XREALXRLoader, GUID matched).
- XREALSettings: InitialTrackingType = MODE_3DOF (1), InitialInputSource = Controller (1),
  SupportDevices = [REALITY(1), VISION(2)].
- Deterministic post-build `ShadowXrealManifestInjector` (IPostGenerateGradleAndroidProject, gated
  `#if SHADOW_XREAL_SDK`, idempotent) replicates the SDK provider EXACTLY: injects nreal_sdk=true,
  com.nreal.supportDevices=1|XrealLight|2|XrealAir, autoLog=0 into the launcher manifest → gradle
  merges into the final APK. Verified present by aapt2 dump xmltree.
- Launcher fix preserved (offline manifest stashed → default launcher manifest with MAIN/LAUNCHER +
  exported). productName = Shadow Lens.
- Mandatory post-build assertion now hard-fails unless launchable AND supportDevices/nreal_sdk/XREAL
  native lib are all present. PASSED.
