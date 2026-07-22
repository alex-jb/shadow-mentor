# Three.js guided-story player — performance report (before/after)

Measured on Chromium 149 (isolated profile), 1280×800, `--enable-precise-memory-info`. 2026-07-21.
Full JSON: `threejs-perf-report.json`. Player: `prototypes/shadow-3d-v2/src/shadow-guided-story-player.mjs`.

Vendored **THREE.REVISION = r160** (confirmed at runtime via `window.__perf.revision`). Renderer =
**WebGLRenderer** (kept as production default per official guidance — WebGPURenderer is experimental
and r160 predates the mature universal renderer).

## Optimizations applied (measured, from the official research)

| Change | Basis | Result |
|---|---|---|
| **Render-on-demand under reduced motion** | threejs.org/manual rendering-on-demand | Idle draws drop to **0** while frames keep ticking |
| **Adaptive DPR cap** (≤2 normal, ≤1.5 reduced-motion) | threejs.org/manual responsive (don't use raw devicePixelRatio) | DPR is capped, not raw |
| **Per-node disposal on scene switch** (already present, verified) | threejs.org How-to-dispose | Memory flat across 24 switches |

## Measurements

| Metric | Value | Interpretation |
|---|---|---|
| continuous mode (1.5s) | 181 frames → **181 draws** | renders every frame for smooth OrbitControls damping (~120 fps) |
| reduced-motion idle (1.5s) | 181 frames → **0 draws** | render-on-demand: GPU idle when nothing changes — the biggest saving |
| reduced-motion, one step | **1 draw** | a state change draws exactly once, then stops |
| memory across 24 story switches | 9.18 MB → 9.31 MB (**+0.13 MB**) | disposal works; no unbounded growth |
| external requests / CSP / console errors | 0 / 0 / 0 | offline, self-contained, CSP-clean |

## Evaluated and NOT applied (with reason)

- **InstancedMesh / BatchedMesh / LOD** — the player renders a small curated set (≤ ~11 nodes); these
  target many-identical / draw-call-bound / high-poly scenes. No measured win; not adopted.
- **WebGPURenderer** — experimental per official docs, and r160 predates the mature `three/webgpu`
  universal renderer. Adopting it would require upgrading off r160 first. Kept WebGLRenderer.

## On-device note

These are desktop-browser numbers. Beam Pro / mobile GPU behavior differs and must be measured on the
target browser when a device is available. Nothing here is a device-validated claim.
