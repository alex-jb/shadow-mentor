# Three.js render-risk report — Shadow audit-room (`demos/replay/3d/`)

Static, read-only audit. Single inlined `DEMO_BUNDLE` (12 events) — **no multi-story switching exists**;
the analogous rebuild path is `annotate → layout()`. Numbers are static-derived, not device-measured. No
Beam Pro / XREAL performance conclusion is drawn from these — device numbers require the hardware.

## Snapshot
| Metric | Value |
|---|---|
| Distinct geometry classes | 3 (`BufferGeometry`, `PlaneGeometry`, `RingGeometry`) |
| Geometry instances (flat build) | ~64 (4 per card × 12 + 11 connectors + badges/HUD) |
| Materials | ~64 (one per object, `LineBasicMaterial`/`MeshBasicMaterial`, unlit) |
| Transparent objects | ~64 (**effectively all**) |
| Raycast targets | 12 (scoped, non-recursive) ✅ |
| Peak objects | ~88 flat · ~108 XR |
| Draw calls | ~75–90 flat · **~150–180 SBS** (scene rendered twice) |
| Render-on-demand | ❌ continuous rAF |
| Disposal | present but **incomplete** |
| Leak risk | **medium** |

## Findings (ranked)

### 1. Transparency overdraw — highest fill-cost risk
Nearly every object is `transparent:true` / `opacity<1`. Per card, **4 translucent layers** sit in a
0.002-unit z-window (face `scene.js:92`, edge `scene.js:52`, detail `scene.js:100`, hit `scene.js:107`)
with `depthWrite:false` → the GPU sorts ~48 stacked card layers + 11 connectors every frame. **SBS doubles
it.** On XREAL's fill-limited X1 this is the dominant per-eye cost. *Fix:* raise `depthWrite` where opaque
enough, reduce stacked translucent layers, or pre-composite the card face+detail into one texture.

### 2. No render-on-demand — idle frames still render
`app.js:313-318` (flat) and `app.js:319-330` (XR) render every frame regardless of change. OrbitControls
damping + proximity fades justify *some* continuous frames, but a dirty-flag that pauses rendering when the
camera + scene are static would cut idle GPU/thermal load. *Fix:* render-on-demand gated by control change
+ active tween.

### 3. `layout()` rebuild leaks GPU resources — medium
`scene.js:213-214` removes all 12 card groups (`group.remove`) then `cards.length = 0` **without
disposing** each card's 4 geometries + 4 materials + 2 `CanvasTexture`s. `buildTrustBadges` (`scene.js:163`)
leaks its 3 label meshes the same way. `layout()` runs on every `annotateSelected` (`scene.js:402`), so N
annotations orphan ever-larger card sets. A `disposeMesh` helper already exists (`labels.js:144-149`) and is
used correctly elsewhere (connectors/caption/inspector/HUD) — it just isn't called on the card teardown.
*Fix:* `cards.forEach(c => c.group.traverse(disposeMesh))` before clearing.

### 4. No instancing / geometry sharing — high draw-call count
12 identical `PlaneGeometry(CARD_W,CARD_H)` cards each build their own buffer + material; zero
`InstancedMesh`/`mergeGeometries`. Low absolute count so not urgent, but every card is its own draw call,
compounding item 1 under SBS. *Fix:* share one card geometry + material template; consider instancing for
the 12 identical faces.

### 5. High-DPI canvas-texture labels — memory + churn
Labels are `CanvasTexture` planes at `PX_PER_UNIT=900` (`labels.js:22`) → a 4.4-unit caption ≈ 3960px-wide
texture. Card faces are correctly reused via `repaint()` (`labels.js:135`, `scene.js:236`) ✅, but all other
`makeText` labels (HUD status, caption, inspector, beat text) are recreated per update. *Fix:* cap
`PX_PER_UNIT`, and pool/repaint the HUD + caption labels like card faces.

### 6. Per-frame `Vector3` allocation — minor GC
`scene.js:428` allocates `new THREE.Vector3()` per card per frame. *Fix:* hoist a scratch vector.

## What's already good (don't touch)
- Raycasting is scoped to 12 hit planes, non-recursive (`scene.js:471`) — cleanest part of the runtime.
- Disposal helper exists and is correctly applied on connectors/caption/inspector/HUD swaps.
- Heavy modes (SBS, WebXR, xreal preset, presenter) all default **off**; base load is flat.
- `lib/spatial-render.js` (server JSON layout, no THREE) already encodes a `full→reduced→focus→tethered`
  FPS-fallback ladder (`spatial-render.js:152-155`).

## Honest limits
Static analysis only. Object/draw-call counts are derived from the code, not a profiler capture. Fill-rate
"risk" is architectural reasoning about a fill-limited OST chip — **not** a measured frame time. Any
"passes on Beam Pro / XREAL" claim requires the device.
