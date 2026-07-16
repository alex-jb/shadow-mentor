# Shadow · Scan → Analyze (cited overlay)

The front end for the "look at a real-world artifact → get the analysis, with
every claim linked back to its source" idea. This is the **medium-agnostic
engine, side-panel first** that the 2026 AR device analysis recommended: build
the capture → extract → cited-overlay engine now (as a screen panel, no new
hardware), and reflow it onto a headset only when paper / hands-free / many-doc
conditions justify glass.

## Run

Open `index.html` (double-click, or `?auto=1` to self-drive for a screenshot).
Offline, no build. Toggle **financial statement** ↔ **data chart** to see the
same engine swap the analysis persona (bank / data-science — the multi-vertical
surface). Press **Analyze**, then hover/click a `source ↩` pill: it highlights
the exact cell/point the claim came from.

## Why the cited overlay is the point

The defensible, differentiated piece isn't the glasses — it's that **every
verdict claim links back to the exact source region and highlights it.** That's
the highest-trust UX for finance and it's the same traceability idea Shadow's
audit chain is built on. Reading comfort, not spectacle, is why the side panel
beats a headset for on-screen documents.

## The one seam to wire a real model

`analyze(kind)` returns `{ verdict:{text,tone}, claims:[{text, cell}] }`. Today
it returns a worked mock so the UX runs offline. To go live: POST the captured
frame (screenshot / file / camera still) to a vision-LLM endpoint that returns
the same shape, where each citation `cell` is an id present on the rendered
artifact. Nothing else in the UI changes.

## Device roadmap (per `../../docs/` + the AR device analysis)

- **Now:** this side panel — screen capture / file drop, any monitor.
- **Hands-free / paper demo:** Meta Quest 3S ($299) — the only affordable
  headset giving an app raw camera frames + spatial anchoring; reflow this panel
  into an ornament anchored beside the artifact.
- **Don't:** point a camera at a screen (lossy), or buy Vision Pro
  (enterprise-locked) / Galaxy XR ($1,799) for this pipeline yet. XREAL One Pro
  stays a display.

See `~/Desktop/Interview-Prep/Correspondence/ECC-2026/ar-device-analysis-scan-and-analyze-2026-07-16.pdf`
for the full device comparison and interaction design.
