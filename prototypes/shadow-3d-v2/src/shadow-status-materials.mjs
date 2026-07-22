// Status → visual encoding for the Three.js guided-story player. Framework-agnostic data + a
// geometry spec. Every status carries text (EN + zh) + a SHAPE + an icon glyph — colour is a
// redundant channel, never the sole carrier. Shapes/severity come from the shared vocabulary; the
// palette mirrors design/shadow-spatial-tokens.json. Pure + deterministic (no three import here).
import { SEMANTIC_STATUS, statusMeta } from "../../../lib/shadow-semantic-vocabulary.mjs";

// severity → colour (redundant to shape + label). Matches shadow-spatial-tokens.json families.
const SEVERITY_COLOR = Object.freeze({
  pass: 0x4ade80, fail: 0xef4444, warn: 0xfbbf24, neutral: 0x8a92a0, abstain: 0x60a5fa, info: 0x8a92a0,
});

// vocabulary shape name → a Three.js geometry spec (type + args). The player instantiates these;
// keeping it as data lets Node unit-test the mapping without a WebGL context.
const SHAPE_GEOMETRY = Object.freeze({
  icosahedron: { type: "Icosahedron", args: [0.16, 0] },
  octahedron: { type: "Octahedron", args: [0.18, 0] },
  tetrahedron: { type: "Tetrahedron", args: [0.2, 0] },
  box: { type: "Box", args: [0.26, 0.26, 0.26] },
  ring: { type: "Torus", args: [0.15, 0.045, 12, 28] },
  disc: { type: "Cylinder", args: [0.16, 0.16, 0.05, 24] },
  pill: { type: "Capsule", args: [0.1, 0.22, 6, 12] },
});

export function statusVisual(status) {
  const meta = statusMeta(status); // throws on unknown → fail closed
  return {
    status,
    text_en: meta.text_en, text_zh: meta.text_zh,
    a11y_en: meta.a11y_en, a11y_zh: meta.a11y_zh,
    severity: meta.severity, icon: meta.icon, shape: meta.shape,
    color: SEVERITY_COLOR[meta.severity] ?? SEVERITY_COLOR.neutral,
    geometry: SHAPE_GEOMETRY[meta.shape] ?? SHAPE_GEOMETRY.box,
  };
}

export const ALL_STATUS_VISUALS = Object.freeze(Object.keys(SEMANTIC_STATUS).map(statusVisual));

export const DIM_COLOR = 0x3a4150;   // faded (focus+context out-of-focus)
export const EDGE_COLOR = 0x55606e;
export const EDGE_BAD_COLOR = 0xef4444;
export const FOCUS_RING_COLOR = 0x60a5fa;
