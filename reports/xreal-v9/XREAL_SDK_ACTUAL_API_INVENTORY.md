# XREAL SDK 3.1.0 — actual API inventory (from the imported package)

Read from the real tarball `com.xreal.xr` 3.1.0 (sha256 fd7d0fce…). NOT NRSDK 2.x / NRKernal.

- **Package**: com.xreal.xr 3.1.0, displayName "XREAL XR Plugin", unity 2021.3.
- **Dependencies**: com.unity.xr.management 4.4.1 (already in project), com.unity.xr.core-utils 2.2.0.
- **Assemblies**: `Unity.XR.XREAL` (Runtime), `Unity.XR.XREAL.Editor` (Editor). Namespace `Unity.XR.XREAL`.

## Types the typed adapters use (confirmed in the package, not guessed)
| API | Signature (real) | Use |
|---|---|---|
| `XREALXRLoader : XRLoaderHelper` | `Initialize()` / `Start()` / `Stop()` / `Deinitialize()`; static events `OnXRLoaderStart`, `OnXRLoaderStop` | loader lifecycle → ShadowXrealLoaderState |
| `XREALPlugin.GetTrackingType()` | `→ TrackingType` | tracking-type query (only after loader start) |
| `XREALPlugin.TrackingType` | `MODE_6DOF=0, MODE_3DOF=1, MODE_0DOF=2, MODE_0DOF_STAB=3` | 6DoF vs 3DoF mapping |
| `XREALPlugin.GetDevicePoseFromHead(XREALComponent, ref Pose)` | `→ bool` | head pose (positional translation → real 6DoF proof) |
| `XREALPlugin.IsOneSeriesGlasses()` / `GetDeviceType()` / `GetDeviceCategory()` | device identity | capability detection |
| `XREALPlugin.InputSource` | `None=0, Controller=1, Hands=2` | input source (we use Controller; Hands not used) |
| `XREALRGBCamera.StartRGBCameraDataCapture()` / `TryGetRGBCameraFrame(...)` / `TryAcquireLatestImage(...)` / `DisposeRGBCameraDataHandle(...)` | RGB frame acquisition | camera adapter → evidence pipeline |
| `XREALSettings : ScriptableObject` | XR settings | provider config |
| enums | `NotTrackingReason`, `TrackingState`, `XREALButtonType`, `XREALClickType`, `XREALGlassesDisconnectReason`, `XREALErrorCode` | diagnostics + tracking state |

## Samples (kept OUT of runtime builds)
Interaction Basics, **AR Features** (Plane/Image/Anchor/Depth — NOT used on One series), Camera
Features (RGB), MarkerTracking. Only Interaction Basics + Camera are relevant; AR Features stays unused.
