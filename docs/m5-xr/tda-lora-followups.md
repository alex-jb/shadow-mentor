# Follow-ups from Lora's TDA / strict-local-martingale package (2026-07-16)

Lora shared a bubble-detection package (TDA persistence + strict-local-
martingale α, on Snowflake Cortex). It doesn't change the current M5 XR work,
but two things are worth keeping. A third — porting the quant methods into
Orallexa — is already done (see the note at the bottom).

## 1. A possible second XR paper with Lora (do NOT bolt onto the current one)

The TDA side is inherently geometric. A bubble shows up as "structured loops in
delay space": you embed the return series Φ_t = (r_t, r_{t+2}) into a point
cloud, and bubble candidates produce longer-lived H1 loops that a benchmark
series doesn't. That is a spatial object a person could inspect in 3D/XR — the
point cloud plus its persistence diagram, per window, over time.

So there's a candidate for a *separate* Lora collaboration: an XR tool to
inspect a market's topological regime, the same way the Audit Room inspects an
audit chain. Keep it separate:

- The current Audit Room study is already scoped (2D / anchored-stereo /
  immersive, find-the-tamper). Don't widen it — a reviewer rewards the tight
  confound isolation.
- Same day-30 discipline applies (the AR graveyard lesson): it only earns 3D if
  it's genuinely faster than a 2D persistence plot for spotting the regime.
  Most financial-viz-in-3D dies that test. Prove the utility before committing.

Raise it with Lora only if/when the first paper lands. It is greenfield, not a
sure thing.

## 2. Shadow positioning line (a pitch line, not code)

The Snowflake brief's architecture ends in a "Cortex Agent Layer" that
generates narratives and risk alerts. That is exactly the kind of agentic
output Shadow governs. The existing framing is "Anthropic ships agents, Shadow
governs them"; this adds a parallel: **"Snowflake Cortex ships agents, Shadow
governs them."** If Lora's banking work standardizes on Snowflake, Shadow's
signed evidence bundle can sit on top of a Cortex agent pipeline as the audit
layer. No code dependency — a slide, for the competitor/positioning section.

Do not adopt Snowflake infra ourselves. The quant math is 20–150 lines of local
Python; a warehouse isn't needed and the cost/ops don't fit the lean cron model.

## 3. Done — quant methods ported to Orallexa (public methods only)

The two regime primitives are ported to Orallexa as an experimental signal:
`engine/bubble_signal.py` (branch `feat/bubble-signal`). Strict-local-martingale
α (scipy) + TDA persistence norm (ripser, optional). It's a primitive only —
not wired to decisions, defensive opt-in multiplier, honest hindsight caveat,
must clear paper-P&L + Brier + OOS first. Uses the public methods (Gidea & Katz
2018; Akingbade 2024); Lora's specific workbook/data is not used.
