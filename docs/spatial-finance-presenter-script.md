# Spatial Finance — 10-minute presenter script

For Lora (quant/banking) + a stats professor. Audience is technical and will
push on method, so the demo leads with what's defensible and says out loud what's
a fixture. One line to keep in your head the whole time: **a verified record is
not the same as a correct analysis, and the demo is honest about which is which.**

Open `demos/spatial-finance/index.html`. Keyboard is authoritative; use voice
(hold Space) once or twice so they see it works, then drive with keys.

Optional: press `G` for a presenter rail on the left — this running order with
"you are here" and the next key, off by default so the audience view stays clean.
If you're mirroring to a projector, keep the rail on your laptop only.

---

## 0:00 — Portfolio view (the default, `0` / R to return here)

Say: "This is a balanced portfolio built from the ten names. The number in the
corner — VERIFIED — is a real cryptographic check running in the browser, not a
label. I'll come back to it."

Point at: the allocation is a flat bar, not a 3D pie. "Allocation is one number
per name; 3D wouldn't add anything, so it's 2D. I only use depth where depth is
the data."

Don't open the agent panels. Note that on purpose: "There's a council behind
this, but it's not the first thing you see — the decision is."

## 1:30 — How the weights were chosen (say this before Analytics)

Say: "The weights are risk-parity — each name contributes roughly equal risk —
with a capped fractional-Kelly tilt, and 1-over-N shown as the benchmark. I'm
not running naive mean-variance; with estimated moments that's an
error-maximizer — DeMiguel, Garlappi and Uppal 2009 showed 1/N beats it out of
sample. So the honest baseline is on the screen next to the model."

## 2:00 — Analytics: the 3D risk-return cloud (`1`)

Say: "This is the one view that earns 3D. X is risk, Y is five-year return,
depth is confidence, size is weight, colour is hold/trim/short." Drag to rotate.
"Finding the outlier — high weight, high risk, low confidence — is a
structure task, and that's where 3D actually helps read the data. Colours are
Okabe-Ito, colour-blind safe, and every point is also labelled."

If glasses are in the room: press `S` for stereo, "on XREAL this fuses to real
depth; `[` and `]` tune the eye separation." Otherwise skip.

## 3:00 — Forecast (`2`)

Say: "Forecasts are bands, not points. A single stock's five-year point return
is close to noise — Welch and Goyal 2008. So the band is the message, not the
dashed line down the middle." Let them look. "We don't claim to beat the market.
We claim the forecast is honest about its own uncertainty."

## 3:45 — Calibration (`6`) — the credibility view for this room

Say: "This is the claim I'd defend to a statistician. When we say seventy
percent, does it happen about seventy percent of the time? This reliability
diagram plots predicted probability against observed frequency; points are sized
by sample count and they hug the diagonal."

Point at the Brier number: "Brier score, decomposed the Murphy 1973 way —
reliability minus resolution plus uncertainty. Low reliability term means
well-calibrated. Calibration is a claim you can keep at any horizon, which a
five-year return forecast is not. That's what we compete on — calibration and
auditability, not accuracy."

Be honest if asked: sample size is still small; this is the method and the panel,
the long-run numbers accrue as the system runs.

## 5:00 — Agent review (`4`), briefly

Say: "Here's the council. Fundamentals bullish, risk cautious, compliance clear.
The dissent is concentration — the top three names are forty-one percent of the
book. The final call isn't a majority vote of five chatbots; it's a
deterministic aggregator with a human approving. The disagreement is visible on
purpose."

## 5:15 — Trace a claim to its source (click "41%" or the concentration risk)

Say: "One thing a reviewer always asks — where does a number come from. Click the
concentration figure." Click the top-3 `41%` (or the risk row). "It highlights
the three names it's computed from, shows the arithmetic — sixteen plus thirteen
plus twelve — and names the signed event that produced the weights. The
concentration isn't a separate claim; it's recomputed from the model's own
output. No number on this screen is unsourced." Press `R` or the ✕ to clear.

## 5:45 — Audit trail (`5`) — the hero

Say: "Now the part that's the actual product. Every step that produced this —
you asked, the model pulled data, produced weights, the council reviewed, a human
approved, it was signed — is here as a hash-chain. This isn't a drawing of the
events; it's rendered from the signed events themselves."

## 6:15 — Tamper (`T`)

Say: "Watch what happens if someone edits the model's output after it was
signed." Press `T`. "The weight on one name was changed from sixteen to
twenty-four percent after the signature. The verifier — the same code a bank
would run independently — flips to FAILED at the exact sequence number, the node
shows a hash mismatch, everything downstream goes grey. You can't quietly change
a number and keep the green check." Press `R` to reset.

## 7:00 — What-if (`W`) — the point about a *changing* analysis

Say: "A real review isn't static. Say the professor asks, what if rates rise a
percent." Press `W`. "The forecast updates — base case drops from plus
forty-one to plus twenty-eight. But here's the part I care about: the question,
the scenario tool, and the new forecast were appended to the same signed chain
and re-verified. Still green — because a recorded branch is legitimate, it's not
a tamper." Switch to audit (`5`): "There's the branch, in amber. The analysis
changed on command, and the change is itself auditable."

## 8:00 — Replay (`P`)

Say: "And the whole run replays." Press `P`. "Each step lands in the order it
happened, on its own timeline. Nothing appears after the fact. If a regulator or
a risk committee asks 'show me exactly how this decision was produced,' this is
that, and it's independently verifiable."

## 8:45 — Close (say plainly, no speech)

"To be clear about what's real: the signing, the chain, and the verification are
genuine — a tampered node produces the same failure our command-line verifier
produces. The portfolio numbers are a fixture; every view reads one data object,
so wiring it to Orallexa or a live feed doesn't change the demo, only the source.

What I'm showing isn't a better stock picker. It's a way to make an AI-produced
financial analysis auditable — you can see how it was made, see the
disagreement, see any tampering, and check it yourself. That's the thing banks
don't have yet for agent output."

## Q&A — likely pushback, honest answers

- **"Isn't the calibration just a few points?"** Yes — small sample so far. The
  method (reliability + Murphy decomposition) is the claim; the long-run numbers
  build up as it runs. I'd rather show the method honestly than a fitted curve.
- **"Why not mean-variance / Black-Litterman?"** MV over-fits estimation error
  (DGU 2009). Risk-parity + a capped Kelly tilt with 1/N on screen is the
  defensible default; BL is a reasonable extension once we have a real views
  model, but it doesn't change the governance story.
- **"The signing is self-signed — so what?"** Correct, it's a self-signed key in
  the demo. The property that matters is integrity: any post-hoc edit breaks
  verification. In production the key lives in an HSM/KMS and the public key is
  published, so a third party verifies without trusting us.
- **"Does 3D actually help?"** Only for the risk-return cloud (a structure/
  outlier task, Kraus et al.). Everything else is flat on purpose — no 3D pie.
- **"Verified means the analysis is right?"** No — and the demo says so. The
  badge has four rows: the record is verified, the source is self-declared, the
  analysis is a confidence estimate, the data is a fixture. Verified means
  nobody changed it, not that it's correct.

## If something breaks

Refresh (state re-seals on load). Everything is one offline file — no network, no
dependencies. `?shot=whatif,audit` or `?shot=replay` self-drives if you want it to
run itself on a second screen.
