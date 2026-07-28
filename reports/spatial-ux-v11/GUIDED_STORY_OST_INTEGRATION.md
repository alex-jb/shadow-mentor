# Guided-story surface now consumes XREAL_OST_BRIGHT

The #1 open P0 from the OST review + the deep audit: the guided-story player rendered **white labels on a
transparent backdrop** using its own hardcoded palette, so on a bright optical-see-through background the
status text vanished (proven FAIL in `ost-simulations/bright-office-simulation-BEFORE.png`).

## What changed (tested)
`ShadowGuidedStoryPlayer.AddLabel` now checks the active visual profile. When `XREAL_OST_BRIGHT` is active
(`ShadowDesignTokens.ActiveProfile`), each status label renders **dark text on a bright near-opaque
backplate** (a shared `Unlit/Color` quad, `PanelPrimary` colour) instead of white-on-transparent. Desktop /
dark / projector profiles are unchanged (white text, no plate). The capture harness sets the profile to
`XrealOstBright`, so the review captures now exercise the OST path.

- EditMode: **120/120** (0 compile errors) — `ShadowGuidedStoryOstTests` pins the decision
  (`BrightBackplateActive()` true only for `XrealOstBright`) and the token contrast (dark text on a bright
  plate clears a high-contrast bar). Back-compat: DesktopDark unaffected.
- Node suite unchanged; frozen verify.html + stable APK untouched.

## Honest limitation of the simulation (important)
The additive OST simulation (`scripts/ost-simulate.py`, `out = bg + emit`) **cannot faithfully render
dark-text-on-an-opaque-bright-plate**. Two reasons, both inherent to a per-pixel additive model without an
opacity map:
1. A bright plate + a bright office background additively clip to white.
2. A dark-text pixel is *dark*, so any brightness-gated occlusion heuristic would treat it as transparent
   and let the bright background show through — re-brightening the text.

So `bright-office-simulation.png` now shows the dark labels **faintly present** (an improvement over the
BEFORE image where everything was uniform white and no state was distinguishable), but it **under-represents**
the real benefit of an opaque bright plate, which physically *occludes* the background.

The faithful evidence for this design direction is **`ost-simulations/panel-alpha-comparison.png`** — it
composites the OST bright *panel* (dark text on an opaque bright plate + bold border) over the same bright
office and it reads cleanly at 0.75 / 0.85 / 0.94. That is what the guided-story labels now use.

## Verdict
- **Code: DONE + tested** — the guided-story surface consumes `XREAL_OST_BRIGHT`.
- **bright-office OST readability: FAIL → improved** (dark labels present vs vanished); the additive sim can't
  fully show the opaque-plate benefit; the realistic panel composite validates the direction.
- **DEVICE-VALIDATION-PENDING** — the real arbiter is the Beam Pro. No device readability is claimed.

## Follow-ups (not this increment)
- Plate sizing is an estimate from text length; tune once measured on device.
- Node primitive *colours* still wash additively on bright backgrounds (shape survives) — consider a
  bright-outline treatment for the primitives too, or an occlusion-aware sim variant, next.
