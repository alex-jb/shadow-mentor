// Spatial-render layout — v1.5.13 candidate.
//
// Maps a Shadow /api/deliberate response to a Flow Immersive-shaped scene
// JSON. Every persona becomes a spatial card at a fixed position in a
// 4x4 meter review room, laid out as a semicircle around a reviewer
// standing at (0, 1.6, 1). The hash-chain audit trail becomes a
// walk-through 3D object at (0, 1.4, -2).
//
// The layout is *deterministic* (position depends only on persona index +
// mode, never on runtime data), so a Flow scene template only needs to
// consume the JSON — it does not need to compute positions itself.
//
// Fallback modes:
//   - "full"     — 5 or 6 personas visible + ambient background (default)
//   - "reduced"  — 5 or 6 personas visible, no ambient background (for
//                  X1 chip standalone rendering under FPS pressure)
//   - "focus"    — 2 personas visible, 3-4 hidden behind a voice cabinet
//                  UI (for reviewer summon-on-demand pattern)
//   - "tethered" — same as full but with an explicit tetheredMode: true
//                  flag so the Flow client can hint the reviewer to plug
//                  in the laptop
//
// Coordinate convention: right-handed, Y up, meters.
// Reviewer origin: (0, 1.6, 1) looking toward -Z.

const REVIEWER_ORIGIN = { x: 0, y: 1.6, z: 1 };
const PERSONA_RADIUS_M = 1.8; // semicircle radius from origin
const PERSONA_HEIGHT_M = 1.6; // eye-height
const AUDIT_CHAIN_POSITION = { x: 0, y: 1.4, z: -2.0 };

const RENDER_MODES = Object.freeze({
  FULL: "full",
  REDUCED: "reduced",
  FOCUS: "focus",
  TETHERED: "tethered",
});

/**
 * Given N personas, return their semicircle positions in world coordinates.
 * Positions span from -90° to +90° around the reviewer's forward direction.
 * @param {number} n — persona count (typically 5 or 6)
 * @returns {Array<{x: number, y: number, z: number, thetaDeg: number}>}
 */
function semicirclePositions(n) {
  if (n < 1) throw new Error("semicirclePositions requires n >= 1");
  const positions = [];
  const spread = 180; // degrees, -90 to +90
  for (let i = 0; i < n; i++) {
    // -90° at i=0, +90° at i=n-1
    const thetaDeg = n === 1 ? 0 : -90 + (spread * i) / (n - 1);
    const thetaRad = (thetaDeg * Math.PI) / 180;
    positions.push({
      x: REVIEWER_ORIGIN.x + PERSONA_RADIUS_M * Math.sin(thetaRad),
      y: PERSONA_HEIGHT_M,
      // Personas sit ahead of the reviewer (negative Z from reviewer origin)
      z: REVIEWER_ORIGIN.z - PERSONA_RADIUS_M * Math.cos(thetaRad),
      thetaDeg,
    });
  }
  return positions;
}

/**
 * Build a spatial scene JSON from a Shadow /api/deliberate response.
 * @param {object} deliberateResponse — the response object
 * @param {object} [opts]
 * @param {string} [opts.mode] — one of RENDER_MODES values (default "full")
 * @param {Array<string>} [opts.focusPersonas] — persona names to keep visible
 *   in "focus" mode; others rendered as cabinet_hidden. Defaults to the
 *   first two personas if not provided.
 * @returns {object} spatial scene JSON
 */
export function buildSpatialScene(deliberateResponse, opts = {}) {
  const mode = opts.mode ?? RENDER_MODES.FULL;
  if (!Object.values(RENDER_MODES).includes(mode)) {
    throw new Error(
      `buildSpatialScene: unknown mode "${mode}". Valid: ${Object.values(RENDER_MODES).join(", ")}`,
    );
  }

  const voices = Array.isArray(deliberateResponse?.voices)
    ? deliberateResponse.voices
    : Array.isArray(deliberateResponse?.loan_council?.voices)
      ? deliberateResponse.loan_council.voices
      : [];

  if (voices.length === 0) {
    throw new Error(
      "buildSpatialScene: no voices found in deliberateResponse (expected top-level 'voices' array or loan_council.voices)",
    );
  }

  const positions = semicirclePositions(voices.length);
  const focusSet = new Set(opts.focusPersonas ?? voices.slice(0, 2).map((v) => v.voice));

  const personas = voices.map((voice, i) => {
    const pos = positions[i];
    const visible =
      mode === RENDER_MODES.FOCUS ? focusSet.has(voice.voice) : true;
    return {
      persona_name: voice.voice,
      verdict: voice.verdict ?? "unknown",
      rationale_short: voice.rationale_short ?? voice.rationale ?? "",
      confidence: typeof voice.confidence === "number" ? voice.confidence : null,
      citation: voice.citation ?? null,
      adverse_action_code: voice.adverse_action_code ?? null,
      position: { x: pos.x, y: pos.y, z: pos.z },
      rotation_y_deg: pos.thetaDeg + 180, // face the reviewer
      visible,
      visibility_reason: visible
        ? null
        : "hidden_by_focus_mode — summon via cabinet UI",
    };
  });

  const auditChain = deliberateResponse?.audit_chain ??
    deliberateResponse?.attestation?.previous_hash ?? null;

  return {
    scene_schema: "shadow-spatial/v1.0.0",
    generated_at_utc: new Date().toISOString(),
    mode,
    reviewer_origin: { ...REVIEWER_ORIGIN, rotation_y_deg: 0 },
    room_extent_m: { x: 4, y: 3, z: 4 },
    personas,
    audit_chain_object: auditChain
      ? {
          type: "hash_chain_walkthrough",
          position: AUDIT_CHAIN_POSITION,
          chain_head_hash: auditChain,
          walk_through: true,
          description:
            "Cryptographic audit trail rendered as a walk-around 3D object. Each ring is one previous_hash link. Reviewer walks through to inspect chain integrity.",
        }
      : null,
    ambient_background:
      mode === RENDER_MODES.FULL || mode === RENDER_MODES.TETHERED
        ? {
            type: "3d_gaussian_splat",
            source: "webcam_capture",
            note: "Rendered by client when 3DGS pipeline is available; skip when reduced mode.",
          }
        : null,
    verdict_aggregate: {
      final_verdict: deliberateResponse?.verdict ?? deliberateResponse?.loan_council?.verdict ?? null,
      confidence_weighted:
        deliberateResponse?.confidence_weighted_verdict ??
        deliberateResponse?.loan_council?.confidence_weighted_verdict ??
        null,
    },
    tethered_hint: mode === RENDER_MODES.TETHERED,
    fallback_paths: {
      note: "If FPS < 45 in full mode, request mode=reduced. If still < 45, request mode=focus. If still < 45, request mode=tethered (client plugs XREAL into laptop).",
    },
  };
}

export { RENDER_MODES, semicirclePositions, REVIEWER_ORIGIN, PERSONA_RADIUS_M };
