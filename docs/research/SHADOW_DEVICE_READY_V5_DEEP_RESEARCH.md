# Shadow device-ready V5 — deep research (official-source audit)

All sources official/primary unless noted. Accessed **2026-07-21** (three parallel research passes:
XREAL, Unity 6, Three.js). Where a fact could not be confirmed against an official page it is marked
**官方未明确 → fail closed** and the code defaults to "unsupported".

This research is what the capability model, the Android candidate, the input layer, and the
performance instrumentation are built against — every consequence below maps to a real code location.

---

## 1. XREAL — hardware capability ground truth

Target: XREAL One / One Pro glasses + Beam Pro host, XREAL Unity SDK.

| Fact | Source | Consequence | Code location |
|---|---|---|---|
| Current SDK = **Unity SDK 3.1.0** (2025-11-25); adds 6DoF for One series **with XREAL Eye**; requires firmware update. | docs.xreal.com/Release Note/XREAL SDK 3.1.0 | Target SDK 3.1.0; 6DoF gated behind runtime Eye detection, never model. | `Device/ShadowDeviceCapabilityDetector.cs` (6DoF needs Eye + SixDof + translation) |
| One / One Pro **base tracking = 3DoF** (X1 chip, no accessory). | docs.xreal.com/XREALDevices/XREAL Glasses | Default/fallback profile = 3DoF (rotation only); position locked unless Eye. | `ShadowDeviceCapabilities.cs` `TRACKING_3DOF` vs `TRACKING_6DOF` |
| One + **Eye** = 6DoF head tracking (monocular SLAM; expect degraded quality). | docs.xreal.com/XREALDevices/Compatibility · Release Note 3.1.0 | 6DoF is runtime-detected + design for tracking-loss recovery. | `ShadowTrackingState.cs`, `ShadowSessionStateInfo.cs` (TrackingLimited/Lost) |
| **Beam Pro is an official "tested host"** (with Samsung S25). It is **not** a separate capability row — capability comes from glasses(+Eye), not the host. | Release Note 3.1.0 · Compatibility | Beam Pro is a valid deploy target; do NOT infer capability from the host. `PLATFORM_BEAM_PRO` is set only by an explicit host signal. | Detector `IsBeamProHost` (explicit only) |
| Beam Pro path requires **MyGlasses 1.11.0** + firmware auto-update on connect. | Release Note 3.1.0 | Surface a firmware/app-outdated state rather than silently failing. | (documented; runtime surfacing is a device-path TODO) |
| Controller = **3DoF phone controller** on all One/Air devices. | Compatibility | No 6DoF controller; interactions built on rotation + touch. | `ShadowCapability.CONTROLLER_3DOF` (3DoF max); `ShadowBeamProInputSource` (no positional) |
| RGB camera = the **Eye** accessory only; One base has no camera. First-person = "Application & Reality". | docs.xreal.com/Camera/Access RGB Camera · Compatibility | No camera on base glasses; first-person view only claimed after a real non-black frame. | Detector `FIRST_PERSON_VIEW_AVAILABLE` (needs NonBlackFrame) |
| On One Series (RGB Camera): **plane / image / hand tracking, depth mesh, spatial anchors = NOT supported** (only Air 2 Ultra = Yes). | Compatibility | These five are cleared unconditionally (fail closed) and never shown in UI. | `ShadowOfficialLimits.AlwaysUnsupported` |
| `GetTrackingType` must be called **only after `XREALLoader` started** (pre-3.1 crash fixed). New `NotTrackingReason.Scanning` value. Auto-Logcat-on-launch option. Glasses-exit → app-exit lifecycle. | Release Note 3.1.0 | Guard tracking-type queries on loader start; treat `Scanning` as Limited, not Lost. | `ShadowTrackingState.cs` (`CanQueryTrackingType`, `ShadowNotTrackingReason.Scanning`) |
| Android RGB **recording** permissions: `RECORD_AUDIO` + `FOREGROUND_SERVICE_MEDIA_PROJECTION`. Raw `CAMERA` permission **not** documented on that page → **官方未明确**. | Access RGB Camera | Declare recording perms only in the XREAL candidate; treat raw-frame CAMERA access as unproven. | `docs/security/SHADOW_CAPTURE_RETENTION_POLICY_DRAFT.md`; base candidate requests neither |
| Official **XR Device Simulator** (Editor) simulates head + controllers; "test critical features with actual glasses before deployment". | docs.xreal.com/Tools/Emulator | Iterate in-Editor, but nothing is "device-validated" until real hardware. | `ShadowDeviceCapabilities.DEVICE_VALIDATED` (never set in editor/emulator) |

