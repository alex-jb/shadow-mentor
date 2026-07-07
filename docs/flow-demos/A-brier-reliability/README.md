# Demo A · Brier Reliability Surface (Flow Immersive + XREAL One Pro)

**Audience:** Columbia University Statistics faculty (Lora's introduction). Also good for any quant-audit or applied-Bayesian conversation.

**Duration:** 90-second walkthrough. Two additional minutes for Q&A per stakeholder.

**What it renders:** a 3D reliability surface per Shadow persona over 12 weeks. Perfectly-calibrated persona = surface flat on the y = x diagonal. Overconfidence = surface bows above the diagonal. Miscalibration drift = surface tilts along the time axis.

---

## Quick-start — upload to Flow (5 minutes)

1. Go to `https://a.flow.gl/user/feed` (already logged in per 2026-07-06 registration).
2. Click **Create new** → **Load CSV**.
3. Upload `shadow-brier-reliability.csv` (601 rows).
4. In the axis mapper:
   - **X axis:** `x_predicted_probability`
   - **Y axis:** `y_empirical_frequency`
   - **Z axis:** `z_week_offset`
   - **Color by:** `persona`
   - **Size by:** `bin_count`
5. Chart type: **3D scatter** (or **surface** if Flow renders one from scattered data — Flow's Population Futures example shows this pattern works).
6. Save the scene. Share URL becomes the Columbia stats faculty walkthrough link.

---

## Regenerate the CSV (deterministic)

```bash
python3 generate.py > shadow-brier-reliability.csv
```

Regenerating produces byte-identical output (seed pinned to `20260706`). If you want new "live" numbers as Shadow's real calibration curves grow, replace the `PROFILE` dict in `generate.py` with a `curl -s https://shadow-mentor.vercel.app/api/calibration | jq '...'` pipeline. The synthetic profile is meant for the first demo iteration when live sample sizes are still small (n < 100 per persona).

---

## The 90-second narration

> [pause 5s to let the reviewer look at the scene]
>
> "What you are looking at is 12 weeks of calibration data for Shadow's 5 personas. Each persona is a different color. The X axis is predicted probability. Y is empirical frequency. Z is time — this week at the front, 11 weeks ago at the back.
>
> If a persona were perfectly calibrated, its surface would lie exactly on the Y equals X plane. That plane is the yellow line drawn through the origin.
>
> Walk around and look at Fair Lending Compliance — the [color] surface. See how it's under the diagonal? That persona is *under-confident* on high-probability decisions. It says 80 percent when reality is 88 percent. And look at how the surface tilts along the Z axis: the miscalibration is getting worse week over week.
>
> Now look at Customer Advocate — it's flat on the diagonal for all 12 weeks. That persona is well-calibrated.
>
> This is the audit surface that lets a regulator see, at a glance, which of the five voices is under-emitting confidence and which is over-emitting, over time. Every persona in Shadow gets its own reliability curve, refit monthly per Guo et al. 2017. The Brier score decomposes into reliability, resolution, and uncertainty — that decomposition is what you see rendered in this scene."

Total: 88 seconds spoken.

---

## What the reviewer walks around to see

- **Front layer** (week 0): most-recent calibration. Easiest to sanity-check against a live loan.
- **Back layer** (week -11): 3 months ago. Trajectory anchor. Comparing front to back is the calibration-drift narrative.
- **Under the surface**: where a persona under-emits. Fair Lending Compliance is systematically under the diagonal.
- **Above the surface**: where a persona over-emits. Risk Officer is over the diagonal at high probability.

Each of these is a specific claim about a specific persona at a specific probability bin. Ask the reviewer what they would want to see next; the natural follow-up is "show me Case Study 1 rendered on top of this reliability surface" — Case Study 1 is at `docs/case-studies/01-cre-loan-with-pep-and-diverse-routing.md`.

---

## XREAL One Pro rendering tips

- **Standalone mode (X1 chip 3DoF)** — full scene at 45+ FPS with 600 points + 5 personas. Well within the X1 chip's 800k-point budget.
- **Field of view (57°)** — the 12-week Z axis is deep enough that the reviewer will want to walk a step forward to see the back layer clearly. Coach: "take a step forward to look at 3 months ago."
- **171" virtual display** — data density is higher than a laptop. The reviewer can read the axis labels comfortably at 1.2m viewing distance.
- **X1 chip head-tracking latency** — negligible for a static scene. If Flow adds motion (Flow's Ocean Heat example uses one), test on-device before the demo.

---

## Fallback: 2D static rendering

If X1 chip drops FPS below 30 on-device, the Flow scene degrades to a flat plane. The narration works either way — just say "in the flat rendering, the Y axis line is the perfect-calibration reference" instead of "walk around to look under the surface."

---

## Next demos in the pipeline

- **Demo B — 4-Verdict Lattice Scatter** (executive audience). Every loan Shadow has seen plotted at (FICO, DTI, LTV) colored by verdict.
- **Demo C — Hash-Chain Audit Walkthrough** (bank counsel audience). Live decisions as a walk-through 3D chain, tamper detection demonstrated live.
- **Demo D — Regulatory Citation Graph** (procurement audience). CITATION_MAP rendered as a 3D graph.

Each will land in `docs/flow-demos/{B,C,D}-*/` following this Demo A pattern (CSV generator + README + narration script).

---

## Contact

- Alex Xiaoyu Ji · xji1@mail.yu.edu — data pipeline, Flow scene mapping, XREAL One Pro on-device testing
- Loredana C. Levitchi · [email verify] — Columbia stats faculty introduction, banking-domain scene review
- Jason Marsh · jason@flow.gl — Flow Immersive scene template support

*This demo is a public artifact of the `shadow-mentor` repository (MIT). Feel free to fork, iterate, and share.*
