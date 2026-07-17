# Shadow · Spatial Finance (10-minute governance demo, V1)

The composed demo from `Shadow_Spatial_Finance_ClaudeCode_Prompt_v2.pdf`: a
top-10 → balanced portfolio, driven by voice or keyboard, whose hero is the
**3D audit trace + tamper** proving where every weight came from and that
nothing was silently changed. Single file, no dependencies — everything runs
offline **except the optional voice control**. To be precise about the two halves:
**voice output** (spoken narration) uses the browser/device speech synthesis —
whether a voice is available offline depends on the voices installed on the
machine; **voice input** (the "hold Space and speak" commands) uses the browser's
speech-recognition service, which in Chrome relays audio to a server and so is not
offline, and Shadow retains no audio. Keyboard driving is authoritative and fully
offline; at an airplane-mode venue, present with the keyboard and skip the voice
beat.

## Run

Open `index.html` (double-click). Drive it by **voice** (hold Space, then say
"show the analytics / forecast / risks / agent review / audit trail / calibration
/ what if rates rise / replay / verify") or **keyboard** (authoritative):
`1` analytics · `2` forecast · `3` risks · `4` agents · `5` audit ·
`6` calibration · `W` what-if · `P` replay · `T` tamper · `R` reset · `0` home ·
`S` SBS stereo · `[` `]` eye-sep · `M` mute · drag to rotate the cloud. Headless
self-drive: `?shot=analytics`, `?shot=tamper`, `?shot=whatif`, `?shot=replay`,
or a chain `?shot=whatif,audit`.

## The views (progressive disclosure — the default scene stays clean)

- **Portfolio View** (default) — the balanced allocation, top metrics, and the
  `VERIFIED ✓` badge. **No agent panels by default** (per the UX rule).
- **Analytics** — the **3D risk-return cloud**: X = risk, Y = 5-yr return,
  Z (depth) = confidence, size = weight, color = hold/trim/short. Floor grid +
  drop-lines + billboard labels; rotatable. This is the one view that genuinely
  earns 3D (a structure/outlier task). Press **S** for **SBS stereo** — the
  cloud renders as two eye viewports with horizontal disparity, *intended* to
  fuse to real depth on XREAL One Pro in 3D mode; `[` / `]` tune eye separation on
  the glasses (persisted). `?stereo=1` starts in stereo. **Not yet confirmed
  on-device** — verify the fusion on the actual One Pro before relying on the
  stereo beat; the flat (mirrored) path is confirmed to work.
- **Forecast** — bull/base/bear **scenario band per name**, never a point
  estimate.
- **Calibration** (key `6` / "show calibration") — a **reliability diagram**
  (predicted probability vs. observed frequency, points sized by count, hugging
  the diagonal) + **Brier score with the Murphy 1973 decomposition**
  (reliability − resolution + uncertainty). This makes the "we compete on
  calibration, not accuracy" claim concrete: when we say 70%, it happens ~70% of
  the time — a claim keepable at any horizon, which a 5-year return forecast is
  not. This is the credibility view for a stats/quant audience.
- **Risks / Agent Review** — expand only on command; each item shows source /
  produced-by / confidence. **Click a risk** (or the top-3 `41%` metric, or say
  "trace") → **source-map**: the cloud highlights the backing names, a popover
  shows the arithmetic *recomputed live from the signed weights*
  (`NVDA 16% + MSFT 13% + AAPL 12% = 41%`) and names the producing event
  (`model_output · seq 2`). No number on screen is unsourced; the concentration
  claim is a fact about the model's own output, not a separate assertion.
- **Audit trail** — the actor-shaped chain
  (`You → Data → Model → Council → Human → Signed`), rendered **from the actual
  signed events** (no hardcoded node count — it grows when a branch is recorded).
  `T` edits the model's weights *after* signing → the real verifier flips
  `VERIFIED ✓` to `✕ VERIFICATION FAILED · seq N`, the mutated node shows
  `HASH MISMATCH`, and downstream nodes dim. `R` reset re-seals.
- **What-if** (key `W` / "what if rates rise 1%") — runs a counterfactual: the
  forecast fan gains an amber rates+1% scenario (base +28% vs +41%, Okabe-Ito
  safe) **and** the question + scenario tool + new forecast are appended to the
  chain, re-sealed, and re-verified — still `VERIFIED ✓`, because a recorded
  branch is legitimate, not a tamper. The audit trace grows three amber branch
  nodes. The point: the analysis changed on command, and the change is *itself*
  auditable.
- **Replay** (key `P` / "replay") — plays the recorded run forward over a
  synthetic 18-second timeline: each event lands in order, a playhead sweeps the
  chain, future nodes stay dimmed, a clock counts `00:00 → 00:18`. Reinforces
  "nothing added after the fact — watch it unfold in the order it happened."

## Presenter rail (`G` / `?present=1`)

Press `G` for a left-hand **presenter rail**: the running order as a teleprompter
with "you are here" highlighted, the next key to press, and a small state line
(verify status · event count). It's **off by default and never part of the clean
scene** — the idea is the wearer/presenter sees the cues on their screen while
the projected or cast view stays uncluttered. `?present=1` starts with it on.

## What's real vs mock

- **Real:** the Ed25519 signing + SHA-256 hash-chain + verification runs
  in-browser via WebCrypto and is round-trip compatible with
  `demos/replay/verify-browser.js` / `bin/shadow-verify.mjs` (a tampered node
  produces the identical `prev_hash_mismatch`). The tamper detection is genuine.
- **Mock:** the portfolio numbers, forecasts, and agent stances are a fixture
  (the unified data contract, inlined as `PORTFOLIO` for offline use). The
  provider boundary is real code in [`providers/`](./providers/): a
  `getProvider()` factory over `MockMarketDataProvider` (this fixture) and a
  documented `OpenBBMarketDataProvider` stub, all returning the one
  `PORTFOLIO_CONTRACT` shape every view reads. A drift test keeps the inline copy
  in sync with `providers/portfolio-fixture.mjs`. Wiring a live feed (Orallexa or
  OpenBB, AGPL-isolated) means implementing one method — the views don't change.

## Credibility disciplines baked in (audience = quant + stats academics)

- **Portfolio method:** risk-parity base + a *capped fractional-Kelly* tilt,
  with **1/N shown as the benchmark** and per-name **risk contribution** — not
  naive mean-variance (an error-maximizer; DeMiguel-Garlappi-Uppal 2009).
- **Forecasts:** scenario bands, never point estimates (single-stock 5-yr point
  returns are ~noise, Welch-Goyal 2008). The one-liner states we compete on
  auditability + calibration, **not** on beating the market.
- **3D only where it earns it:** the risk-return cloud is 3D; the allocation is
  a flat 2D bar (no 3D pie); colors are Okabe-Ito with redundant labels.

## Flow (a.flow.gl) — how it helps, and the bridge

Flow is the polished **3D display layer** for XREAL One Pro (colorful, rotatable,
filterable spatial data, CSV import, a real-time Push Dataset API, and MCP so an
AI can author a 3D narrative). It is genuinely good at exactly what Lora asked
for — "3D, colorful, appealing" data on the glasses — so it can save us building
a full Three.js/XR frontend from scratch.

What Flow is **not**: the analysis, OCR, or trust layer. Shadow stays the
analysis + audit + signing engine; Flow only displays. Never move signing or
verification into Flow.

`flow-adapter.mjs` is the bridge: `node flow-adapter.mjs` turns the portfolio +
the evidence chain into two Flow-importable CSVs — `flow-portfolio.csv` (the
risk-return cloud) and `flow-audit.csv` (the audit graph, real SHA-256 chaining
+ `produced_by` + `verification_status`). Drop them into Flow Editor today; the
same rows push via Flow's Push Dataset API once its contract (auth, format,
latency, embed, privacy) is confirmed with the Flow team.

## Next

Implement `OpenBBMarketDataProvider.getPortfolio()` in [`providers/`](./providers/)
against an AGPL-isolated OpenBB service (the boundary + stub already exist);
**source-map** so a claim (e.g. "top 3 = 41% of book")
clicks back to the exact positions/arithmetic that produced it; ingest OTel spans
via `packages/adapter-otel` so a *real* agent run (not the fixture) becomes the
replayed, signed chain; reflow the audit trail into the polished
`demos/replay/3d` Audit Room for the immersive version.

**Device / scan capability (accurate as of XREAL SDK 3.1):** present this demo on
XREAL One Pro (flat/SBS). This browser/SBS demo *cannot* access the XREAL Eye
camera. A native Unity/Android app using XREAL SDK 3.1 **can** capture real-time
RGB frames (YUV_420_888) and do scan-and-analyze, and One + Eye supports 6DoF — so
the analysis can be shown in a stable floating panel. But One Pro + Eye does **not**
provide plane tracking, image tracking, depth mesh, or persistent spatial anchors
(per XREAL's compatibility table), so the result cannot be precisely "pinned" to a
specific cell on the physical document. The native scan-and-analyze pipeline is
Phase 2 (not built here).
