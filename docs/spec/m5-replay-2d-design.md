---
title: M5 replay demo — 2D timeline design
status: DRAFT — design frozen 2026-07-10, implementation after M2.1 live-bundle validation weekend of 2026-07-12/13
depends_on:
  - packages/attest-core/session.js `verifyBundle`
  - docs/spec/verifier-error-format.md (`{seq, reason, impact}`; X5 captions MUST consume verbatim)
  - packages/adapter-claude-code/README.md (event vocabulary)
  - docs/roadmap/SHADOW_XR_DEMO_BRIEF.md (X1–X9; M5 2D is a subset)
enables: 2026-08-02 launch demo; XR chain-corridor v3.1
authors: Alex Ji + autonomous session 2026-07-10
---

# M5 replay demo — 2D timeline

## 1. User story

Auditor opens `demos/replay/index.html` from a USB stick, drops a `.bundle`,
sees a horizontal timeline of every Shadow event. Clicking a row opens a
payload inspector. "Tamper" flips `PRISTINE → TAMPERED`: mutates one
predetermined `file_write` payload in the in-memory working copy, re-runs the
real `verifyBundle`, receives a `VerifierError` per
`docs/spec/verifier-error-format.md`, renders `seq / reason / impact` verbatim
as a floating caption on the broken block, dims downstream. "Reset" restores
pristine state without page reload.

## 2. File structure — `demos/replay/`

Zero build step, opens from `file://`, no npm install, no bundler.

```
demos/replay/
├── index.html    drop zone + timeline + inspector + tamper controls
├── main.js       entry: drop → parse → render → tamper
├── timeline.js   row list + selection state
├── inspector.js  payload card for selected event
├── tamper.js     PRISTINE↔TAMPERED; re-runs verifyBundle; renders caption
├── styles.css
├── data/demo-session.bundle  (post-M2.1) real recording
└── README.md
```

`main.js` imports `verifyBundle` from `../../packages/attest-core/session.js`
via relative ESM. `verify.html` proves WebCrypto works from `file://`.

## 3. Event-to-UI mapping

Vocabulary from `packages/adapter-claude-code/README.md` §"What it captures".
Per row: icon · label · summary · click target.

| Event | Icon · Label · Summary · Click target |
|---|---|
| `session_start` | gate-open · "session start" · `source·model·title` · header+`session_id` |
| `prompt` | speech-bubble · "user prompt" · `prompt_id`+`prompt_sha256`[:12] · prompt hash record |
| `tool_call` | wrench · `tool_name` · `tool_input`[:60] · full `tool_input` JSON |
| `tool_result` | wrench-check · `tool_name` result · `output_sha256`[:12] · output hash record |
| `tool_error` | triangle · `tool_name` error · error[:80] · full error string |
| `subagent_stop` | agent-badge · `agent_type` stop · `agent_id`+last[:40] · subagent record |
| `turn_end` | turn-arrow · "turn end" · last[:60] · turn record |
| `pre_compact` | fold-icon · "pre-compact" · compact reason · compact record |
| `session_end` | gate-close · "session end" · `end_reason` · seal+`batch_root` |

Color encodes STATUS only (intact / error / tampered / downstream) — XR §X2
colorblind rule. Icons: inline SVG in `timeline.js`.

## 4. Tamper state machine

`PRISTINE ─[Tamper]→ TAMPERED ─[Reset]→ PRISTINE`

- **Trigger**: single Tamper click. XR §X5's two-step gate is stage safety;
  auditor's desk does not need it.
- **Effect**:
  1. Pick the first `file_write` event (deterministic).
  2. Flip the last hex nibble of its `payload_hash`.
  3. Call `verifyBundle(workingBundle, { publicKey })` — real function from
     `packages/attest-core/session.js`, not a re-impl.
  4. Receive a `VerifierError` per `docs/spec/verifier-error-format.md`.
     Until Thu 2026-07-17 port lands, a shim adapts
     `{ok:false, reason, failedSeq}` → `{seq, reason, impact}`. Delete on port.
  5. Render caption `seq/reason/impact` matching `verify.html` layout. No
     hardcoded strings.
  6. Dim downstream to 35% + broken-link icon (XR §X2).
- **Reset**: deep-copy pristine bundle to working slot; no page reload.

Visual mirrors XR §X5: red edge flash 0.4s, downstream dim sequentially.
CSS `@keyframes`; no animation lib.

## 5. Consuming the verifier error format

`docs/spec/verifier-error-format.md` is source of truth. Every character in
the caption comes from the verifier's returned object. `tamper.js` MUST:

1. Render `error.seq` as-is; `—` when `null` (format doc rule).
2. Render `error.reason` as the exact `snake_case` code — no translation.
3. Render `error.impact` verbatim; wrap at 2 lines / 100 chars max (X5 rule).
4. No fallback caption in `tamper.js`. The §4 step-4 shim is the ONLY
   fallback; delete when port lands.

`test/replay-tamper-format.test.js` extracts the caption from the DOM after
a synthetic tamper and asserts field-for-field against `verifyBundle`'s
return object.

## 6. Presenter mode gate (deferred)

`index.html?presenter=1` will enable keyboard beat-mode (keys 1–9 jump between
pre-authored events, mirroring XR §X3 presenter beats). Deferred; day-1 does
not implement. URL scheme reserved.

## 7. What ships day 1

Drag bundle → render timeline → click row → payload card → Tamper → red
flash + verbatim caption + downstream dim → Reset → pristine. XR
chain-corridor (three.js, SBS, XREAL, gamepad) is v3.1; not started until
2D ships and 2026-08-02 launch is behind us.

## 8. Acceptance criteria

Runnable from `file://`:

**(a)** Alex's M2.1 dogfood bundle (2026-07-12/13, real Claude Code, 3+ file
edits) renders all events in < 1s on M-series; row count matches
`bundle.events.length`.

**(b)** Tamper on a bundle with ≥1 `file_write` yields caption `reason =
payload_hash_mismatch` (format doc's code) and `seq` = mutated event's index.
Both extracted from DOM and asserted against `verifyBundle`'s return object,
not hardcoded.

**(c)** Reset after tamper restores the in-memory bundle via deep copy from a
`pristineRef`; no `location.reload()`; second tamper→reset cycle behaves
identically.

## 9. Non-goals

Verbatim from Shadow's design discipline: **boring reliability over exciting
demos.**

- No 3D — three.js belongs to XR corridor (v3.1).
- No animation library (no GSAP/Framer/Motion One). CSS `@keyframes` only.
- No React/Vue/Svelte/Solid. Vanilla JS ES modules.
- No bundler, no npm install, no build step.
- No CDN imports, telemetry, analytics, or CDN fonts.
- No re-implementation of `verifyBundle`. Import the real one; consume its
  return shape.
