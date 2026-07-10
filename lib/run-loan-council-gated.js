// lib/run-loan-council-gated.js
// ──────────────────────────────────────────────────────────────────
// v1.5.43 (2026-07-09). Fixes SIVE BASELINE FINDING #2.
//
// runLoanCouncilGated wraps runLoanCouncil with a non-discretionary
// refusal gate per arXiv:2606.29142 (threat systematization).
//
// The gate short-circuits BEFORE persona deliberation when the loan
// hits a non-discretionary bar:
//   - OFAC / SDN match (via aml_flags)
//   - BSA §5318(g)(2) tipping-off finding
//   - Statutory / geographic / product ineligibility flags
//
// For those cases, the correct verdict is `refuse_to_serve`, NOT
// `escalate` — because human review CANNOT lawfully override the bar,
// and citing OFAC/BSA to the borrower creates a tipping-off risk.
//
// Prior to v1.5.43 this gate lived only in api/deliberate.js (wired at
// v1.5.36). runLoanCouncil() itself returned `escalate` for OFAC cases,
// which is what SIVE Finding #2 documented. This wrapper closes the
// finding at library level so SIVE, MCP, and any downstream caller
// gets the correct verdict without depending on the HTTP boundary.
//
// runLoanCouncil() is UNCHANGED — call it directly if you want raw
// persona deliberation without the refusal gate (SIVE baseline tests
// still exercise this path).
//
// Refs:
//   - arXiv:2606.29142 (Mohan/Srinivasa 2026-06-28) — Systematization
//     of Autonomous-Agent Threats in Regulated Financial Systems.
//   - docs/SIVE_BASELINE_FINDINGS.md Finding #2.
//   - BSA §5318(g)(2), 31 CFR 1010.230, OFAC 31 CFR 501.
//
// ──────────────────────────────────────────────────────────────────

import { runLoanCouncil } from "./run-loan-council.js";
import { maybeRefuseToServe } from "./refuse-to-serve.js";


/**
 * runLoanCouncilGated — refusal-gate + council in one call.
 *
 * Contract:
 *   - Non-discretionary refusal takes precedence over persona verdict.
 *   - When refusal fires, response.final_verdict = "refuse_to_serve",
 *     response.refuse_to_serve = {full refusal envelope}, and
 *     response.voices = [] (personas are NOT invoked, so cost = 0 in
 *     the LLM-backed variants of runLoanCouncil).
 *   - When no refusal, delegates to runLoanCouncil verbatim.
 *
 * Back-compat: existing runLoanCouncil callers see NO change. Only
 * new callers who explicitly import runLoanCouncilGated get the gate.
 *
 * @param {object} params
 * @param {object} params.loan - normalized or raw loan object
 * @param {object} [params.amlKycFindings] - optional findings envelope
 *   ({ findings: [{ rule_id, ... }] }). If omitted, gate derives it
 *   from loan.aml_flags for back-compat with SIVE fixture shape.
 * @param {object} [params.evidenceRef] - optional evidence pointer
 *   passed into refusal response envelope.
 * @returns {object} council response, verdict may be refuse_to_serve
 */
export function runLoanCouncilGated({ loan, amlKycFindings, evidenceRef } = {}) {
  if (!loan || typeof loan !== "object") {
    throw new TypeError("runLoanCouncilGated: loan is required");
  }

  // Refusal gate reads the RAW loan (not normalizeLoan output) because
  // normalizeLoan intentionally strips fields not needed for persona
  // deliberation, including the ineligibility flags. The refusal
  // primitive is the source-of-truth for which loan fields matter to
  // the gate; keeping the loan un-normalized here preserves that
  // contract.
  const findings = amlKycFindings || {
    findings: Array.isArray(loan.aml_flags)
      ? loan.aml_flags.map((f) =>
          typeof f === "string" ? { rule_id: f } : (f || {}))
      : [],
  };

  const refusal = maybeRefuseToServe({
    loan,
    amlKycFindings: findings,
    evidenceRef,
  });

  if (refusal) {
    return {
      final_verdict: "refuse_to_serve",
      refuse_to_serve: refusal,
      voices: [],
      adverse_action_codes: [],
      gate: "refuse_to_serve_gate",
      gate_reason: refusal.refusal_category,
    };
  }

  // No refusal — proceed with standard council deliberation.
  const council = runLoanCouncil(loan);
  return {
    ...council,
    gate: "pass_through",
  };
}
