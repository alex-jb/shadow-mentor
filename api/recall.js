// GET /api/recall?persona=X&scenario=Y&max_results=N
// Returns recent past council sessions for the analyst, simulating
// the "calibration corridor" XR experience the canonical proposal
// describes. The backend is selected by env via buildMemoryBackend():
// in-memory demo default, local-tiered JSONL, or Elasticsearch — the
// endpoint honors SHADOW_MEMORY_BACKEND instead of hard-wiring the demo.

import { buildMemoryBackend, describeMemoryBackend } from "../lib/memory-elastic.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const persona = url.searchParams.get("persona") ?? undefined;
  const scenario = url.searchParams.get("scenario") ?? undefined;
  const max_results = Number(url.searchParams.get("max_results") ?? 5);

  const { name: backend, persistent } = describeMemoryBackend();
  try {
    const memory = await buildMemoryBackend();
    const entries = await memory.recall({ persona, scenario, max_results });
    const stats = persona ? await memory.recallCalibrationStats({ persona }) : null;
    return res.status(200).json({ entries, calibration_stats: stats, backend, persistent });
  } catch (err) {
    // A configured-but-unwired backend (e.g. the Elastic stub) must degrade to a
    // clear 503, never an unhandled 500 — the demo default can't reach this.
    return res.status(503).json({
      error: `memory backend '${backend}' unavailable: ${err?.message ?? String(err)}`,
      backend,
    });
  }
}
