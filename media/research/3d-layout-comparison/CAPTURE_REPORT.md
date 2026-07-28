# 3D layout comparison — capture report

Real renders of the isolated Three.js prototype (`prototypes/shadow-3d-v2/`) via Playwright/Chromium
**149.0.7827.55**, isolated context (not Alex's Chrome), served same-origin at 127.0.0.1:8901.

- **THREEJS-RENDERED ✅ · THREEJS-RECORDED ✅** — `layout-comparison.{webm,mp4}` (~14s), 1280×720.
- Screenshots (same `shadow-3d-scene-v1` fixture): `current-arc.png`, `layered-dag.png`, `timeline.png`,
  `hybrid.png`, `tamper-propagation.png`, `claim-to-source.png`, `zh-CN-layout.png`, `hybrid-2d-fallback.png`.
- Acceptance (all PASS): **0 external requests · 0 console errors · 0 horizontal overflow** (arc + zh at
  1280×720). Same fixture across layouts; exact tamper failure = seq 3, downstream 4/5/6 identical in every
  view; Chinese labels render without clipping; 2D audit fallback works; reduced-motion toggle present.
- Status encoded by **shape + text + colour** (VERIFIED icosahedron/green, TAMPERED octahedron/red,
  NOT_VERIFIED box/dim) — never colour alone. Six independent checks + **analytical correctness NOT
  EVALUATED** shown separately.

Do **not** read this as Unity recording or device validation — it is browser Three.js only.
Regenerate: serve `prototypes/shadow-3d-v2/`, run the capture harness. Verify: `shasum -a 256 -c SHA256SUMS.txt`.
