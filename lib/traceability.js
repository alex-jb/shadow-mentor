// ES module — see package.json "type": "module". Uses `import` not `require`.
import { createHash } from "node:crypto";

// Citation traceability for Shadow Mode A loan origination.
//
// Returned inline in every /api/deliberate response so procurement
// auditors see the source chain without separate documentation.
// Sources separated per Loredana C. Levitchi's 2026-06-19 BRD vs
// Addenda guidance:
//
//   BRD       = institutional risk framework (board-approved, version-
//               controlled). Provides math + governance + horizons.
//   Addenda   = product-line policy thresholds (product team owned,
//               revisable quarterly). Provide loan underwriting cutoffs.
//   Risk Appetite Note = benchmark calibration parameter (model team
//                        owned, revisable per validation cycle).
//
// Conflating these three layers is the classic procurement-audit failure
// mode. Examiners discount the entire citation chain when sources are
// mis-attributed. This map keeps every claim at the correct provenance
// depth.

export const TRACEABILITY = {
  "FICO >= 700":      "Addendum A - Loan Origination Credit Policy",
  "DTI <= 0.36":      "Addendum B - Debt-to-Income Eligibility Policy",
  "LTV <= 0.80":      "Addendum C - Collateral / LTV Policy",
  "VaR <= 0.12":      "Addendum C - Risk Appetite Note (benchmark calibration)",
  "VaR/ES Framework": "BRD Risk Core Specification",
  "10-Day Horizon":   "BRD Risk Packet Methodology",
  "Confidence 95%":   "BRD Risk Packet Methodology",
  "Analysis Only":    "BRD Governance Controls",
  "ECOA / Reg B":     "CFPB Circular 2026-03 + BRD Governance Controls",
  "SR 11-7":          "Federal Reserve Model Risk Management Guidance (rescinded 2026-04-17, replaced by SR 26-2)",
  "SR 26-2":          "Federal Reserve Model Risk Management Guidance (formerly SR 11-7)"
};

/**
 * Classify a 10-day 95% VaR against the standard risk appetite bucket.
 * Source: Addendum C Risk Appetite Note (benchmark calibration; not BRD).
 *
 *   var_horizon <= 0.12         within_budget
 *   0.12 < var_horizon <= 0.15  escalate
 *   var_horizon > 0.15          breach
 */
export function classifyVarStatus(var_horizon, threshold = 0.12) {
  if (var_horizon <= threshold)        return "within_budget";
  if (var_horizon <= threshold + 0.03) return "escalate";
  return "breach";
}

// ═══════════════════════════════════════════════════════════════
// Reproducibility artifact — Claude Science pattern (2026-06-30)
// ═══════════════════════════════════════════════════════════════
//
// Anthropic's Claude Science launch (2026-06-30) formalized "every AI
// output carries an auditable history of how it was made" as the
// primitive for AI in high-risk scientific domains. Their artifact
// shape: `code + environment + description + full message history`.
//
// Shadow's traceability dict was already shipping source-citation
// separation (BRD vs Addenda vs Risk Appetite vs Regulatory). This
// reproducibility layer extends it to match the Claude Science shape,
// covering the *how-was-this-generated* dimension the source-citation
// layer doesn't (the citation layer says *where the rule came from*;
// this layer says *what the model saw and produced*).
//
// Same reproducibility-first principle Anthropic's Claude Science
// ships for biology, Shadow ships for banking loan origination. The
// IEEE VR 2027 paper §3.4 cites this convergence as evidence that
// auditable-artifacts is becoming the industry-wide trust primitive
// for AI in regulated domains, not a Shadow-only bet.
//
// Contract for downstream (procurement audit / examiner replay):
//   1. `model` — provider + model id + version — pins the LLM
//      identity so future audits can distinguish Sonnet-4-6 vs
//      Sonnet-5 responses on the same loan packet.
//   2. `prompt_sha256` — hash of the exact system prompt that ran.
//      Full prompt not returned by default (may include client-
//      confidential context); hash is enough to prove the same
//      prompt reran deterministically.
//   3. `message_history` — the assistant/user turn sequence that
//      produced the verdict, verbatim. Same pattern Claude Science
//      uses for figure-generation replay.
//   4. `generated_at_utc` — ISO 8601 UTC timestamp. Examiner-
//      grade evidence of when the decision was rendered.
//   5. `env_signature` — Node version + shadow-mentor package
//      version. Pins the runtime environment for full replay.
//   6. `traceability_dict` — the existing source-citation TRACEABILITY
//      constant (Table 1 in the IEEE paper). Preserved for backward
//      compatibility with the /api/deliberate response contract.
//
// Callers should build this via `buildReproducibilityArtifact(...)`
// rather than assembling by hand — that helper enforces the shape
// and is contract-tested. See test/traceability.test.js.

/**
 * Compute SHA-256 of a string, hex-encoded. Uses the platform
 * crypto module (Node built-in). Returns null if crypto is
 * unavailable — traceability should never crash the response.
 */
function sha256Hex(input) {
  try {
    return createHash("sha256").update(input).digest("hex");
  } catch (_err) {
    return null;
  }
}

/**
 * Build the reproducibility artifact returned inline in a
 * /api/deliberate response. Callers should pass what they know;
 * missing fields degrade gracefully rather than throwing, because
 * the source-citation layer is a hard requirement but reproducibility
 * is a polish layer — a partial artifact still ships.
 *
 * @param {Object} opts
 * @param {string} opts.model - "anthropic/claude-sonnet-4-6" or "local/phi4-mini"
 * @param {string} opts.systemPrompt - Full system prompt (hashed, not returned).
 * @param {Array<{role:string, content:string}>} opts.messageHistory - turn sequence
 * @param {string} [opts.generatedAtUtc] - ISO 8601; defaults to now.
 * @param {string} [opts.packageVersion] - shadow-mentor version; defaults to unknown.
 * @param {string} [opts.nodeVersion] - process.version; defaults to detected.
 * @returns {Object} reproducibility artifact — safe to JSON-serialize.
 */
export function buildReproducibilityArtifact({
  model,
  systemPrompt,
  messageHistory,
  generatedAtUtc,
  packageVersion,
  nodeVersion,
} = {}) {
  const promptHash =
    typeof systemPrompt === "string" ? sha256Hex(systemPrompt) : null;
  const detectedNode =
    typeof process !== "undefined" && process.version
      ? process.version
      : "unknown";
  return {
    model: model || "unknown",
    prompt_sha256: promptHash,
    message_history: Array.isArray(messageHistory) ? messageHistory : [],
    generated_at_utc: generatedAtUtc || new Date().toISOString(),
    env_signature: {
      node: nodeVersion || detectedNode,
      shadow_mentor: packageVersion || "unknown",
    },
    traceability_dict: TRACEABILITY,
  };
}
