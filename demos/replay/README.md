# `demos/replay/` — M5 2D timeline demo (skeleton)

**Status**: SKELETON ONLY. No implementation yet.

**DO NOT IMPLEMENT** until Alex confirms a real Claude Code bundle exists to
test against (M2.1 validation weekend of 2026-07-12/13; adapter shipped by
`packages/adapter-claude-code/`). Building this against synthetic bundles
first risks locking in shapes that don't match reality.

---

## Where the design lives

Full design doc: [`../../docs/spec/m5-replay-2d-design.md`](../../docs/spec/m5-replay-2d-design.md).

Read that before writing any code in this folder. It covers user story,
file structure, event-to-UI mapping, tamper state machine, verifier-error
consumption rules, presenter-mode reservation, day-1 scope, acceptance
criteria, and non-goals.

## Companion specs

- [`docs/spec/verifier-error-format.md`](../../docs/spec/verifier-error-format.md)
  — the `{seq, reason, impact}` shape the tamper caption MUST consume verbatim.
- [`docs/roadmap/SHADOW_XR_DEMO_BRIEF.md`](../../docs/roadmap/SHADOW_XR_DEMO_BRIEF.md)
  §X5 — visual language for the tamper animation. M5 2D is a subset of X.
- [`packages/adapter-claude-code/README.md`](../../packages/adapter-claude-code/README.md)
  — event vocabulary Shadow captures (the 9-row table).
- [`packages/attest-core/session.js`](../../packages/attest-core/session.js)
  `verifyBundle` — the function this demo imports and calls verbatim. No
  re-implementation permitted.
- [`verify.html`](../../verify.html) — existing offline verifier. Grieve its
  UX: keep the drop-zone + PEM-textarea + result-card discipline; abandon
  the single-verdict layout in favor of the per-event timeline.

## Prose summary (skimmable)

An auditor opens `index.html` from a USB stick, drops a `.bundle`, and sees a
horizontal timeline of every Shadow event captured by the Claude Code
adapter. Clicking a row opens a payload inspector on the right. A "Tamper"
button mutates one predetermined `file_write` payload in the working copy,
re-runs the real `verifyBundle`, and renders the verifier's structured error
`{seq, reason, impact}` as a floating caption on the broken block, with all
downstream blocks dimmed. A "Reset" button restores pristine state without a
page reload. That is day 1. XR chain-corridor is v3.1.

## Discipline (do not violate)

- Zero build step. Opens from `file://`.
- Zero npm install for this folder.
- Zero runtime CDN imports.
- Zero telemetry, analytics, CDN fonts.
- No 3D, no animation library, no React/Vue/Svelte/Solid.
- No re-implementation of `verifyBundle`. Import the real one from
  `packages/attest-core/session.js`.
- No hardcoded strings in the tamper caption. Every character comes from
  the verifier's returned error object.

---

## File placeholders

The following files will be created when implementation starts (after M2.1
live-bundle validation). They do not exist yet. Header comments below
document what each will contain.

### `index.html`

```html
<!--
  Shadow M5 replay demo — 2D timeline entry point.

  Contains: drop zone + PEM public-key textarea + horizontal timeline
  container + inspector panel + tamper/reset button pair + caption slot.

  Loads main.js as a single ES module:
    <script type="module" src="./main.js"></script>

  Styles: styles.css only. No inline style attributes. No CDN fonts.
  Colors match verify.html palette (--bg #0b0d10, --ok #4ade80, --bad #ef4444)
  so an auditor moving between the two tools sees the same visual language.
-->
```

### `main.js`

```js
/*
  Entry module. Wires:
    - drop zone → parse JSON bundle
    - hold two references: pristineRef (deep-frozen) + workingBundle (mutable)
    - call timeline.render(workingBundle)
    - button → tamper.trigger(workingBundle) → re-render + caption
    - reset button → workingBundle = structuredClone(pristineRef) → re-render

  Imports:
    import { verifyBundle } from "../../packages/attest-core/session.js";
    import { renderTimeline } from "./timeline.js";
    import { renderInspector } from "./inspector.js";
    import { triggerTamper, resetTamper } from "./tamper.js";

  Deliberate: no bundler. Relative ESM paths only. Modern Chrome/Firefox
  resolve these from file:// without a dev server.
*/
```

### `timeline.js`

```js
/*
  Horizontal row list. One row per event in bundle.events.

  Exports:
    renderTimeline(bundle, { onSelect, tamperedSeq }) → renders into
    #timeline element; calls onSelect(event, index) on row click; if
    tamperedSeq !== null, applies red flash to that row and dims all rows
    with index > tamperedSeq to 35% opacity + broken-link icon.

  Icons: inline SVG per event type per the mapping table in the design doc.
  Color encodes STATUS only, never event type (XR §X2 colorblind rule).
*/
```

### `inspector.js`

```js
/*
  Right-side payload card for the selected event.

  Exports:
    renderInspector(event) → renders formatted JSON of event payload +
    metadata (seq, prev_hash, payload_hash). Copy-hash affordance.

  Never renders raw prompt text or raw tool_output — those are hashed in the
  bundle; only the hashes are shown. Matches the adapter's raw-payload
  discipline (see packages/adapter-claude-code/README.md §"Raw payload
  discipline").
*/
```

### `tamper.js`

```js
/*
  PRISTINE ↔ TAMPERED state machine.

  Exports:
    triggerTamper(workingBundle, publicKeyPem) → mutates first file_write
    payload_hash (last hex nibble flipped), calls verifyBundle, receives
    VerifierError per docs/spec/verifier-error-format.md, returns
    { seq, reason, impact } for the caption + tamperedSeq for the timeline.

    resetTamper(workingBundle, pristineRef) → deep-copies pristineRef back
    into workingBundle; returns null tamperedSeq.

  Shim (delete when Thu 2026-07-17 port lands):
    Today verifyBundle returns { ok:false, reason, failedSeq }. Adapt to
    { seq: failedSeq ?? null, reason, impact: <synthesized per format doc> }.

  ZERO hardcoded caption strings. The synthesized impact sentence (shim
  only) MUST follow the format doc's Rules for `impact` §5 verbatim.
*/
```

### `styles.css`

```css
/*
  All styles. Palette matches verify.html. CSS @keyframes for red edge
  flash (0.4s) and downstream dim; no animation library. Grid layout for
  timeline (rows) + inspector (right panel) + caption (floating over
  broken row).
*/
```

### `data/demo-session.bundle`

Not committed until M2.1 ships a real recording. Bundle will be sanitized
per XR brief §X6: strip absolute paths outside the project, strip
tokens/env values, re-sign with a demo key, document as such in the bundle
header.

---

## Implementation gate

Do NOT create any of these files before Alex confirms:

1. `@shadow/adapter-claude-code` v0.1.0 shipped and hooked into his live
   Claude Code CLI (weekend 2026-07-12/13).
2. A real `.bundle` exists at `~/.shadow/sessions/<id>.bundle` and passes
   `shadow-verify` with `SELF_SIGNED` trust level.
3. The bundle contains ≥ 3 `file_write` events (needed for tamper target).

If any of the three fails, fix the adapter or the sanitizer first. Do not
build the demo against synthetic-only bundles — the point of the 2D demo
is to render *the real evidence* an auditor would hold.
