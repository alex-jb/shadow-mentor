# Shadow Lens V11 — scene structure audit (offline)

## Audit Workspace — reconstructed architecture

### A. Roots and lifecycle — `PROVEN_FROM_GENERATOR_CODE`

`ShadowV11BeamProCandidate.BuildScene()` creates an **empty scene** with exactly four roots:
`Main Camera`, `Directional Light`, `AuditWorkspaceBootstrap`, `CandidateBanner` (a `TextMesh`).
`ShadowAuditWorkspaceDeviceBootstrap.Awake()` then adds `ShadowDeviceDiag` to itself and creates one
child `AuditWorkspace` carrying `ShadowAuditWorkspace`.

`ShadowAuditWorkspace` builds exactly **five region roots** — `region.top`, `region.left`,
`region.center`, `region.right`, `region.bottom` — and rebuilds them by **clearing children and
reusing the region GameObject**, never recreating it (`Region(key, pos)`).
`RebuildAll()` fires on `Bind`, `BindDirect`, `FocusOn`, `SetZh`, `SetTracking`, `SwitchMode`.

No `DontDestroyOnLoad`, no scene loading, no duplicate systems, no persistent singletons.
Reset behaviour is verified: `ShadowAuditWorkspaceLifecycleTests` runs 32 rebuild cycles and asserts
regions stay at 5, texts return to baseline, unique material count is fixed, destroy leaves 0 orphans,
and a recreate matches the baseline. `PROVEN_FROM_RUNTIME_TEST`.

### B. Camera and XR — `PROVEN_FROM_GENERATOR_CODE`

| Property | Value |
|---|---|
| Cameras in scene | **one** — `Main Camera`, tagged `MainCamera` |
| Position / aim | `(0, 0.1, −7.0)`, `LookAt(0, 0.1, 0)` |
| Clear flags | `SolidColor`, black (transparent on OST) |
| **XR Origin** | **absent** |
| **TrackedPoseDriver** | **absent** |
| **XREALSessionManager** | **absent** |
| XR Interaction Toolkit rig | absent |
| Desktop fallback camera | same single camera |
| Clipping planes / FOV / culling mask | Unity defaults (never set) |
| Assumed tracking mode | `TRACKED_3DOF` is passed as a **string** to the workspace for display only |

**The scene displays a tracking state it does not consume.** `ShadowAuditWorkspace.Tracking` drives a
header label and a degraded-tracking banner; nothing in the scene converts head pose into camera
motion, because no pose driver exists. Per the standing rule this is recorded as a **future
loader/display-stage risk and runtime architecture concern**, **not** as the current MR package-handoff
root cause — candidate-04 fails before this stage is ever reached.

The official XREAL HelloMR sample, by contrast, instantiates the SDK's `XR Interaction Hands Setup`
prefab (EventSystem + Input Action Manager + XR Interaction Manager + `XREALSessionManager` + a nested
XRI XR-Origin that supplies the camera). `PROVEN_FROM_GENERATOR_CODE` on both sides.

### C. UI rendering — `PROVEN_FROM_GENERATOR_CODE`

**Zero Canvases. Zero UI Toolkit documents. Zero TextMeshPro components. No EventSystem, no input
module, no raycaster, no Selectable.** Every visible element is a world-space legacy `TextMesh` or a
`PrimitiveType.Quad` with a shared `Unlit/Color` material from a hex-keyed cache.

That choice is deliberate and documented ("rendering primitives are stable … to stay compile-robust")
and it is why the canvas-rebuild / layout-group performance risks in the usual Unity UI checklist do
**not** apply here. It also means there is **no focus, hover, selected, disabled or hit-target model at
all** — Prev/Next/Select exist only as keyboard/joystick calls into `FocusOn`.

### D. Geometry — `PROVEN_FROM_GENERATOR_CODE` + `DERIVED_GEOMETRIC_ESTIMATE`

Region local positions (workspace root at origin):

| Region | Local position | Content extent (local) |
|---|---|---|
| `top` | `(−3.30, 2.05, 0)` | 0 → −0.46; degraded banner at **x +2.90** |
| `left` | `(−3.30, 1.10, 0)` | 0 → −0.62 |
| `center` | `(−0.90, 1.10, 0.05)` | 0 → −1.02 |
| `right` | `(2.25, 1.10, 0)` | 0 → −1.04 (4 rows × −0.26) |
| `bottom` | `(−2.40, −1.60, 0)` | +0.16 → −0.36; rail step **x +0.62** |

Type scale: `T_TITLE 0.052`, `T_HEAD 0.030`, `T_LABEL 0.030`, `T_BODY 0.026`, `T_SMALL 0.022`
(`characterSize`, `fontSize` 64 for all).

**Capture frame maths** — camera `(0, 0.1, −7.2)`, FOV_v 40°, 1600×1000 (aspect 1.6):

```
d              = 7.2
half-height    = d · tan(20°)      = 2.621   → visible height 5.241
half-width     = half-height · 1.6 = 4.193   → visible width  8.386
px per world unit = 1600 / 8.386   = 190.8
visible x ∈ [−4.193, 4.193]   visible y ∈ [−2.521, 2.721]
```
`EDITOR_GEOMETRY_ESTIMATE` — this is the capture rig, **not** a Beam Pro field of view. No headset FOV
value is asserted anywhere; the repository does not supply one.

Derived gaps:

| Measure | World units | px | Longest observed content | Verdict |
|---|---|---|---|---|
| left → center | 2.40 | 458 | `SOURCE NOT PRESENT` = 438 px | 96 % consumed — **collides** |
| center → right | 3.15 | 601 | `▶ OPEN 2D AUDIT — inspect the first failure` = 693 px | **overflows by 92 px** |
| right → frame edge | 1.94 | 371 | `APPROVAL ABSENT` ends 47 px from the edge | **near-clip** |
| banner origin (x −0.40) → edge | 4.59 | 876 | `TRACKING LOST — switched to session-relative layout;` | **clipped mid-sentence** |
| body row step | 0.12 | 22.9 | rendered line box ≈ 30 px | **rows overlap** |
| trust label→value step | 0.10 | 19.1 | rendered line box ≈ 30 px | **label/value overlap** |
| center bottom (y 0.08) → rail top (y −1.44) | 1.52 | 290 | — | **29 % of frame height empty** |

## Audit Room Flat — reconstructed architecture

`PROVEN_FROM_GENERATOR_CODE`. `demos/replay/3d/` builds a card arc plus an anchored inspector with an
elbow leader line and endpoint dot; `flat-fit.js` computes a deterministic fit-to-content camera
(`fitDistance` maximises over width- and height-driven distances with `fill 0.78` / `fillV 0.4`);
`app.js` adds an in-scene Trust header and a dismissible first-entry hint, and demotes the old bottom
status line to a grey diagnostic. Verified in real Chromium in an earlier increment; **no capture is
committed to the repository**, so its current state is `PROVEN_FROM_GENERATOR_CODE`, not
`PROVEN_IN_EDITOR_CAPTURE`.

Palette (`constants.js`): `intact #E8E8E8` (neutral resting **surface**), `tampered #FF4A4A`,
`healed #3DDC97` (transient pulse), `text #E8E8E8`. The `AuditRoomProvenance` override is documented
in-source and pinned by `test/threejs-profile-override.test.js`.
