# The Audit Room — Shadow M5 XR spatial evidence replay

An offline 3D replay of a signed Shadow evidence bundle: the audit chain as a
spatial object you can walk, tamper, and heal — on a laptop, on XREAL One Pro
in stereo, or in a Quest headset for the user study. Built to the end-state
spec `SHADOW_M5_XR_COMPLETE_SPEC.md`.

## Run it

```
node build.mjs          # from this dir (or `node demos/replay/3d/build.mjs`)
```

Then **double-click `index.html`** (or drag it into Chrome). No server, no
network, no flags — the whole app is one self-contained script.

- `?xreal=1` — XREAL optics preset (pure-black bodies, font bump for ~33 PPD)
- `?mode=sbs` — start in side-by-side stereo · `?mode=webxr` — Quest mode
- `?presenter=1` — presenter beat HUD + crash watchdog

See **`CONTROLS.md`** for the full keyboard/voice map and **`DEMO_SCRIPT.md`**
for the pre-flight checklist and the 8-beat stage script.

## Scope

Everything here is additive. It never modifies the 2D replay
(`demos/replay/index.html`), `attest-core`, the bundle schema, or the
credit-council path. `git checkout` of the 2D demo still runs unchanged — the
3D room reuses the *same* verifier (`../verify-browser.js`) and tamper state
machine (`../tamper.js`), so a tampered bundle exported from here reproduces
the identical failure in `../verify.html`.

## Files

| File | Role |
|------|------|
| `constants.js` | The ONE named-constants block — every spatial/legibility/timing value, tunable against the glasses (principle 8) |
| `labels.js` | In-scene text (canvas-on-plane; see *Deviations*) |
| `verify.js` | Reuses the real browser verifier + tamper machine; adds annotation re-seal |
| `scene.js` | The Audit Room: arc, cards, connectors, cascade, lenses, inspector, proximity, trust badges |
| `stereo.js` | SBS two-viewport stereo (`StereoCamera` + manual viewports) |
| `voice.js` | Push-to-talk → closed intent enum (Jarvis layer) |
| `gamepad.js` | Optional presenter gamepad (mirrors keyboard verbs) |
| `beats.js` + `demo-beats.json` | Presenter camera beats |
| `webxr.js` | Quest 3 immersive mode (study only, IRB-gated) |
| `app.js` | Orchestrator: modes, keyboard (authoritative), HUD, watchdog |
| `build.mjs` | Inlines the demo data + bundles everything into `dist/audit-room.js` |
| `demo-data.js`, `dist/audit-room.js` | **Generated** by `build.mjs` — committed so double-click works |

Phase mapping (spec §Phases 1–7): 1 optics/constants · 2 stereo · 3 tamper
cascade → real verifier · 4 voice + lenses + signed annotations · 5 proximity
+ inspector + trust badges · 6 Quest (study) · 7 beats + watchdog + offline.

## Deliberate deviations from the spec wording (and why)

1. **Text is canvas-on-plane, not `troika-three-text`.** The binding
   constraint is Phase 7.4 — the demo must run offline from `file://`. troika
   fetches its default font, and Chrome blocks *every* fetch on a `file://`
   page, so troika text would silently vanish on stage — exactly the failure
   the reliability kit exists to kill. Canvas planes render from system fonts
   with no fetch, are just as much scene objects (no DOM, correct per-eye in
   SBS), and are drawn at high DPI to stay crisp at ~33 PPD. All text lives in
   `labels.js`; swapping to troika later (with a data-URI font) is a
   one-file change.
2. **One classic IIFE, not ES modules + importmap.** Chrome blocks ES-module
   loading from `file://` (unique-origin CORS). `build.mjs` bundles the whole
   app — our modules + three + the shared verifier — into a single classic
   `<script>` so the page truly runs by double-click, honouring "single
   static build, offline from file://".

## Tests

`test/replay-3d.test.js` (repo root) covers the DOM-free load-bearing logic:
the closed-enum voice parser and the real verify/tamper/annotate flows.
Run with `node --test test/replay-3d.test.js`.
