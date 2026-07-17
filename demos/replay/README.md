# `demos/replay/` — Shadow evidence replay (M5, 2D timeline)

Open-and-play offline demo. Drop a signed Shadow evidence bundle, see
the full event timeline, click any event for its record, click **Tamper
& verify** to watch the audit chain break and the verifier's structured
error surface exactly which event was mutated.

Design source: [`docs/spec/m5-replay-2d-design.md`](../../docs/spec/m5-replay-2d-design.md).
The XR chain-corridor version is v3.1 and lives at
[`docs/roadmap/SHADOW_XR_DEMO_BRIEF.md`](../../docs/roadmap/SHADOW_XR_DEMO_BRIEF.md).

## Try it in 30 seconds

```bash
open demos/replay/index.html
```

Then:

1. Drop `demos/replay/data/demo-session.bundle.json` (a real signed
   bundle from the M2.1 dogfood, 2026-07-13) into the drop zone. Or
   click "choose a file".
2. Paste the matching public key from
   `demos/replay/data/demo-public-key.pem` into the "Public key"
   textarea. (Without it the timeline still renders, but the verify
   status shows `pending` and Tamper is disabled.)
3. Click any event on the left to see its record on the right.
4. Click **Tamper & verify**. Watch the row flash red, downstream dim,
   the caption print the verifier's structured error, and the header
   flip to `verify failed`.
5. Click **Reset**. Back to pristine, no page reload.

## Discipline (unchanged from the design)

- Zero build step. Opens from `file://`.
- Zero npm install for this folder.
- Zero CDN imports.
- Zero telemetry.
- No 3D, no animation library, no frontend framework.
- No re-implementation of `verifyBundle` behavior. The browser
  verifier (`verify-browser.js`) is a WebCrypto mirror of
  `packages/attest-core/session.js` `verifyBundle`. The parity is
  guaranteed by `test/replay-verify-browser-parity.test.js`.

## File layout

| File | What it does |
|---|---|
| `index.html` | Drop zone, verdict badge, timeline, inspector, tamper caption. |
| `main.js` | Wires the DOM to the modules; owns UI state. |
| `timeline.js` | Renders the event list; selection + tamper visual state. |
| `inspector.js` | Payload record card for the selected event. |
| `tamper.js` | `PRISTINE ↔ TAMPERED` state machine; picks the target event, mutates payload_hash, calls the verifier, adapts the error to `{seq, reason, impact}`. |
| `verify-browser.js` | Browser-side `verifyBundle` (WebCrypto). Parity-tested against Node. |
| `styles.css` | Vanilla CSS. System fonts. No CDN. |
| `data/demo-session.bundle.json` | Real signed bundle from the M2.1 dogfood, 2026-07-13. |
| `data/demo-public-key.pem` | Ed25519 SPKI PEM that verifies the bundle above. |

## What day-1 does NOT ship

Per design §9:

- No 3D chain-corridor (that's v3.1, XR).
- No presenter mode in this replay demo. The sibling `demos/spatial-finance`
  demo ships a presenter rail (`?present=1` — running order + "you are here",
  hidden from the projected view); if this demo adds one, use that same flag name.

Landed since day 1 (no longer "not shipped"):

- Verifier error format — `packages/attest-core/session.js` `verifyBundle` now
  returns the native structured `{ok:false, error:{seq, reason, impact}}` (spec:
  `docs/spec/verifier-error-format.md`, implemented 2026-07-13). `tamper.js` reads
  `verify.error` directly; the earlier `adaptVerifierError` shim was deleted.
