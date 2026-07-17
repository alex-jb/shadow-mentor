# Shadow · Spatial Finance (10-minute governance demo, V1)

The composed demo from `Shadow_Spatial_Finance_ClaudeCode_Prompt_v2.pdf`: a
top-10 → balanced portfolio, driven by voice or keyboard, whose hero is the
**3D audit trace + tamper** proving where every weight came from and that
nothing was silently changed. Offline, single file, no dependencies.

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
  cloud renders as two eye viewports with horizontal disparity, so on XREAL One
  Pro in 3D mode it fuses to real depth; `[` / `]` tune eye separation on the
  glasses (persisted). `?stereo=1` starts in stereo.
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
  produced-by / confidence.
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

## What's real vs mock

- **Real:** the Ed25519 signing + SHA-256 hash-chain + verification runs
  in-browser via WebCrypto and is round-trip compatible with
  `demos/replay/verify-browser.js` / `bin/shadow-verify.mjs` (a tampered node
  produces the identical `prev_hash_mismatch`). The tamper detection is genuine.
- **Mock:** the portfolio numbers, forecasts, and agent stances are a fixture
  (the unified data contract, inlined as `PORTFOLIO` for offline use). Swap it
  for an Orallexa/live feed behind the same shape — every view reads that one
  object.

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

Wire `analyze()`/the data source to Orallexa or a live market feed (OpenBB behind
the provider boundary); **source-map** so a claim (e.g. "top 3 = 41% of book")
clicks back to the exact positions/arithmetic that produced it; ingest OTel spans
via `packages/adapter-otel` so a *real* agent run (not the fixture) becomes the
replayed, signed chain; reflow the audit trail into the polished
`demos/replay/3d` Audit Room for the immersive version. Device: present on
XREAL One Pro (flat/SBS); the native Beam Pro + Eye scan pipeline is Phase 2.
