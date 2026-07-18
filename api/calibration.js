// GET /api/calibration?persona=compliance
// Standalone calibration-stats endpoint. The /api/recall endpoint embeds the
// same stats, but bank model-risk reviewers asked for a dedicated URL they
// can poll independently of session recall — to feed their SR 11-7
// monitoring dashboards without paying the cost of fetching full session
// histories every minute.

import { buildMemoryBackend, describeMemoryBackend } from "../lib/memory-elastic.js";

const VALID_PERSONAS = ["compliance", "quant", "engineer", "trader", "advisor"];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=60");

  const url = new URL(req.url, `http://${req.headers?.host ?? "localhost"}`);
  const persona = url.searchParams.get("persona");

  const { name: backend } = describeMemoryBackend();
  let memory;
  try {
    memory = await buildMemoryBackend();
  } catch (err) {
    // Configured-but-unwired backend (e.g. Elastic stub) → clean 503, not a 500.
    return res.status(503).json({ error: `memory backend '${backend}' unavailable: ${err?.message ?? String(err)}`, backend });
  }

  if (!persona) {
    // Return calibration across all personas at once
    try {
      const all = {};
      for (const p of VALID_PERSONAS) {
        all[p] = await memory.recallCalibrationStats({ persona: p });
      }
      return res.status(200).json({
        personas: all,
        backend,
        rubric_version: "0.3.3",
        brier_interpretation: "0 = perfect calibration, 0.25 = unhelpful baseline (always 50%), 1 = perfectly wrong"
      });
    } catch (err) {
      return res.status(503).json({ error: `memory backend '${backend}' unavailable: ${err?.message ?? String(err)}`, backend });
    }
  }

  if (!VALID_PERSONAS.includes(persona)) {
    return res.status(400).json({
      error: `unknown persona: ${persona}`,
      valid_personas: VALID_PERSONAS
    });
  }

  let stats;
  try {
    stats = await memory.recallCalibrationStats({ persona });
  } catch (err) {
    return res.status(503).json({ error: `memory backend '${backend}' unavailable: ${err?.message ?? String(err)}`, backend });
  }
  if (!stats) {
    return res.status(200).json({
      persona,
      n: 0,
      mean_brier: null,
      outcome_dist: {},
      backend,
      note: "no entries with resolved outcomes for this persona yet"
    });
  }

  return res.status(200).json({
    persona,
    ...stats,
    backend,
    rubric_version: "0.3.3",
    brier_interpretation: "0 = perfect calibration, 0.25 = unhelpful baseline (always 50%), 1 = perfectly wrong"
  });
}
