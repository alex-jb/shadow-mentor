// demos/replay/3d/constants.js
// ─────────────────────────────────────────────────────────────────
// THE ONE CONSTANTS BLOCK (design principle 8).
//
// Every spatial, legibility, colour, and timing value lives here so it
// can be tuned against the glasses without hunting through code. Nothing
// downstream should hard-code a size, colour, angle, or duration — if you
// find yourself typing a number into scene.js, it belongs here instead.
//
// Two presets share one scene graph (Phase 1.4):
//   • laptop  — richer look for projector + screen-recording assets
//   • xreal   — the optics palette: pure-black bodies, bright text, and
//               a font bump for the ~33 PPD real resolution of One Pro.
// `?xreal=1` selects the xreal preset; default is laptop.
//
// Colour rule (principle 5): colour encodes STATUS only, never type.
// Type is carried by the label text + glyph. A card body is pure #000
// (an invisible solid in the room — principle 1); only edges, text, and
// connectors emit light.
// ─────────────────────────────────────────────────────────────────

// Status palette — the ONLY meanings colour is allowed to carry.
// PROFILE OVERRIDE: this is the named `AuditRoomProvenance` surface profile, NOT the flat
// semantic table. In the Audit Room the RESTING/verified card surface is NEUTRAL paper
// (#E8E8E8) — every card is intact by default, so painting them the semantic VERIFIED green
// (#4ade80) would make green the room's background and destroy its signal. Verification is
// carried by DEVIATION instead: `tampered` red marks a break, and `healed` green is the
// transient verify/reset PULSE (the verification EVENT). So green still means verification —
// as a confirmation cue, not a resting fill. See reports/spatial-ux-v11/TOKEN_PROFILE_OVERRIDE_POLICY.md;
// test/threejs-profile-override.test.js pins this so the deviation can't drift into arbitrary.
export const STATUS = Object.freeze({
  intact:   "#E8E8E8", // resting/verified SURFACE — neutral paper (profile override, not status green)
  error:    "#FFB020", // a lens/quality flag (amber) — not a chain break
  tampered: "#FF4A4A", // the mutated event / broken links (red)
  healed:   "#3DDC97", // transient verify/reset PULSE (green = verification EVENT cue)
});

// Non-status greys/whites. These carry no state meaning.
export const INK = Object.freeze({
  body:      "#000000", // card body — invisible solid (principle 1)
  text:      "#E8E8E8", // bright, NOT glowing (principle 4)
  textDim:   "#8A93A3", // secondary in-scene text (seq, captions labels)
  connector: "#4A5568", // cold-white hairline chain links (principle 1)
  lensPulse: "#FFFFFF", // review-lens highlight edge pulse (Phase 4.2)
  roomBg:    "#000000", // laptop scene clear colour; xreal renders transparent
});