**Never claim on One / One Pro (+Beam Pro):** plane tracking · image tracking · hand tracking · depth
mesh · spatial anchor · 6DoF without Eye · RGB/first-person without Eye · 6DoF controller. Enforced by
`ShadowOfficialLimits` + the detector's fail-closed inferences + a guard test.

---

## 2. Unity 6000.0 — engine, XR, build, profiling

| Fact | Source | Consequence | Code location |
|---|---|---|---|
| Unity 6.0 is LTS (supported through Oct 2026); XRI **3.0.x**, Input System **1.8.x**, XR Management **4.5.0**; min Android API **23**; Gradle 9.1 / AGP 9.0. | docs.unity3d.com/6000.0 WhatsNewUnity6 | Project has inputsystem 1.7.0 + XRI 3.0.3 + xr.management 4.4.1 — usable; engine bump before Oct 2026. | `Packages/manifest.json` |
| **IL2CPP is mandatory for ARM64** (Mono cannot target ARM64). | Manual/class-PlayerSettingsAndroid | The candidate build sets IL2CPP + ARM64 explicitly. | `ShadowGuidedStoryAndroidBuild.Configure()` |
| **uGUI (World Space) is the recommended solution for UI in a 3D world**; UI Toolkit world-space does not exist until 6.2 (we are on 6.0). UI Toolkit = screen-overlay menus only. | Manual/UI-system-compare; 6000.0 world-space-ui page 404 | World-space audit panels/labels stay uGUI/TextMesh; do NOT migrate world UI to UI Toolkit. | `ShadowDeviceCapabilityBanner.cs`, `ShadowGuidedStoryPlayer.cs` (TextMesh) |
| **Editor/Play-mode profiling is NOT representative** of device; profile a Development Build on device. Memory Profiler: "Editor snapshots always contain more memory… checked by analyzing a Player build." | Manual/profiling-collect-data-introduction; MemoryProfiler snapshot-capture | Instrumentation records an explicit measurement **layer** (Editor/AndroidPlayer/BeamPro); Editor numbers labeled non-representative. | `Diagnostics/ShadowPerformanceBudget.cs`, `ShadowPerformanceReport.cs` |
| Frame Timing Manager gives CPU vs GPU frame time; requires a few frames; perturbs GLES. | Manual/frame-timing-manager | On-device CPU/GPU split; prefer Vulkan on Beam Pro. | `Diagnostics/ShadowFrameTimingRecorder.cs` |
| **Physics.RaycastNonAlloc is current** (no deprecation) and the documented zero-GC single-query path; `RaycastCommand`+Jobs for many rays. | ScriptReference/Physics.RaycastNonAlloc; Manual/physics-optimization-raycasts-queries | Use NonAlloc into a pre-allocated array for any gaze/pointer ray. | (device pointer path — documented pattern) |
| URP guidance: **measure each setting before disabling**; disable Depth/Opaque texture + HDR when unused; **MSAA is cheap on tile GPUs — don't reflexively disable**. | Manual/urp/configure-for-better-performance | **This project uses the BUILT-IN render pipeline (no URP)** — the URP asset knobs are N/A; the built-in equivalents (Quality MSAA, shadow distance) are the levers, and must be measured on device first. | `ProjectSettings/GraphicsSettings.asset` (m_CustomRenderPipeline: 0) |
| XR Device Simulator ships as a **Package Manager Sample** (import Starter Assets + XR Device Simulator), not a menu; simulates HMD + controllers + **tracking loss** via inspector toggles. | Packages/…xr.interaction.toolkit@3.0/xr-device-simulator-overview | The official sim is the device-readiness path; our lightweight `Device Readiness Simulator` drives the router without hardware and documents the official import steps. | `Editor/GuidedStory/ShadowDeviceReadinessSimulator.cs` |
| Android Logcat package: on-device logs + addr2line native-crash symbolication. Unity 6 adds ANR/crash via `ApplicationExitInfo`. `BuildReport` at `Library/LastBuild.buildreport`. | Manual/com.unity.mobile.android-logcat; debugging-and-diagnostics; ScriptReference/BuildReport | logcat + performance collection scripts in the device package; build report captured at build time. | `device-test/v5/collect-logcat.sh`; build report writer |

