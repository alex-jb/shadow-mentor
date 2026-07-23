# Shadow candidate-04 vs official XREAL HelloMR control — deterministic diff

Both APKs were summarized by the **same** parser (`scripts/apk-manifest-summary.mjs`) and compared by
the same differ, so no field was eyeballed. Machine-readable output:
`xreal-control-manifest-summary.json` + `shadow-vs-control-diff.json`.

- control: `xreal-sdk31-hello-mr-control.apk` · SHA-256 `0d629d75bd03ffce…` · 128,489,344 bytes
- candidate: `shadow-lens-v11-beampro-candidate-04.apk` · SHA-256 `832c875aed92…` · 128,758,703 bytes

## Headline

**`mrCriticalIdentical: true` — 16/16 MR-critical fields are identical.** Beyond app identity
(package name, versionName/Code, label, SHA), the two manifests do not differ **at all**: same
permissions, same services, same providers, same queries, same native-library set, same ABI, same
`minSdk`/`targetSdk`, same activity set with the same `exported` / `launchMode` / `taskAffinity`, same
intent-filters, same application meta-data.

| Field | Control | candidate-04 |
|---|---|---|
| resolved launcher | `ai.nreal.activitylife.NRXRActivity` | `ai.nreal.activitylife.NRXRActivity` |
| `nreal_sdk` | `true` | `true` |
| `com.nreal.supportDevices` | `1\|XrealLight\|2\|XrealAir` | `1\|XrealLight\|2\|XrealAir` |
| `nr_features` | `multiResume` | `multiResume` |
| `com.xreal.entry` | **absent** | **absent** |
| `com.xreal.mainActivity` | absent | absent |
| activity-alias count | 0 | 0 |
| activities | NRXRActivity · NRShadowActivity · NRFakeActivity · `ai.nreal…UnityPlayerActivity` · `com.unity3d…UnityPlayerActivity` | identical |
| XREAL native libs | `libXREALXRPlugin.so`, `libnr_libusb.so`, `libnr_loader.so` | identical |
| ABI / minSdk / targetSdk | arm64-v8a / 29 / 34 | identical |

## Findings by category

### A. Proven meaningful difference
1. **`XREALSettings.InitialTrackingType`** — control `MODE_3DOF (1)`, candidate-04 `MODE_6DOF (0)`.
   This is a real, proven configuration difference (read from both projects' `XREALSettings.asset`).
   Its runtime impact on a Beam Pro without the XREAL Eye is **not** proven offline, and it is **not**
   the current blocker: candidate-04's failure is that Shadow's own loader never started, which
   happens before tracking mode matters.
2. **Scene rig.** The official sample instantiates the SDK prefab `XR Interaction Hands Setup`
   (EventSystem + Input Action Manager + XR Interaction Manager + `XREALSessionManager` +
   `XREALTrackingModeChangeListener` + a nested XRI XR-Origin prefab that supplies the camera).
   Shadow's V11 scene creates a bare `Camera` tagged `MainCamera` at a fixed transform, with **no XR
   Origin, no TrackedPoseDriver, no XREALSessionManager, no XRI setup**.
   Consequence that can be predicted but not proven offline: with a running `XRDisplaySubsystem`
   Unity would still render stereo through the main camera, but **head rotation would not move the
   view** without a pose driver, and recenter/home-menu would be unavailable.
   Per the standing rule, this is **not** claimed as the current root cause — it becomes relevant only
   after Shadow's loader passes.

### B. Cosmetic / irrelevant difference
- package name, `versionName`/`versionCode`, application label, APK size and hash, splash/notch Unity
  meta-data, and the scene's content. None of these participate in MR discovery or handoff.

### C. Runtime-only behaviour requiring Beam Pro
- Whether MyGlasses lists either app in the MR grid.
- Whether launching from that grid sets `mrPkgName`.
- Whether `XREALXRLoader` starts **inside Shadow's own PID**.
- Whether `XRDisplaySubsystem` / `XRInputSubsystem` report `running`.
- Whether 6DoF-requesting settings degrade gracefully on 3DoF hardware.

### D. Unknown
- MyGlasses' discovery predicate (which meta-data it scans). Not present in this SDK; deliberately
  not guessed.
- Whether adding `com.xreal.entry=true` would change anything. The official sample does **not** set
  it, so it must not be added speculatively.

## What this rules out

Because every app-declarable MR field already equals the official control, the candidate-04 failure
**cannot** be explained by a missing launcher entry, a missing MR activity, a missing
`nreal_sdk`/`supportDevices`/`nr_features` registration, a missing alias, a wrong `taskAffinity`,
a wrong `exported`, a missing native library, or a wrong SDK ABI/API level.

A candidate-05 that only re-arranges manifest registration would therefore be building a fix for a
defect that the evidence says does not exist.
