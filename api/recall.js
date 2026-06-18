// GET /api/recall?persona=X&scenario=Y&max_results=N
// Returns recent past council sessions for the analyst, simulating
// the "calibration corridor" XR experience the canonical proposal
// describes. Production = Elasticsearch backend; this is the demo
// using lib/memory.js InMemoryMemory.

import { memorySingleton } from "../lib/memory.js";

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const persona = url.searchParams.get("persona") ?? undefined;
  const scenario = url.searchParams.get("scenario") ?? undefined;
  const max_results = Number(url.searchParams.get("max_results") ?? 5);

  const entries = memorySingleton.recall({ persona, scenario, max_results });
  const stats = persona ? memorySingleton.recallCalibrationStats({ persona }) : null;

  return res.status(200).json({
    entries,
    calibration_stats: stats,
    backend: "in-memory-mock",
    real_backend_planned: "Elasticsearch on-premises per analyst index, 0.89 recall per HF baseline 2026-06-17"
  });
}
