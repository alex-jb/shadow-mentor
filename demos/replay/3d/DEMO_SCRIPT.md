# The Audit Room — demo script & pre-flight

The demo is a single offline page. It never touches the network at runtime
and runs from `file://` by double-click. Rehearsal is the number keys `1`–`8`
and `0`; the script below is written against them.

## Pre-flight checklist (Phase 7.5)

Run through this once before any live demo:

- [ ] **Room lights on** — monocular SLAM (the Eye's 6DoF anchoring) degrades
      in dim rooms and empty spaces.
- [ ] **Glasses firmware current**; **Eye attached**.
- [ ] **XREAL One Pro in 3D mode**, mirrored to the Mac over USB-C DP-alt,
      dimming at max.
- [ ] **⚠️ HIGHEST-RISK CHECK — verify the SBS signal mode.** Our stereo is
      "squeeze" SBS (two half-width viewports the display stretches back to
      full width). If the glasses expect a frame-packed **3840×1080
      full-width-per-eye** signal instead, the image looks horizontally
      compressed and depth reads wrong. Load `?mode=sbs`, look through the
      glasses, confirm each eye is un-squished and fusion is clean **before**
      trusting the demo. If squished, switch the glasses' 3D signal mode (or
      pre-stretch) until it's right.
- [ ] **Also mirrored to the projector** for the audience.
- [ ] **OS display scaling 100%**; browser **fullscreen** on the glasses display.
- [ ] **Gamepad paired** (optional, for push-to-talk + WebXR).
- [ ] **Mic tested** (optional — the keyboard runs the whole demo without it).
- [ ] `node build.mjs` has been run since the last edit (regenerates
      `dist/audit-room.js` + `demo-data.js`).
- [ ] **Run beats `1 → 8 → 0` once** to warm the scene and confirm the tween.
- [ ] Open **`../verify.html`** in a second tab with the same bundle preloaded
      (for the export-parity beat).
- [ ] Tune `[` / `]` (eye separation) until fusion is comfortable at ~2 m; the
      value persists.

## The 8-beat script

Physically lean toward a card at beat 2 — the Eye holds the anchor, the chain
does not move. That body movement *is* the spatial proof.

| Beat | Key | On screen | What you say |
|------|-----|-----------|--------------|
| 1 | `1` | The whole signed chain, still and ordered | "This is one Claude Code session, sealed. Twelve events, one signature. Green badge: SELF_SIGNED, verified locally — nothing phones home." |
| 2 | `2` | Fly to the first file write; **lean in** | "Here's where the agent edited a file. Watch the chain — I move, it doesn't. The Eye pins it in the room." |
| 3 | `3` | The shell-command pair | "Tool call, tool result. Every action the agent took is on the chain, in order." |
| 4 | `4` | Security lens; risky events pulse | "A reviewer's lens — shell, writes, network. The rest fades. This is the audit query, spatially." |
| 5 | `5` | **Tamper.** Edit card goes red; the break cascades downstream with ⛓✗ | "Now someone rewrites history *after* signing. One byte in one payload. Watch it propagate — everything downstream is now unverifiable. The caption is the verifier talking, not a caption I wrote." |
| 6 | `6` | Pull back to the whole broken chain | "Upstream still trustworthy, bright. Downstream dead. The break is exactly at the seam the verifier names." |
| 7 | `7` | Close-up on the tampered card | "Seq 6, the edit. Detected at seq 7 — the next event's back-pointer no longer matches." |
| 8 | `8` | Trust badges | "SELF_SIGNED, honestly labelled. No badge this bundle didn't earn." |
| — | `E` then drag into `verify.html` | Same failure, same seq/reason in the 2D tool | "And it's not theatre — here's the exact bundle in the plain verifier. Same seq, same reason." |
| — | `0` | The chain heals in reverse | "Reset. Determinism, replayed." |

**The Jarvis moment** (any time the mic is on): hold `SPACE`, say *"show me
every shell command in this session."* Three cards light down the arc. It's a
real audit query answered by voice — that's why it belongs in the paper, not
just the demo.

## Contingency (Phase 7.6) — these live in the script, not the code

- **Glasses fail** → `F1` flat mode. Same keys, same math, projector still
  shows everything. Keep going.
- **Mic fails** → keyboard. Every voice line above has a key (see
  `CONTROLS.md`). Say nothing about the mic; just press the key.
- **Anything throws** in `?presenter=1` → the watchdog logs it to
  `localStorage` and soft-reloads into the last beat within ~2 s. Wait, keep
  talking, resume.

## Build

```
node demos/replay/3d/build.mjs   # regenerates dist/audit-room.js + demo-data.js
```

Then open `demos/replay/3d/index.html` (double-click, or drag into Chrome).
No server. No network. Add `?xreal=1` for the glasses preset,
`?presenter=1` for the presenter HUD + watchdog.
