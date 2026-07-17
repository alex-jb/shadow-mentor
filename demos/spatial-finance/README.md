# Shadow · Spatial Finance (10-minute governance demo, V1)

The composed demo from `Shadow_Spatial_Finance_ClaudeCode_Prompt_v2.pdf`: a
top-10 → balanced portfolio, driven by voice or keyboard, whose hero is the
**3D audit trace + tamper** proving where every weight came from and that
nothing was silently changed. Offline, single file, no dependencies.

## Run

Open `index.html` (double-click). Drive it by **voice** (hold Space, then say
"show the analytics / forecast / risks / agent review / audit trail / verify")
or **keyboard** (authoritative): `1` analytics · `2` forecast · `3` risks ·
`4` agents · `5` audit · `0` home · `T` tamper · `R` reset · drag to rotate the
cloud. Headless self-drive: `?shot=analytics` or `?shot=tamper`.

## The views (progressive disclosure — the default scene stays clean)

- **Portfolio View** (default) — the balanced allocation, top metrics, and the
  `VERIFIED ✓` badge. **No agent panels by default** (per the UX rule).
- **Analytics** — the **3D risk-return cloud**: X = risk, Y = 5-yr return,
  Z (depth) = confidence, size = weight, color = hold/trim/short. Floor grid +
  drop-lines + billboard labels; rotatable. This is the one view that genuinely
  earns 3D (a structure/outlier task).
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
- **Audit trail** — the 6-node actor-shaped chain
  (`User → Market data → Model → Council → Human → Signed`). `T` edits the
  model's weights *after* signing → the real verifier flips `VERIFIED ✓` to
  `✕ VERIFICATION FAILED · seq N`, the mutated node shows `HASH MISMATCH`, and
  downstream nodes dim. `R` reset re-seals.

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

Wire `analyze()`/the data source to Orallexa or a live market feed; add the fan
chart with real predictive intervals + a calibration/reliability panel; reflow
the audit trail into the polished `demos/replay/3d` Audit Room for the immersive
version; add TTS. Device: present on XREAL One Pro (flat/SBS); the native
Beam Pro + Eye scan pipeline is Phase 2.
