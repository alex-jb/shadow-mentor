# XREAL SDK assemblies
- Runtime: `Unity.XR.XREAL` (namespace Unity.XR.XREAL) — XREALXRLoader, XREALPlugin, XREALRGBCamera, XREALSettings, XREALSessionManager, subsystems.
- Editor: `Unity.XR.XREAL.Editor` — build processors (XREALBuildProcessor, XREALManifestProvider), hand-tracking + image-library setup (unused), CLI.
Our ShadowLens.Xreal.asmdef references Unity.XR.XREAL + ShadowLens; gated by SHADOW_XREAL_SDK.
