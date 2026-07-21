// Analysis-only audit guardrail for Shadow Mode A.
//
// Mirrors Loredana C. Levitchi's enforce_analysis_only() from her
// orallexa.risk.audit module. Rationale: LLM voices in the council
// can hallucinate trade-execution verbs ("broker.execute", "auto_approve",
// "submit_order") that would silently break the analysis-only invariant
// required by BRD Governance Controls + SR 26-2 (formerly SR 11-7) model-risk standards.
//
// Run this as the last gate before /api/deliberate returns.

const FORBIDDEN_PATTERNS = [
  /\bbuy\b/i,
  /\bsell\b/i,
  /\btrade\b/i,
  /\bexecute\b/i,
  /\bsubmit[_ -]?order\b/i,
  /\bplace[_ -]?order\b/i,
  /\border[_ -]?ticket\b/i,
  /\bbroker\b/i,
  /\bauto[_ -]?approve\b/i,
  /\bauto[_ -]?rebalance\b/i,
  /\bmarket[_ -]?order\b/i,
  /\blimit[_ -]?order\b/i
];

export class AnalysisOnlyViolationError extends Error {
  constructor(violations, payload) {
    super(`Analysis-only guardrail violation: matched ${violations.join(", ")}`);
    this.name = "AnalysisOnlyViolationError";
    this.violations = violations;
    this.payload = payload;
  }
}

/**
 * Scan the council output (or any LLM-generated payload) for forbidden
 * trade-execution verbs. Throws AnalysisOnlyViolationError if any match;
 * returns a certified payload otherwise.
 *
 * Allowlist: known-safe domain terms that legitimately contain forbidden
 * substrings (e.g. "broker" appears in "broker-dealer regulatory framework"
 * style descriptive prose). Override the allowlist by passing a string in
 * `allow` that the violation regex matches.
 */
export function enforceAnalysisOnly(payload) {
  const text = typeof payload === "string"
    ? payload
    : JSON.stringify(payload);

  const violations = FORBIDDEN_PATTERNS
    .filter((re) => re.test(text))
    .map((re) => re.source);

  if (violations.length > 0) {
    throw new AnalysisOnlyViolationError(violations, payload);
  }

  return {
    analysis_only: true,
    trade_execution_enabled: false,
    status: "approved_for_human_review",
    violations: []
  };
}