**Honest gap:** the "UI Toolkit doesn't support 3D world-space picking/rendering" sentence is not
verbatim on the 6000.0 page (reworded); the load-bearing facts are the three cited quotes (uGUI
recommended for 3D-world UI, UI Toolkit = screen overlay, 2022.3 table world-space = "No"). The
conclusion (uGUI for world-space on 6.0) is unaffected.

---

## 3. Three.js — renderer + performance

Vendored copy: `prototypes/shadow-3d-v2/vendor/three.module.js` — **REVISION r160** (confirmed by
grep; the running player also reports `THREE.REVISION`). Latest stable is r185 (monthly cadence, no LTS).

| Fact | Source | Consequence | Code location |
|---|---|---|---|
| **WebGPURenderer is experimental**; WebGLRenderer is "the recommended choice for pure WebGL 2 applications." | threejs.org/manual/en/webgpurenderer.html | **Production default stays WebGLRenderer.** WebGPU would also require upgrading off r160 first. | `prototypes/shadow-3d-v2/src/shadow-guided-story-player.mjs` (WebGLRenderer) |
| **DPR**: manual advises against `setPixelRatio(window.devicePixelRatio)`; cap it; render at 1× and upscale on heavy scenes. | manual/en/responsive.html | Cap effective DPR (≤2, lower under load) — biggest single GPU lever on retina. | player `renderer.setPixelRatio(min(dpr, …))` |
| **Render-on-demand**: render on change events, not a continuous rAF loop; the official mechanism for `prefers-reduced-motion`. | manual/en/rendering-on-demand.html | Under reduced motion, stop the continuous loop and render on interaction/state change. | player reduced-motion path |
| **Disposal**: `renderer.dispose()` does NOT free scene geometries/materials/textures — traverse + dispose each on teardown. | docs How-to-dispose | Multi-scene switching must dispose per node; our `clearScene()` disposes geometry+material per node/edge. | player `clearScene()` |
| Raycaster checks bounding volume then every triangle; use `raycaster.layers` + a curated target array. | manual/en/picking.html · docs Raycaster/Layers | Keep `intersectObjects()` to the curated `meshes` array (already done); no whole-scene raycast. | player pointer/click handlers |
| InstancedMesh / BatchedMesh / LOD — only for many-identical / draw-call-bound / high-poly scenes. | docs InstancedMesh/BatchedMesh/LOD | **Not adopted** — the story player renders a small curated set; these add complexity without a measured win. | (evaluated, not applied) |
| a11y / `prefers-reduced-motion` — **官方未明确**; three.js has no turnkey a11y layer. | manual | Build our own: capability check + real 2D/text fallback + reduced-motion via render-on-demand. | player 2D fallback + reduced-motion |

**Renderer verdict:** keep WebGLRenderer. If WebGPU is ever wanted, first upgrade off r160, then adopt
the `three/webgpu` universal renderer (auto-falls-back to WebGL2) — never swap the renderer on the
vendored r160 file.

---

## 4. What this research changes in V5 (traceability)

- Capability model + fail-closed inferences ← §1 (XREAL limits).
- `ShadowOfficialLimits.AlwaysUnsupported` (5 capabilities) ← §1 compatibility table.
- IL2CPP/ARM64 candidate build ← §2 (IL2CPP mandatory).
- World-space UI stays uGUI/TextMesh ← §2 (uGUI for 3D-world UI; no UI Toolkit world-space on 6.0).
- Performance instrumentation split by measurement layer; Editor numbers non-representative ← §2.
- **URP tuning is N/A — built-in render pipeline**; built-in levers measured-first ← §2.
- Three.js keeps WebGLRenderer; apply adaptive DPR + render-on-demand + disposal (measure first) ← §3.

Full row-level matrix: `SHADOW_UNITY_XREAL_CURRENT_CAPABILITY_MATRIX.csv`. Product gaps + status:
`SHADOW_V5_PRODUCT_GAP_MATRIX.csv`.
