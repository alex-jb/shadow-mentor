// POST /api/spatial-render
// v1.5.13 candidate — Flow Immersive-shaped scene JSON from a Shadow
// /api/deliberate response.
//
// Motivation: XREAL One Pro + Flow Immersive presentation layer path
// (Yeshiva Dean + Vice-Provost demo track). Flow's scene template
// consumes structured position + rotation data; if we can hand it
// pre-computed positions instead of asking a Flow contributor to
// re-derive them from Shadow's /api/deliberate response, the
// integration is a 1-line JSON.parse for them.
//
// Design note: layout is *deterministic* — position only depends on
// persona index + mode, not runtime data. Same council response
// always renders to the same scene.

import { buildSpatialScene, RENDER_MODES } from "../lib/spatial-render.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: "invalid JSON body" });
    return;
  }

  const { deliberate_response: deliberateResponse, mode = "full", focus_personas: focusPersonas } = body ?? {};

  if (!deliberateResponse) {
    res.status(400).json({
      error: "missing deliberate_response field",
      hint: "POST body must be {deliberate_response: <Shadow /api/deliberate response>, mode?: 'full'|'reduced'|'focus'|'tethered'}",
    });
    return;
  }

  if (!Object.values(RENDER_MODES).includes(mode)) {
    res.status(400).json({
      error: `unknown mode "${mode}"`,
      valid: Object.values(RENDER_MODES),
    });
    return;
  }

  try {
    const scene = buildSpatialScene(deliberateResponse, { mode, focusPersonas });
    res.status(200).json(scene);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