// Shared geometry + timing. Values are glasses-tuned DEFAULTS — measured
// starting points, not guesses locked in stone. Adjust here, reload, look.
const BASE = {
  // ── Cards (Phase 1.2/1.3: small cards, wide arc) ──
  CARD_W: 0.80,            // legible default for laptop preview; retune on glasses
  CARD_H: 0.52,
  CARD_SCALE: 1.0,         // global multiplier
  CARD_CORNER: 0.05,       // rounded-rect radius
  CARD_DEPTH_SCALE: 0.05,  // slight extra growth toward the (nearer) arc edges

  // ── Arc (Phase 1.3 / principle 2: arc beat the Z-axis) ──
  // Cards sit on a concave circle of radius ARC_RADIUS centred behind the
  // viewer: centre card farthest, edges wrap nearer. Depth = arc + scale +
  // stereo parallax, never Z-stacking.
  ARC_RADIUS: 5.5,
  ARC_SPREAD_DEG: 88,      // fans across most of the field of view
  ARC_CURVATURE: 0.82,     // <1 flattens the wrap so edges don't crowd the eye
  ARC_Y: 0.0,              // vertical centre of the chain
  ARC_TILT_DEG: 0,         // whole-arc pitch, usually 0

  // ── Camera (Phase 1.5: frame the whole chain, no dragging needed) ──
  CAMERA_FOV: 55,
  CAMERA_POS: [0, 0, 3.0], // viewer position; cards face this point
  CAMERA_TARGET: [0, 0, -3],
  ORBIT_LIMIT_DEG: 60,     // clamp orbit so you can't swing behind the chain
  GLIDE_SPEED: 2.0,        // Phase 6 webxr smooth-glide, m/s

  // ── Text (world units; troika SDF, principle 4/7) ──
  FONT_SIZE_TYPE: 0.072,      // the one-word event type on the card face
  FONT_SIZE_SEQ: 0.036,       // the small #seq
  FONT_SIZE_CAPTION: 0.115,   // the big tamper verdict caption
  FONT_SIZE_INSPECTOR: 0.030, // in-scene inspector rows
  FONT_SIZE_BADGE: 0.034,     // trust badges + lens name

  // ── Emissive / connectors (principle 1/4: light is the only material) ──
  EDGE_EMISSIVE: 0.85,     // edge line brightness — faint, never bloom
  CONNECTOR_ALPHA: 0.55,   // hairline chain-link opacity
  DIM_OPACITY: 0.28,       // broken/unverifiable downstream cards
  LENS_DIM_OPACITY: 0.5,   // non-matching cards under a review lens (Phase 4.2)

  // ── Stereo (Phase 2) ──
  // Start smaller than a full IPD: on the One Pro's small FoV, world-fixed
  // cards at modest distance fuse more comfortably near ~0.03–0.045 than at a
  // literal 0.062 IPD (else near cards diverge). Tuned live with [ ].
  EYE_SEP: 0.045,
  CONVERGENCE_OFFSET: 0.0, // parallax zero-plane shift (Phase 2.4)
  XREAL_FONT_SCALE: 1.0,   // overridden per-preset below

  // ── Disclosure + timing ──
  PROXIMITY_THRESHOLD: 6.0, // beyond this camera-distance a card shows type only (Phase 5.1)
  FADE_MS: 220,             // proximity fade-in of detail
  CASCADE_STEP_MS: 40,      // per-card downstream break step (Phase 3.3)
  CASCADE_EDGE_MS: 400,     // tampered edge → red transition (Phase 3.3)
  CAPTION_HOLD_MS: 3000,    // big caption dwell before it docks (Phase 3.4)
  BEAT_TWEEN_MS: 1200,      // camera beat tween (Phase 7.1)
  LENS_PULSE_HZ: 1.0,       // review-lens highlight pulse rate (Phase 4.2)

  // ── Which event the demo mutates (Phase 3.3) ──
  // seq 6 in the demo bundle is the `tool_call` with tool "Edit" — a
  // file_write-class payload, exactly what the spec calls for.
  MUTATE_SEQ: 6,
};

// Preset overrides. laptop keeps a slightly richer, brighter look for
// recordings; xreal is the additive-optics palette + font bump.
const PRESETS = {
  laptop: {
    XREAL_FONT_SCALE: 1.0,
    TRANSPARENT: false,      // render on a black room background
    CONNECTOR_ALPHA: 0.55,
  },
  xreal: {
    // One Pro is ~38 PPD horizontal (geometric: 1920 px over the horizontal
    // component of a 57° DIAGONAL FoV — NOT 1920÷57). Well under the ~60 PPD
    // eye limit, so text must be generously sized and kept near the centre.
    XREAL_FONT_SCALE: 1.35,
    TRANSPARENT: true,       // pure #000 clear → optical see-through
    CONNECTOR_ALPHA: 0.62,   // hairlines need a touch more against the room
  },
};

export function buildConstants(preset = "laptop") {
  const p = PRESETS[preset] ?? PRESETS.laptop;
  return Object.freeze({ ...BASE, ...p, PRESET: preset, STATUS, INK });
}

// Sensible module-level default so tests / tools can import a ready object.
export const C = buildConstants("laptop");
