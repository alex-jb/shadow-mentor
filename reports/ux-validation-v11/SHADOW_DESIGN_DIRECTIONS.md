# Shadow Lens V11 — three bounded design directions

No project file was modified to produce this. Each direction is scoped against the 15 findings in the
issue matrix.

Shared constraint for all three: the Audit Workspace has **no Canvas, no TextMeshPro, no EventSystem**
— it is world-space `TextMesh` + `Quad`. Any direction that assumes Unity UI would be a rewrite, not a
refinement, and is therefore out of scope for all three.

---

## A. Conservative refinement

**Principle:** the accepted composition is right; its *metrics* are wrong. Fix the numbers, change no
concepts.

> **Partly delivered.** UX-02 and UX-03 landed on `fix/shadow-v11-layout-capacity`; UX-04 landed on
> `fix/shadow-v11-tracking-banner`. Still open in this direction: UX-08 (unused space as a goal),
> UX-14 (evidence-guide internals), UX-10.

- **Scenes:** Audit Workspace only.
- **Components:** `ShadowAuditWorkspace.cs` (region positions, row steps, one banner call site),
  `ShadowLabelMetrics` truncation budgets, the hardcoded `#961418` disclaimer colour.
- **Visual changes:** derive row step from the rendered line box per type size (UX-03); widen the
  column gaps or tighten per-column truncation so measured width ≤ gap (UX-02); truncate or
  right-anchor the degraded-tracking banner (UX-04); pull the rail up into the empty 29 % band and
  separate the rail label from the index (UX-14 done; UX-08 open); route the disclaimer colour through the
  active profile (UX-05).
- **Interaction changes:** none.
- **Localization:** every gap must be re-measured in zh-CN, where CJK is ~2× the Latin em width. The
  `role` value leak (UX-10) is a one-line fix that belongs here.
- **Accessibility:** partial — fixes UX-05, does **not** fix UX-01/UX-09 (those need token work).
- **Performance:** neutral. Same object count.
- **Regression risk:** **low.** Pure layout constants inside one component; `ShadowAuditWorkspaceLifecycleTests`
  already pins region count, material count and orphan count.
- **Beam Pro:** not required to implement; required before claiming readability.
- **Must remain unchanged:** the five-region model, the `TextMesh`/`Quad` primitive strategy, the
  bilingual label source, the `SIMULATED` disclaimer text itself.
- **Deliberately excluded:** the status-colour profile gap, the interaction model, any change to the
  Flat surface.

---

## B. Spatial audit focus

**Principle:** the first failure and its evidence lineage are the subject; everything else is context.

> **Core delivered.** UX-07 (first failure as the primary conclusion) landed on
> `fix/shadow-v11-first-failure-hierarchy`. The fuller depth/foreground rework in this direction
> remains future work.
Reduce the flat three-column dashboard to a foreground/background relationship.

- **Scenes:** Audit Workspace primarily; the Flat surface becomes the consistency reference.
- **Components:** `ShadowAuditWorkspace.cs` region layout and type scale; `ShadowAuditWorkspaceModel`
  may need a "primary vs context" flag on the VM; `ShadowStatusGlyph` for emphasis states.
- **Visual changes:** give the first-failure entity the largest type in the frame and push the story
  title down the hierarchy (UX-07); state "FIRST FAILURE" **once**, prominently, instead of four times
  at four sizes; move the source and trust columns into a lower-weight context band (smaller type,
  secondary colour) and use depth (the centre region already sits at z +0.05) rather than horizontal
  spread to separate foreground from context — which also dissolves UX-02 and UX-08 structurally;
  give absence its own visual treatment distinct from downstream-affected (UX-11).
- **Interaction changes:** none required, but this is the direction that would most benefit from a
  real focus state later (UX-13).
- **Localization:** hierarchy by size and depth degrades more gracefully across languages than
  hierarchy by horizontal position — a net improvement for zh-CN.
- **Accessibility:** improves by reducing the number of simultaneously competing elements; still does
  not fix the status-colour profile gap on its own.
- **Performance:** neutral to slightly better (fewer simultaneously drawn labels).
- **Regression risk:** **moderate.** The three-column layout is what the accepted captures show;
  changing it invalidates the current visual baseline and needs a fresh capture pass.
- **Beam Pro:** required before claiming any glanceability or comfort benefit.
- **Must remain unchanged:** downstream consequences must stay traceable — reducing density must not
  remove the downstream chain; the rail must keep showing all four steps.
- **Deliberately excluded:** Time Mode, any animation of the failure.

---

## C. Executive demo refinement

**Principle:** the same truth, sequenced. Improve what a dean or vice-provost sees in the first
thirty seconds without inventing capability.

- **Scenes:** Audit Workspace + Audit Room Flat (the Flat surface is the better demo artefact today —
  it has a fit-to-content camera, an anchored inspector and a leader line).
- **Components:** presentation ordering in `ShadowAuditWorkspaceDeviceBootstrap` (which entity is
  focused first), the in-scene trust header in `demos/replay/3d/app.js`, and the cross-surface colour
  grammar (UX-12).
- **Visual changes:** resolve the Workspace/Flat contradiction so both surfaces read as one product;
  open on the first-failure state rather than the overview so the narrative starts at the point;
  make the `SIMULATED — NOT DEVICE VALIDATED` disclaimer *legible* (UX-05) — for this audience it is a
  credibility asset, not a blemish.
- **Interaction changes:** a scripted Prev/Next order for the demo path; no new capability.
- **Localization:** the demo must be presentable in both languages; UX-10 must be fixed first.
- **Accessibility:** inherits whatever UX-01 fix lands.
- **Performance:** neutral.
- **Regression risk:** **low to moderate** — mostly ordering and cross-surface consistency.
- **Beam Pro:** **required** if the demo is claimed to run on the glasses. Until the MR package
  handoff passes, this direction must be presented as a desktop/Flat demo.
- **Must remain unchanged:** every honesty boundary. No simulated tracking indicator, no fake device
  status, no implication that the glasses path is validated.
- **Deliberately excluded:** decorative sci-fi styling, glow, particle effects, animated HUD framing —
  all of which would reduce audit readability and are explicitly rejected.

---

## Recommendation ordering

A is a prerequisite for both B and C: B's hierarchy work and C's demo polish are both undermined by
overlapping text. **A first, then re-capture, then choose between B and C.** UX-01 (P0) sits slightly
outside A's "layout constants only" boundary and is proposed separately as the first increment.
