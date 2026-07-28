# Unity asset + runtime-allocation risk report — Shadow Lens

Static, read-only audit (2026-07-22). **The project imports ZERO meshes/materials/textures/prefabs** — all
visuals are procedural C#. So the "asset risk" is not import settings; it is **runtime allocation**. Numbers
are static-derived; **no Beam Pro / device performance conclusion is drawn from Editor metrics.**

## Imported-asset inventory (the short version)
| Kind | Count | Note |
|---|---|---|
| Imported meshes (.fbx/.obj/…) | **0** | node meshes are `GameObject.CreatePrimitive` (built-in, shared) |
| Imported materials (.mat) | **0** | 2 `new Material(Shader.Find("Sprites/Default"))` at runtime + `.material` auto-clones |
| Imported textures | **0** | no image assets; dynamic font atlas is the only runtime texture |
| Prefabs | **0** | UI assembled via `AddComponent<>` (×46) at runtime |
| TMP font assets | **0** | **no TextMeshPro anywhere** — legacy `Text` + `TextMesh` with built-in dynamic font |
| Scenes | 3 | near-empty bootstrappers (1 camera + 1 light + 1 renderer each) |

Full per-file data in the sibling CSVs (`UNITY_{MESH,MATERIAL,TEXTURE,FONT,SCENE}_INVENTORY.csv`).

## Runtime-allocation findings (ranked)

### 1. GuidedStory rebuilds the whole graph every step — highest alloc risk
`GuidedStory/ShadowGuidedStoryPlayer.cs:82-111 Rebuild()` does a full destroy+recreate: `Destroy` every node
(`:84`), then `CreatePrimitive` + `AddLabel` every node/step. Fires on Next/Back/Restart/lang-toggle/2D-toggle
(`:73-77`). Each rebuild re-allocates colliders + material instances + `TextMesh` labels and **thrashes the
dynamic CJK font atlas** when the Zh toggle triggers a rebuild. *Fix:* pool `_nodeObjects` — update
position/color/label in place instead of Destroy+CreatePrimitive.

### 2. `ShadowStageController.Render()` is the good pattern (keep)
By contrast, `Narrative/ShadowStageController.cs` builds the world **once** (`BuildWorld` in `Build`) and
`Render()` only `SetActive`/recolors/sets text (`:234-248`). Incremental — this is the model the GuidedStory
path should follow.

### 3. `MaterialPropertyBlock` is used nowhere (0) — should be, in 2 hot spots
- `Spatial/ShadowHeadDirectedFocus.cs:48-56` recolors `renderer.material.color` **per frame while hovering**
  → instantiates a per-renderer material. Use `Get/SetPropertyBlock`.
- `ShadowStageController.cs:238` recolors 5 council nodes on every state change via `.material`.

### 4. Per-frame cost in the hover raycast — minor but real
`ShadowHeadDirectedFocus.cs:34-44 Update()`: `Physics.Raycast` every frame (ok), but on hover it does
`GetComponent<Renderer>()` + `.material` access + **per-frame string construction**
(`go.name.Substring(6)` + `ModeLabel + ": " + …`, `:41`). *Fix:* cache the voice name on the node; rebuild
the focus label only when the hovered target changes.

### 5. Two separate `Sprites/Default` LineRenderer materials
`ShadowStageController.cs:162` (audit chain) and `:199` (case ring) each `new Material(Shader.Find(...))`.
Both are created once (idempotent guards, ok) but are two instances + two `Shader.Find` string lookups.
*Fix:* one static cached material shared by both.

### 6. Static + dynamic content on the same overlay canvas — canvas-rebuild risk
`Mock/ShadowInstitutionalLayoutController.cs:21-31` and the Stage HUD put frequently-changing text
(answer/status/citations/`_council`/`_decision`) on the **same** canvas as static chrome, so each text edit
rebuilds the whole canvas VBO. Citations are `Destroy`ed/added per query
(`ShadowSpatialAgentPanel.cs:207-219`). *Fix:* move dynamic text to a child canvas.

### 7. Transparency / overdraw on an OST display
Passthrough panel fills are alpha `0.86/0.82` (`ShadowDesignTokens.cs:40-41`); the `SourceOverlay` fills the
whole paper translucently over opaque text (`ShadowLensMockView.cs:155-162`); and **every bordered panel adds
an `Outline`** (`ShadowMaterials.cs:20`) which duplicates geometry 4× as extra transparent draws. Compounded
by many world-space canvases (one per label). *Fix:* drop `Outline` where a solid border image suffices;
reduce stacked translucent plates.

