# XR Plug-in Management / XREAL loader configuration (V10)

Configured reproducibly via `ShadowLens.EditorTools.ShadowXrealLoaderConfig.ConfigureAndroid`
(official XR Management editor APIs: `XRPackageMetadataStore.AssignLoader` +
`XRGeneralSettingsPerBuildTarget`), NOT a hand-edited asset. 2026-07-22, Unity 6000.0.23f1.

| Setting | Value | Evidence |
|---|---|---|
| loader | `Unity.XR.XREAL.XREALXRLoader` (SDK 3.1.0) | XREALMetadata.cs loaderType |
| Android assignment | ✅ assigned | `Assets/XR/XRGeneralSettingsPerBuildTarget.asset` → Android Providers `m_Loaders` has the XREAL loader (guid bcf95301…) |
| Initialize XR on Startup (Android) | ✅ `m_InitManagerOnStart: 1` | Android Settings |
| Standalone/macOS | ✅ NO XREAL loader (`m_Loaders: []`) | Standalone Providers |
| XRI version | 3.0.3 (installed) | packages-lock |
| unsupported features | plane/image/hand/depth/anchor NOT enabled | no AR-Features config; SDK samples not imported into build |
| duplicate loaders | none | only XREAL under Android |

## Tracked files changed (reason)
- `Assets/XR/XRGeneralSettingsPerBuildTarget.asset` (+ .meta): the XR settings with the XREAL loader
  assigned to Android — required for a reproducible XREAL build. The loader guid resolves only when the
  SDK is locally installed (operator-local, per the runbook); a clean clone without the SDK builds the
  base (the whole Xreal assembly + this loader reference are inert without the SDK).
- `Assets/ShadowLens/Editor/ShadowXrealLoaderConfig.cs` (+ .meta): the reproducible config script.
- `Assets/ShadowLens/Editor/ShadowLens.Editor.asmdef`: added `Unity.XR.Management` +
  `Unity.XR.Management.Editor` references (both already in the base manifest — no new dependency).

## Validation
Project Validation was reported by the operator as 0 issues / 7 checks. The loader-assignment asset is
the serialized-setting evidence. Full device validation is pending hardware (see DEVICE_DAY_RUNBOOK_V10.md).
