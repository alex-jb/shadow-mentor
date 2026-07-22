# OST simulation review (V11)

Real Unity captures (`media/spatial-ux-v11/unity/`) composited over simulated backgrounds
(`media/spatial-ux-v11/ost-simulations/`) using an **additive** see-through model. **Design-review
approximation only — NOT physically accurate, NOT device evidence.** Every simulation is stamped
`SIMULATED OST BACKGROUND / NOT DEVICE VALIDATED`. The device is the real arbiter.

## What was captured
The 6 required shots are the **real guided-story player + capability banner** (world-space `TextMesh` +
primitives), driven in play mode through public API. Findings from the raw captures:
- **Shape + colour + text status encoding all render and work.** First failure = bright **red cube**
  ("Council claims · FIRST FAILURE", double-labelled); downstream = **dimmed cubes** ("· AFFECTED
  DOWNSTREAM"); verified = **green spheres** ("· VERIFIED"). First-failure and downstream are clearly
  distinguishable (`02`, `03`).
- **Tracking states render via the real presentation path.** `04` = amber **TRACKING LIMITED** (the honest
  label for the SDK `Scanning` reason — there is no separate "SCANNING" label), `05` = red **TRACKING LOST**
  with the banking story **preserved** behind it.
- **CJK renders correctly** — the ZH banner reads `设备验证待完成`, no tofu, no clipping (`06`). Node entity
  labels stay English where the fixture provides no `zh` string (a fixture-content gap, not a render bug).

## OST readability verdict (guided-story surface)
| Background | Verdict | Evidence |
|---|---|---|
| **dark-room** | **PASS** | green/red/dimmed all distinct; "FIRST FAILURE" legible; the design's implicit assumption (dark backdrop) holds |
| **patterned** | **ADJUST** | shapes + saturated colours survive over mid-grey, but white labels lose contrast against the busy texture |
| **bright-office** | **FAIL** | additive display washes green **and** red **and** dimmed all to **white** — colour status distinction is destroyed; white labels vanish; nodes over the bright window disappear |

**Root cause / key finding:** the guided-story player renders **bright emissive colours + white labels on a
transparent/black backdrop**, and it uses its **own hardcoded palette** — it does **not** consume the
`XREAL_OST_BRIGHT` token profile. On an additive OST display over a bright real-world background this fails:
bright-on-transparent is exactly the wrong polarity. Shape silhouettes partially survive; colour + text do
not.

## The OST *panel* design is correct (contrast finding)
`panel-alpha-comparison.png` composites the **OST bright panel** (dark text on a bright near-white panel +
bold dark border — the `XREAL_OST_BRIGHT` tokens) over the same bright office. It reads **excellently at
0.75 / 0.85 / 0.94**: VERIFIED (dark green), FIRST FAILURE (dark red), AFFECTED DOWNSTREAM (near-black) are
all clearly legible, even over the bright window. This validates the OST token direction — **dark-on-bright
panels, not bright-on-transparent primitives.**

## PanelAlpha decision
**SIMULATION-SELECTED: 0.85** (was 0.94). Dark-on-bright text stays fully legible across 0.75–0.94, so 0.85
keeps legibility while occluding slightly less of the real world. The static additive sim cannot strongly
distinguish 0.85 from 0.94 — this is a soft default. **DEVICE-VALIDATION-PENDING.** Applied in
`ShadowDesignTokens.Resolve(XrealOstBright)`; test threshold relaxed to ≥0.8.

Note: the guided-story captures contain **no translucent panels**, so PanelAlpha was evaluated on the
panel-bearing OST surface (the comparison render), not the guided-story shots.

## Recommended next steps (ranked by the images)
1. **P0 — make the guided-story surface OST-aware.** It's the surface users actually read and it FAILS on
   bright backgrounds. Options: give focused/failed nodes a bright backing plate with dark text (like the
   panel design), or add a label halo/backing so white text survives on bright backgrounds. This is the
   highest-value visual fix the captures justify.
2. **P1 — node labels are small.** Legible at the tuned capture framing but marginal; consider a larger
   label scale / billboard.
3. **P1 — fixture ZH coverage.** Add `zh` entity labels to the audit-chain fixture so ZH shots localize node
   text, not just the banner.
4. Downstream dimmed nodes are very dark → near-invisible on OST; give them a distinct non-dark treatment.

These are **design findings for review**, not yet implemented — per the plan, the images come first and the
optimisation/wiring decisions follow from them.
