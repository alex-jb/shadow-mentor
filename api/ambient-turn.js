// POST /api/ambient-turn
// v1.5.47 (2026-07-09). Ambient Council Manager HTTP endpoint.
//
// Wraps runAmbientTurn() so a browser client (WebXR renderer on
// XREAL One Pro or Chrome fullscreen fallback) can fetch a layout
// descriptor over HTTP without bundling Node ESM modules.
//
// Body (all optional except question + persona_ids):
// {
//   "question": "Should we approve this $1.5M consumer loan?",
//   "persona_ids": ["credit_fundamentals", "risk_officer", ...],
//   "loan_context": { credit_score: 780, debt_to_income: 0.20, ... },
//   "run_council": true,      // if true, run runLoanCouncil and merge
//   "response_mode": "ambient" | "chat"
// }
//
// Returns the LayoutDescriptor from lib/ambient-manager.js.

import { runAmbientTurn } from "../lib/ambient-manager.js";
import { runLoanCouncil } from "../lib/run-loan-council.js";
import { validateLoan } from "../lib/schemas/loan.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const body = req.body || {};
  const { question, persona_ids, loan_context, run_council, response_mode } = body;

  if (typeof question !== "string" || !question.trim()) {
    return res.status(400).json({ error: "question is required (non-empty string)" });
  }
  if (!Array.isArray(persona_ids) || persona_ids.length === 0) {
    return res.status(400).json({ error: "persona_ids is required (non-empty array)" });
  }

  // Optionally run the council so the returned descriptor already
  // includes per-voice verdicts + the aggregated final_verdict.
  let council_output = null;
  if (run_council === true) {
    if (!loan_context || typeof loan_context !== "object") {
      return res.status(400).json({
        error: "run_council=true requires loan_context",
      });
    }
    const v = validateLoan(loan_context);
    if (!v.valid) {
      return res.status(400).json({
        error: "invalid loan_context",
        validation_errors: v.errors,
      });
    }
    council_output = runLoanCouncil(loan_context);
  }

  try {
    const descriptor = runAmbientTurn({
      question,
      persona_ids,
      loan_context: loan_context || null,
      council_output,
      response_mode: response_mode || "ambient",
    });
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(descriptor);
  } catch (err) {
    return res.status(400).json({ error: String(err?.message || err) });
  }
}
