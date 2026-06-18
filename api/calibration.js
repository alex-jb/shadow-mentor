// GET /api/calibration?persona=compliance
// Standalone calibration-stats endpoint. The /api/recall endpoint embeds the
// same stats, but bank model-risk reviewers asked for a dedicated URL they
// can poll independently of session recall — to feed their SR 11-7
// monitoring dashboards without paying the cost of fetching full session
// histories every minute.

import { memorySingleton } from "../lib/memory.js";

const VALID_PERSONAS = ["compliance", "quant", "engineer", "trader", "advisor"];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=60");

  const url = new URL(req.url, `http://${req.headers?.host ?? "localhost"}`);
  const persona = url.searchParams.get("persona");

  if (!persona) {
    // Return calibration across all personas at once
    const all = {};
    for (const p of VALID_PERSONAS) {
      all[p] = memorySingleton.recallCalibrationStats({ persona: p });
    }
    return res.status(200).json({
      personas: all,
      rubric_version: "0.3.3",
      brier_interpretation: "0 = perfect calibration, 0.25 = unhelpful baseline (always 50%), 1 = perfectly wrong"
    });
  }

  if (!VALID_PERSONAS.includes(persona)) {
    return res.status(400).json({
      error: `unknown persona: ${persona}`,
      valid_personas: VALID_PERSONAS
    });
  }

  const stats = memorySingleton.recallCalibrationStats({ persona });
  if (!stats) {
    return res.status(200).json({
      persona,
      n: 0,
      mean_brier: null,
      outcome_dist: {},
      note: "no entries with resolved outcomes for this persona yet"
    });
  }

  return res.status(200).json({
    persona,
    ...stats,
    rubric_version: "0.3.3",
    brier_interpretation: "0 = perfect calibration, 0.25 = unhelpful baseline (always 50%), 1 = perfectly wrong"
  });
}
