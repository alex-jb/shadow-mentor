# Official XREAL control build (HelloMR) — offline reference for the candidate-04 diff

Purpose: build the SDK's **own** MR sample with **stock XREAL configuration**, so Shadow candidate-04
can be compared against a known-good XREAL app instead of against assumptions. Nothing here was
installed or launched on a device.

## Status flags

| Flag | Value |
|---|---|
| `OFFICIAL_XREAL_CONTROL_APK_BUILT` | **true** |
| `OFFICIAL_XREAL_CONTROL_INSTALLED` | false |
| `OFFICIAL_XREAL_CONTROL_RENDERED_IN_GLASSES` | false |
| `OFFICIAL_XREAL_CONTROL_3DOF_VALIDATED` | false |

## What was built

| Field | Value |
|---|---|
| SDK | `com.xreal.xr` **3.1.0** (`unity: 2021.3`), operator-local package, not committed |
| Sample | official `Samples~/Interaction Basics/HelloMR/HelloMR.unity` — used verbatim, not re-authored |
| Editor | Unity 6000.0.23f1 |
| Project | disposable, **outside** this repository; contains no Shadow code |
| Package | `com.shadowlens.xrealcontrol` |
| Application label | `XREAL HelloMR Control` |
| versionName / versionCode | `3.1.0-control` / `1` |
| APK | `xreal-sdk31-hello-mr-control.apk` — 128,489,344 bytes — SHA-256 `0d629d75bd03ffce…` |
| Loader | `XREALXRLoader` assigned for Android (build log: `active loaders: 1`) |
| Backend / ABI | IL2CPP · ARM64 · OpenGLES3 |
| minSdk / targetSdk | 29 / 34 |
| Camera / Eye | OFF / OFF |
| Signing | Unity development keystore (non-production) |

Packages resolved for the control project: `com.unity.xr.management`, `com.unity.xr.core-utils`,
`com.unity.xr.interaction.toolkit` (HelloMR instantiates the SDK's `XR Interaction Hands Setup`
prefab), `com.unity.ugui` (TMP).

## XREALSettings used

SDK defaults everywhere except one deliberate, recorded deviation:

| Setting | SDK default | Control build | Shadow candidate-04 |
|---|---|---|---|
| `StereoRendering` | SinglePassInstanced (2) | 2 | 2 |
| `InitialTrackingType` | `MODE_6DOF` (0) | **`MODE_3DOF` (1)** ← deviation | `MODE_6DOF` (0) |
| `InitialInputSource` | Controller (1) | 1 | 1 |
| `SupportMultiResume` | true | true | true |
| `SupportDevices` | REALITY(1) + VISION(2) | 1,2 | 1,2 |
| `EnableAutoLogcat` | false | false | false |
| `EnableNativeSessionManager` | false | false | false |

Deviation reason: this Beam Pro has no XREAL Eye, so 6DoF is not available; the control was set to
3DoF to match the hardware the harness will actually run on. This makes the control **stricter**, not
looser — and it surfaces that candidate-04 asks for 6DoF on 3DoF-capable hardware (see the diff).

## Build failures encountered (recorded, not worked around)

1. `error CS0103: XRPackageMetadataStore does not exist` — missing
   `using UnityEditor.XR.Management.Metadata;` in the control build script. Fixed in the control
   script only. **No home-made sample was substituted for HelloMR at any point.**

Second attempt: `[control] Succeeded errors=0`.

## Not committed

The disposable project, the SDK package contents, `Library/`, the Gradle cache, the APK binary, and
every absolute machine path stay out of this repository. Only the derived JSON summaries and these
reports are committed.
