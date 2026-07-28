# Shadow Three.js guided-story adapter

Renders a compiled guided story in the browser. Isolated research prototype — same-origin only, no
external network, positions advisory, meaning authoritative.

## Files (`prototypes/shadow-3d-v2/`)

- `src/shadow-status-materials.mjs` — status → visual (shape geometry spec + severity colour +
  bilingual text). Pure, no `three` import, so it is Node-testable. Colour is redundant to shape +
  label.
- `src/shadow-guided-story-three-adapter.mjs` — pure layout: given the compiled `semantic` + a
  scenario + a layout, returns advisory `[x,y,z]` per node, per-node status/first-failure/downstream
  flags, edges, and the trust-dimension row. Five layouts: `timeline`, `arc`, `dag`, `radial`,
  `hybrid` (arc reuses the tested audit-arc math).
- `src/shadow-guided-story-player.mjs` — the browser-only runtime (imports `three`). Loads a
  PRE-COMPILED snapshot (`story-snapshots/<id>.threejs.json`) — no live compile in the browser.
- `story-player.html` — the page (CSP-locked; importmap for `three`; does not modify the existing
  `index.html`). `story-snapshots/*.threejs.json` — the pre-compiled data.

## Behaviour

- Status is shape + colour in 3D **and** named text in the side panel — never colour alone.
- Focus+context: the active step's focus entities stay lit; the rest dim, and detail shows in a
  stable 2D panel without rebuilding the scene.
- 2D fallback: hides the WebGL stage and shows the full semantic state as text (a real alternative,
  not a stub).
- Bilingual (EN/zh), reduced motion, recenter, keyboard stepping. Hover reveals; it does not select.
  Selecting does not approve.

## Regenerating the snapshots

```
for s in audit-chain reason-code-attestation persona-deliberation; do
  node tools/compile-shadow-guided-story.mjs --input fixtures/guided-stories/$s.guided-story.json \
    --target threejs --output prototypes/shadow-3d-v2/story-snapshots/$s.threejs.json
done
```

## Browser acceptance

Rendered on Chromium 149 (isolated profile, never the user's Chrome). Result: 0 external requests,
0 CSP violations, 0 console errors, 0 horizontal overflow at 1280×800 / 1440×900 / 390×844. Media in
`media/story-adapters/threejs/` (screenshots + `.webm` + `.mp4` + `recording-report.json`).

## Tests

`test/shadow-guided-story-three-adapter.test.js` (6 Node tests) covers the pure adapter + materials:
every status has a shape/colour/text, layouts produce finite non-collapsed positions, first-failure
+ downstream flags mirror the scenario, focus+context dims correctly, and the audit-chain tamper
scene keeps `ANALYTICAL_CORRECTNESS = NOT_EVALUATED`.
