// POST /api/loan-council
// Pure-compute structured loan-council endpoint. No LLM calls — just runs
// Loredana's 5-voice deterministic council + verdict resolver on a typed
// loan dict. Bank model-risk teams want a way to fire the rule layer
// independently of the LLM deliberation for SR 11-7 evidence and unit
// reproducibility.
//
// Body shape (validated via lib/schemas/loan.js):
//   {
//     loan: {
//       credit_score: number 300..850,
//       debt_to_income: number 0..2,
//       loan_to_value: number 0..2,
//       amount: number > 0,
//       borrower_rating?: "BB" | "B" | "BBB" | ...,
//       sector?: string,
//       fair_lending_review_flag?: boolean,
//       adverse_action_reasons?: string[],
//       market_proxy_prices?: number[],         // ≥3 positive
//       collateral_positions?: { ticker, sector, weight }[],
//       borrower_exposure_weights?: { name: weight }
//     }
//   }

import { runLoanCouncil } from "../lib/run-loan-council.js";
import { validateLoan } from "../lib/schemas/loan.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { loan } = req.body ?? {};
  if (!loan) {
    return res.status(400).json({
      error: "missing 'loan' in request body",
      example: {
        loan: {
          credit_score: 720,
          debt_to_income: 0.30,
          loan_to_value: 0.75,
          amount: 250000
        }
      }
    });
  }

  const v = validateLoan(loan);
  if (!v.valid) {
    return res.status(400).json({ error: "invalid loan", validation_errors: v.errors });
  }

  const t0 = Date.now();
  const result = runLoanCouncil(loan);
  const latency_ms = Date.now() - t0;

  return res.status(200).json({
    ...result,
    latency_ms,
    timestamp: new Date().toISOString()
  });
}
