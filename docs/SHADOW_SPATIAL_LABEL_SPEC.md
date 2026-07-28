# Shadow spatial label + typography spec (Phase 1E)

Shared by Unity (uGUI/TextMeshPro world-space) and Three.js (canvas-texture sprites). Do NOT render every
label permanently. All spatial numeric values are **hypotheses until One Pro measurement** — never a Beam
Pro claim. Tokens: `design/shadow-spatial-tokens.json`.

## Label priority (what shows when)
- **P0** — the selected node and the current failure (always visible, full label).
- **P1** — direct provenance neighbours of the focus (visible, short label; expand on focus).
- **P2** — agent/tool/source context (visible only when relevant / on the context layer).
- **P3** — hidden until requested (open on demand).
This is carried in the contract per node (`label_priority`), so both engines fade identically.

## Label rules
- **Camera-facing** (billboard), but set once at build for a fixed viewpoint on 3DoF — no per-frame spin.
- **Stable anchoring** to the node; collision avoidance so P0/P1 labels never overlap (drop to icon when crowded).
- **Max line length** ~18 chars for `label_short`; `label_full` only on focus/expand.
- **Distance-based abbreviation**: far → short label or icon only; on focus → full text.
- **Background plate** (scrim, alpha ≥ 0.86 over passthrough) so text stays readable; **contrast ≥ 5:1** (hypothesis).
- **Status = icon/shape + text + colour**, never colour alone (a11y + the token set encodes all three).
- **Monospace** for hashes and IDs; original evidence quotes rendered verbatim (never translated/altered).
- **Bilingual**: EN + 简体中文; Chinese wraps without clipping; min angular x-height ≥ 0.2° (hypothesis).
- **Occlusion fallback**: if a P0/P1 label is occluded, show an off-screen/edge indicator or promote to the
  side panel. The 2D audit table is the always-available fallback.

## Do not
Surround the user with permanent labels; require interaction behind the user; encode meaning by colour
alone; treat any depth/size number here as a measured device value.
