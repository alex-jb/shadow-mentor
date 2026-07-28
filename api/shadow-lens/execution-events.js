// POST /api/shadow-lens/execution-events — §7 client execution confirmation.
// Records MATERIAL execution events only (what actually rendered on the client). Rejects
// continuous camera/gaze/mouse telemetry. Same Shadow security posture (allowlisted CORS,
// reject Origin: null, no-store, strict cap). Stateless demo sink: it validates + echoes a
// recorded count; a durable evidence store would persist these as evidence events.
const DEFAULT_ORIGINS = (process.env.SHADOW_LENS_ALLOWED_ORIGINS || "https://shadow-mentor-phi.vercel.app,http://localhost:8127")
  .split(",").map((s) => s.trim()).filter(Boolean);

const MATERIAL = new Set(["EXECUTED", "REJECTED", "TARGET_NOT_FOUND", "UNSUPPORTED_BY_CLIENT", "RENDER_FAILED"]);
const TELEMETRY = new Set(["camera_frame", "mouse_move", "gaze", "pointer", "scroll"]);

function applyCors(req, res) {
  const origin = req.headers?.origin;
  if (origin && origin !== "null" && DEFAULT_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
}

// Exported for tests: keep only material action events; drop telemetry / malformed.
export function filterMaterialEvents(events) {
  return (Array.isArray(events) ? events : []).filter((e) =>
    e && typeof e.requested_action === "string" && e.requested_action !== "?" &&
    !TELEMETRY.has(e.requested_action) && MATERIAL.has(e.execution_status));
}

export default function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = req.body ?? {};
  if (JSON.stringify(body).length > 200_000) return res.status(413).json({ error: "payload too large" });
  const material = filterMaterialEvents(body.events);
  console.log(`[execution-events] recorded=${material.length} dropped=${(body.events?.length ?? 0) - material.length}`);
  return res.status(200).json({ ok: true, recorded: material.length, dropped: (body.events?.length ?? 0) - material.length });
}
