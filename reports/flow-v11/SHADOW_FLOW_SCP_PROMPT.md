# Flow SCP prompt — Shadow banking audit presentation

For pasting into the Flow SCP (Spatial Cognitive Platform) prompt box **after** uploading the
supplied data files. Written against the constraint set of this spike; the exact ingestion path is
pending vendor confirmation (see `FLOW_SUPPORT_QUESTIONS_FOR_BILL_AND_JASON.md`).

## Short prompt

> Build a spatial data story from the uploaded Shadow audit files only — do not invent any
> financial facts, numbers, or conclusions. Center the scene on the node whose status is
> FIRST_FAILURE. Place the case card and evidence items to the left, the five council voices in a
> ring around the center, and the decision → human review → approval sequence to the right. Lay the
> seven lineage nodes as an ordered path (sequence 0–6) along the bottom. Keep the four
> verification nodes in a separate area — verification is independent of the business conclusion.
> Preserve every node's id, status, and English/Chinese labels exactly as supplied. Use restrained
> financial-compliance styling (two accent colors max, no sci-fi decoration). Keep the label
> "FIXTURE MODEL" visible: this is a demonstration fixture, and no physical Shadow Lens device
> capability is implied.

## Expanded prompt

> **Data discipline.** Use only the uploaded files: `shadow-flow-presentation-nodes.csv`,
> `shadow-flow-presentation-edges.csv`, and optionally `shadow-flow-demo-export.csv` for the
> underlying row facts. Every visual element must correspond to a row; do not generate, estimate,
> or extrapolate any value. Do not change any status, stance, confidence, or recommendation —
> Shadow computed those and Flow only displays them.
>
> **Spatial layout.**
> - Focal point: the single node with `is_first_failure = true` (status FIRST_FAILURE / 首个失败).
>   Largest visual weight in the scene.
> - Left: the `left-case` group (case card + three evidence items).
> - Ring around center: the `ring-council` group (five voices with stance + confidence).
> - Right: the `right-downstream` group in order decision → human review → approval. Human Review
>   and Approval are distinct: review is REQUIRED; approval is NOT PRESENT in this fixture — never
>   merge or imply approval happened.
> - Bottom path: the `path-lineage` group ordered strictly by `sequence` 0→6; nodes with
>   `is_affected_downstream = true` render dimmed/frozen, visually consequent to the first failure.
> - Separate area (not adjacent to the decision): the `verification-area` group — hash chain,
>   record integrity, digital signature, and ANALYTICAL CORRECTNESS: NOT EVALUATED. Include the
>   attestation node and the SIMULATION device-boundary disclaimer node.
>
> **Edges.** Render `lineage` edges as the ordered chain; `council` edges as thin cite/disagree
> links; `downstream` edges as consequence lines back to the first failure; `verification` edges
> as attestation links. Keep provenance ids (`source_ref`) attached to each node's detail view.
>
> **Labels.** Bilingual: show `label_en`, offer `label_zh` where the platform supports a second
> label line or toggle. Never rewrite label text.
>
> **Styling.** Restrained financial/compliance look: neutral background, one warm accent for
> failure states (status_family = fail), one cool accent for pass, gray for neutral/abstain/info.
> No particle effects, no generic sci-fi decoration.
>
> **Honesty.** Keep "FIXTURE MODEL" visible in the scene. Do not add copy implying: live production
> AI, physical Shadow Lens validation, that VERIFIED means trusted/compliant, or that council
> majority means correct.

## Expected input files

1. `demo-package/shadow-flow-presentation-nodes.csv` (22 nodes)
2. `demo-package/shadow-flow-presentation-edges.csv` (19 edges)
3. `demo-package/shadow-flow-demo-export.csv` (16 rows, optional fact backing)

## Expected output structure

A single Flow scene with six visually distinct regions (center / left / ring / right / bottom path
/ verification area), one guided-step sequence roughly matching the storyboard's 9 steps, bilingual
labels preserved, stable node IDs preserved (so the scene can be cross-checked against the offline
verifier's output later).

## Acceptance checklist (from §9 of the spike spec)

- [ ] First Failure identifiable immediately (center, largest weight)
- [ ] Evidence order preserved (sequence 0→6, no reordering)
- [ ] Council roles attributable (5 named voices, stances verbatim)
- [ ] No fabricated source, number, or conclusion anywhere in the scene
- [ ] Downstream relationships match the export (`is_affected_downstream` nodes only)
- [ ] Human Review distinct from Approval; approval shown as NOT PRESENT
- [ ] Verification area independently understandable, separate from the decision
- [ ] EN/ZH labels semantically equivalent (as supplied)
- [ ] Flow labeled as visualization layer; Shadow as analysis/evidence authority
- [ ] No native Shadow Lens success implied; SIMULATION disclaimer node visible
- [ ] Scene built from the sanitized deterministic payload only