### 8. World-space canvas count — many tiny canvases
Every `FlatWorldLabel` (`ShadowStageController.cs:135`) + case label + doc/audit/artifact panels are each
their **own** world-space `Canvas`. Isolation keeps rebuild scope small (good) but the raw canvas + draw
count is high. GraphicRaycaster count = **2** (both screen-space overlays) — fine.

## Status system — VERIFIED (already color + shape + text; do not rewrite)
`GuidedStory/ShadowGuidedStoryStatus.cs:14-19` defines **13 statuses**: `VERIFIED, FAILED, PRESENT,
NOT_PRESENT, NOT_CHECKED, NOT_EVALUATED, WARNING, UNSUPPORTED, MALFORMED, ABSTAINED, REQUIRES_HUMAN_REVIEW,
AFFECTED_DOWNSTREAM, FIRST_FAILURE` — covering every value the V11 brief requires
(`DOWNSTREAM_AFFECTED`=`AFFECTED_DOWNSTREAM`). Encoding is **color + shape + text**, not color-only:
`ColorKeyOf` (`:55-65`) + `ShapeOf` (`:69-81`, icosahedron/octahedron/tetrahedron/disc/ring/pill/box) + the
player appends the status text (`ShadowGuidedStoryPlayer.cs:104-105`). Header comment: *"Status is carried by
TEXT + SHAPE + colour token — never colour alone."* **Consolidation task, not a rewrite.**
- **One gap:** `ShadowStageController` council nodes are all Spheres, distinguished by **color only** (`:117`,
  `:238`) — a minor a11y gap vs the GuidedStory shape encoding.

## Tracking states — MODEL present + Scanning explicitly handled; auto-fallback ABSENT
`Device/ShadowTrackingState.cs:9` enum `{ None, Initializing, Scanning, RelocalizationInProgress, Unknown }`
→ health `{ Nominal, Limited, Lost }`. **Scanning is explicitly a Limited state, not a default fall-through**
(`:28-31`, `default→Lost` fail-closed `:32-33`). Session descriptions
(`ShadowSessionStateInfo.cs:37-64`) cover `Xreal3DofSession`/`XrealEye6DofSession`/`TrackingLimited`/
`TrackingLost`, each naming a **2D-audit fallback**. Bare One Pro pinned 3DoF (`Core/MockTrackingProvider.cs:9`).
- **Gap:** render controllers (`ShadowStageController`, `ShadowLensMockView`, `ShadowGuidedStoryPlayer`) do
  **not** subscribe to tracking health; the 2D fallback is a described capability + a manual `_mode2D`
  keyboard toggle, **not auto-triggered on `TrackingLost`**. That auto-degrade wiring is the V11 gap to close.

## Theme — DARK ONLY; XREAL_OST_BRIGHT is genuinely missing
`Design/ShadowDesignTokens.cs` is a single dark theme (`Background #090D12`, `PanelPrimary #111820`) + low-
alpha passthrough fills — **no bright/OST/daylight variant, no theme switch**. `ShadowLegibilityProfiles.cs`
has 5 *layout* profiles (safe-zone/clipping/opacity), not color themes. On a see-through OST display the dark
UI + 0.10-alpha borders will wash out. **XREAL_OST_BRIGHT is a net-new implementation, not a consolidation.**

## Top 6 high-confidence, low-risk fixes (justified by the above)
1. Pool GuidedStory nodes instead of destroy+recreate — `ShadowGuidedStoryPlayer.cs:84-107`.
2. `MaterialPropertyBlock` for the per-frame hover recolor — `ShadowHeadDirectedFocus.cs:46-58`.
3. Kill per-frame string alloc in the hover Update — `ShadowHeadDirectedFocus.cs:38-44`.
4. Share one cached `Sprites/Default` LineRenderer material — `ShadowStageController.cs:162,199`.
5. Split static vs dynamic overlay canvases — `ShadowInstitutionalLayoutController.cs:52-63`.
6. Add `XREAL_OST_BRIGHT` token variant + reduce `Outline` overdraw — `ShadowDesignTokens.cs:22-41`,
   `ShadowMaterials.cs:20`.

## Honest limits
No imported-asset pipeline metrics exist to report (there are no imported assets). All findings are code-
level and static. Any vertex/triangle/atlas-memory or frame-time number that would require the Unity import
pipeline or the device is intentionally NOT asserted here.
