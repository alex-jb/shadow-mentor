# Layout comparison + scalability (Phase 1F)

Same `shadow-3d-scene-v1` fixture in four layouts, rendered in the isolated Three.js prototype (real
screenshots in `media/research/3d-layout-comparison/`). Engineering metrics only — **these do NOT claim
user-comprehension improvement** (that needs the user study, Phase 3). Scale figures for 7/20/50/100 are
calculated from the layout functions, not measured on device.

## Scores (1–5; higher = better for that dimension)
| dimension | Arc | DAG | Timeline | Hybrid (2D+3D) |
|---|---|---|---|---|
| sequence comprehension | 3 | 4 | **5** | 4 |
| tamper propagation | 4 | 4 | 4 | **5** |
| claim→source tracing | 2 | **4** | 3 | **5** |
| narrow-FOV (57°) suitability | 3 | 2 | **4** | **5** |
| scalability 7→100 nodes | 2 | 3 | 3 | **5** |
| controller usability | 3 | 3 | 4 | **4** |
| keyboard/table usability | 2 | 2 | 3 | **5** |
| screenshot clarity | 4 | 3 | **5** | 4 |
| rendering cost (low=better) | **5** | 4 | **5** | 4 |
| implementation complexity (low=better) | **5** | 3 | 4 | 2 |

## Scalability (calculated)
| nodes | Arc | DAG | Timeline | Hybrid |
|---|---|---|---|---|
| 7 | arc/timeline both usable | ok | ok | overkill |
| 20 | labels overlap on the arc | **clearer** | **clearer** | good |
| 50 | unreadable without cull | needs layering/cluster | scroll/scrub | **table + focused 3D** |
| 100 | not usable | **cluster required** | **cluster + scrub** | **2D table primary, 3D on focus** |
Permanent full labels do not scale past ~20 nodes → enforce label priority P0–P3 + cluster/collapse.

## Recommendation
- **7 nodes (the demo):** Arc or Timeline; Arc is the current demo and reads well.
- **≥20 nodes:** Layered DAG or Timeline.
- **≥50 nodes:** **Hybrid** — 2D audit table primary, focused 3D detail on selection; cluster the rest.
- Always keep the **2D audit table fallback**. 3D earns its place for *sequence + causality + tamper
  propagation + provenance*, not for volume — the market wants reconstruction, not 3D for its own sake.
