#!/usr/bin/env node
// Shadow MCP server — exposes Shadow's persona-pack deliberation + loan
// council + calibration stats to any MCP-capable host (Claude Desktop,
// Cursor, Zed, OpenCode, etc).
//
// Mirrors the pattern used by Solo Founder OS's 11 agents: every domain
// surface becomes an MCP tool so the LLM client can dispatch it via
// natural language without curling our Vercel endpoints by hand.
//
// Run as a child process from claude_desktop_config.json. See ./README.md
// for installation instructions.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

import { runLoanCouncil } from "../lib/run-loan-council.js";
import { validateLoan, LOAN_DEFAULTS } from "../lib/schemas/loan.js";
import { memorySingleton } from "../lib/memory.js";
import {
  historical_var,
  expected_shortfall,
  concentration_limits,
  sector_exposure,
  correlation_matrix,
  beta_decomposition
} from "../lib/risk-tools/index.js";
import { sizePosition } from "../lib/personas/trader-pack/risk-sizer.js";
import { PERSONA_PROMPTS, SCENARIO_CONTEXTS } from "../lib/prompts.js";
import { TRACEABILITY } from "../lib/traceability.js";
import { ADVERSE_ACTION_CODES, AA_SOURCES } from "../lib/schemas/adverse-action.js";
import { verifyAttestation, SIGNATURE_MODES } from "../lib/attestation.js";
import { verifyBundle } from "../packages/attest-core/session.js";
import { checkBankingProfileV1 } from "../lib/enforce-banking-profile.js";
import { buildExaminerPacket, renderPacketMarkdown } from "../lib/evidence-packet.js";
import { adverseImpactRatio, standardizedMeanDifference, segmentedAIR } from "../lib/disparity/index.js";
import { createResponse, isEnvelope } from "./response.js";

const TOOLS = [
  {
    name: "shadow_loan_council",
    description: "Run Loredana Levitchi's 5-voice loan-origination council on a structured loan dict. Pure compute, no LLM call, ~1-5ms latency. Returns final_verdict (block | escalate | approve), the 5 voice rationales, the risk_packet (VaR / ES / concentration / sector exposure), and the BR thresholds applied. Best when the user wants a deterministic risk verdict that's auditable under ECOA/Reg B specific-principal-reason requirements.",
    inputSchema: {
      type: "object",
      properties: {
        loan: {
          type: "object",
          description: "Loan dict. Required: credit_score (300..850), debt_to_income (0..2), loan_to_value (0..2), amount (>0). Optional: borrower_rating, sector, fair_lending_review_flag, adverse_action_reasons, market_proxy_prices, collateral_positions, borrower_exposure_weights."
        }
      },
      required: ["loan"]
    }
  },
  {
    name: "shadow_loan_council_typed",
    description: "v1.5.45: Dual-envelope variant of shadow_loan_council. Returns human-readable markdown in content[] AND typed structured JSON in structuredContent. LLM callers reason from the markdown; downstream bank SIEM tooling parses the structured payload without re-parsing a stringified body. Same inputs as shadow_loan_council. Ports the ChromeDevTools/chrome-devtools-mcp response pattern (Apache-2.0, Google LLC).",
    inputSchema: {
      type: "object",
      properties: {
        loan: {
          type: "object",
          description: "Loan dict. Same fields as shadow_loan_council. See there for details."
        }
      },
      required: ["loan"]
    }
  },
  {
    name: "shadow_risk_tools",
    description: "Run one of Loredana's typed institutional risk primitives directly: historical_var, expected_shortfall, concentration_limits, sector_exposure, correlation_matrix, beta_decomposition. Returns the metric. Use this when you need to compute a single risk number without running the full loan council.",
    inputSchema: {
      type: "object",
      properties: {
        tool: {
          type: "string",
          enum: ["historical_var", "expected_shortfall", "concentration_limits", "sector_exposure", "correlation_matrix", "beta_decomposition"]
        },
        args: {
          type: "object",
          description: "Tool-specific arguments. See lib/risk-tools/index.js RISK_TOOL_DEFINITIONS for input schemas."
        }
      },
      required: ["tool", "args"]
    }
  },
  {
    name: "shadow_recall",
    description: "Recall past Shadow deliberation entries for a given persona + scenario from cross-session memory. Returns up to max_results entries (default 5) with their voice paragraphs, outcomes, and Brier scores. Use this when a user wants to see what the council said previously for similar questions.",
    inputSchema: {
      type: "object",
      properties: {
        persona: { type: "string", enum: ["compliance", "quant", "engineer", "trader", "advisor"] },
        scenario: { type: "string", enum: ["lbo", "bloomberg", "cds", "policy"] },
        max_results: { type: "integer", default: 5 }
      }
    }
  },
  {
    name: "shadow_calibration",
    description: "Get Brier calibration stats for a given persona (or all personas if omitted). Returns n, mean_brier (0 = perfect, 0.25 = unhelpful baseline, 1 = perfectly wrong), and the distribution of past outcomes (approved / blocked / escalated). Use this when a user asks how well-calibrated a persona has been historically — useful for SR 11-7 model risk monitoring.",
    inputSchema: {
      type: "object",
      properties: {
        persona: { type: "string", enum: ["compliance", "quant", "engineer", "trader", "advisor"] }
      }
    }
  },
  {
    name: "shadow_scenarios",
    description: "List Shadow's full surface: 5 persona packs (each with 3 voice prompts), 4 scenario contexts, 4 device clients (Desktop / Even G2 / Brilliant Frame / XReal Air 2 Ultra), and 2 providers (Anthropic Claude + Zhipu GLM-5.2). Returns the catalog for discovery.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "shadow_traceability",
    description: "Look up the source attribution for any Shadow Mode A benchmark rule. Returns the governance layer (institutional risk framework / product-line policy / benchmark calibration parameter / regulatory) and the authoritative source document. Use this when a user wants to verify procurement-audit citation chain — e.g. \"what justifies FICO >= 700\" or \"is VaR <= 0.12 from the BRD?\" Returns the full traceability dict if no specific rule is requested, plus the 5 AA01-05 adverse-action codes with their source attribution.",
    inputSchema: {
      type: "object",
      properties: {
        rule: {
          type: "string",
          description: "Optional. Specific benchmark rule to look up (e.g. 'FICO >= 700', 'DTI <= 0.36', 'LTV <= 0.80', 'VaR <= 0.12', 'VaR/ES Framework', '10-Day Horizon', 'Confidence 95%', 'Analysis Only', 'ECOA / Reg B', 'SR 11-7'). Omit to return all rules."
        },
        include_adverse_action_codes: {
          type: "boolean",
          default: true,
          description: "Include the AA01-05 adverse-action code mappings in the response."
        }
      }
    }
  },
  {
    name: "shadow_verify_attestation",
    description: "Verify a Shadow AEX-style attestation on a persisted /api/deliberate or /api/loan-council response. Confirms (1) the request wasn't tampered, (2) the response wasn't tampered, (3) the exact model_id ran, (4) the deployment key material matches. Bank-auditor path — pass the persisted request + response body (attestation field stripped) + the attestation object + the verification key material (HMAC signing key OR Ed25519 public key). Returns {ok, reason, checks}. Ok=false means the record is tampered, silently model-swapped, or a different key was used. Ed25519 mode is the procurement-recommended mode: bank holds only the public half of the keypair, cannot forge, only verify.",
    inputSchema: {
      type: "object",
      properties: {
        attestation: {
          type: "object",
          description: "The signed attestation object (from response.attestation). Must include version, mode, request_commitment, output_commitment, model_id, completed_at_utc, key_id, signature."
        },
        original_request: {
          type: "object",
          description: "The exact request body Shadow was called with — the loan/policy dict passed to /api/loan-council or /api/deliberate."
        },
        original_response: {
          type: "object",
          description: "The exact response body Shadow returned — with the attestation field REMOVED (else you'd be hashing the attestation into itself)."
        },
        public_key: {
          type: "string",
          description: "Ed25519 public key (PEM string OR base64-encoded raw 32-byte). Required if attestation.mode is 'ed25519'. Falls back to the SHADOW_ATTESTATION_ED25519_PUBLIC_KEY deployment variable if omitted."
        },
        hmac_key: {
          type: "string",
          description: "HMAC-SHA-256 signing key material. Required if attestation.mode is 'hmac-sha256'. Falls back to the SHADOW_ATTESTATION_SECRET deployment variable if omitted."
        }
      },
      required: ["attestation", "original_request", "original_response"]
    }
  },
  {
    name: "shadow_banking_profile",
    description: "Check a Shadow evidence bundle against the Banking Evidence Profile v1 (spec/banking-evidence-profile-v1.json) and, optionally, produce an examiner-ready evidence packet. This is the 'is this credit decision auditable?' pass/fail gate no published standard owns: it confirms the bundle carries the examiner-required evidence for a US credit decision (integrity, decision outcome, model/tool manifest, policy version, timestamps, data-as-of, human review, principal reason codes, a GOVERNED reason-code dictionary version, source citations, retention status), each mapped to its Reg B / FCRA / SR 26-2 hook, with a swapped/ungoverned reason-code dictionary FAILING the gate. Bank-analyst path — run it from Cursor/Claude Desktop on a persisted bundle. Pass the bundle; pass public_key to verify integrity (SELF_SIGNED without it); pass payloads to enable value-level checks (reason-code count, adverse detection). Returns the conformance report {pass, coverage_pct, adverse, fields[], missing_required} plus, if packet=true, an examiner-ready markdown packet. Structural PASS means the evidence exists and is tamper-evident — it does NOT certify the decision was correct/fair/compliant.",
    inputSchema: {
      type: "object",
      properties: {
        bundle: { type: "object", description: "The Shadow evidence bundle (header, events, batch_root, signatures) for one credit decision." },
        public_key: { type: "string", description: "Ed25519 public key (PEM). If provided, integrity is verified; otherwise the integrity field is reported 'unknown'." },
        payloads: { type: "object", description: "Optional map {seq|payload_ref -> payload} enabling value-level checks (principal reason-code count, adverse-decision detection)." },
        packet: { type: "boolean", description: "If true, also return an examiner-ready markdown evidence packet." }
      },
      required: ["bundle"]
    }
  },
  {
    name: "shadow_size_position",
    description: "Size a trading position via the Shadow Trader Pack Risk Sizer voice (FinPos, arXiv 2510.27251). Takes a proposed direction from an upstream Judge (or the caller directly) + Kelly parameters + volatility regime + optional drawdown. Returns fund/skip verdict + position_usd + Kelly notional + volatility scalar + human-readable rationale. Never returns a direction — Judge owns direction, Sizer only decides SIZE. Pure computation (no LLM). Cross-vertical wire format identical to Orallexa's Python engine/risk_sizer.py so banking + trading audit trails share one schema. Use when: (1) you have a trade thesis and need principled sizing, (2) you want to audit whether a proposed position respects Kelly cap + volatility discipline + drawdown adjustment.",
    inputSchema: {
      type: "object",
      properties: {
        direction: {
          type: "string",
          enum: ["long", "short", "no_op"],
          description: "The trade direction from the upstream Judge. no_op → Sizer returns skip immediately."
        },
        directional_confidence: {
          type: "number",
          description: "Judge's confidence in the direction (0.0-1.0). Currently metadata-only; v0.3 will use it to shrink positions under low confidence."
        },
        bankroll_usd: {
          type: "number",
          description: "Total account bankroll in USD. Position is capped at this and at (max_kelly_cap × bankroll_usd)."
        },
        volatility_regime: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Volatility regime scalar: low=1.0, medium=0.7, high=0.4. Position scales inversely with vol."
        },
        kelly_p_win: {
          type: "number",
          description: "Historical win rate for the strategy (0.0-1.0)."
        },
        kelly_avg_win_pct: {
          type: "number",
          description: "Average winning trade return as a fraction (e.g. 0.04 = 4% avg win)."
        },
        kelly_avg_loss_pct: {
          type: "number",
          description: "Average losing trade return as a fraction (e.g. 0.02 = 2% avg loss)."
        },
        current_drawdown_pct: {
          type: "number",
          description: "Current portfolio drawdown as a fraction OR percent (values ≤ 1.0 treated as fraction, > 1.0 as percent). Default 0."
        },
        max_kelly_cap: {
          type: "number",
          description: "Max fraction of bankroll to risk on a single trade. Default 0.25."
        }
      },
      required: [
        "direction",
        "bankroll_usd",
        "volatility_regime",
        "kelly_p_win",
        "kelly_avg_win_pct",
        "kelly_avg_loss_pct"
      ]
    }
  },
  {
    name: "shadow_disparity",
    description: "Fair-Lending disparity math for AI-assisted credit decisions. Implements SolasAI methodology (github.com/SolasAI/solas-ai-disparity, Apache-2.0) natively in Node with zero Python dependency. Computes: (1) Adverse Impact Ratio (AIR) per EEOC UGSEP 1978 §1607.4(D) four-fifths rule, (2) Standardized Mean Difference (SMD) for continuous outcomes like approved credit limit, (3) Segmented AIR sliced by a control variable (e.g. FICO bucket) to surface per-slice violations that aggregate metrics mask. Use when: a Fair-Lending examiner asks whether a Shadow-council-approved decision batch shows disparate impact against a protected class. Pure computation, no LLM. Cite as Shadow's Fair-Lending disparity primitive layered on the same council output the other 9 tools consume.",
    inputSchema: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["air", "smd", "segmented_air"],
          description: "Which disparity statistic to compute."
        },
        protected_outcomes: {
          type: "array",
          items: { type: "number" },
          description: "For 'air': binary outcomes (0|1) for the protected class. For 'smd': continuous values (e.g. approved limits)."
        },
        reference_outcomes: {
          type: "array",
          items: { type: "number" },
          description: "Same shape as protected_outcomes, for the reference class."
        },
        rows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              outcome: { type: "number", description: "0 or 1 (approved)" },
              is_protected: { type: "boolean" },
              segment: { type: "string", description: "Control variable value, e.g. 'fico_620_699'" }
            },
            required: ["outcome", "is_protected", "segment"]
          },
          description: "Only used when mode = 'segmented_air'. Rows to bucket by segment."
        }
      },
      required: ["mode"]
    }
  }
];

function dispatchRiskTool(tool, args) {
  switch (tool) {
    case "historical_var":
      return historical_var(args.prices, args.confidence, args.horizon_days);
    case "expected_shortfall":
      return expected_shortfall(args.prices, args.confidence, args.horizon_days);
    case "concentration_limits":
      return concentration_limits(args.weights, args.max_single);
    case "sector_exposure":
      return sector_exposure(args.positions);
    case "correlation_matrix":
      return correlation_matrix(args.return_series);
    case "beta_decomposition":
      return beta_decomposition(args.asset_returns, args.market_returns);
    default:
      throw new Error(`unknown risk tool: ${tool}`);
  }
}

export function handleToolCall(name, args) {
  if (name === "shadow_loan_council") {
    const v = validateLoan(args.loan);
    if (!v.valid) return { error: "invalid loan", validation_errors: v.errors };
    return runLoanCouncil(args.loan);
  }

  // v1.5.45: dual-envelope variant. Same compute as shadow_loan_council;
  // response wrapped with createResponse() so LLM caller gets legible
  // markdown AND downstream automation gets typed structuredContent.
  if (name === "shadow_loan_council_typed") {
    const v = validateLoan(args.loan);
    if (!v.valid) {
      return createResponse()
        .setError("invalid loan", { validation_errors: v.errors })
        .build();
    }
    const council = runLoanCouncil(args.loan);
    const verdictSummary = council.final_verdict === "approve"
      ? `APPROVE — all ${council.voices.length} personas cleared their approve gates.`
      : council.final_verdict === "block"
      ? `BLOCK — hard-block gate fired (see voice rationales below).`
      : `ESCALATE — human review required.`;
    const builder = createResponse().appendLine(verdictSummary).appendLine("");
    for (const voice of council.voices) {
      const marker =
        voice.verdict === "approve" ? "OK " :
        voice.verdict === "block" ? "X  " :
        "!  ";
      builder.appendLine(`${marker}${voice.voice} — ${voice.verdict}`);
    }
    if (council.adverse_action_codes && council.adverse_action_codes.length > 0) {
      builder.appendLine("");
      builder.appendLine("Adverse-action codes (CFPB Circular 2026-03):");
      for (const c of council.adverse_action_codes) {
        builder.appendLine(`  ${c.code} — ${c.label}`);
      }
    }
    return builder.setStructured(council).build();
  }

  if (name === "shadow_risk_tools") {
    const result = dispatchRiskTool(args.tool, args.args ?? {});
    return { tool: args.tool, result };
  }

  if (name === "shadow_recall") {
    const entries = memorySingleton.recall({
      persona: args.persona,
      scenario: args.scenario,
      max_results: args.max_results ?? 5
    });
    const stats = args.persona ? memorySingleton.recallCalibrationStats({ persona: args.persona }) : null;
    return { entries, calibration_stats: stats };
  }

  if (name === "shadow_calibration") {
    if (args.persona) {
      const stats = memorySingleton.recallCalibrationStats({ persona: args.persona });
      return stats
        ? { persona: args.persona, ...stats, brier_interpretation: "0 = perfect, 0.25 = baseline, 1 = perfectly wrong" }
        : { persona: args.persona, n: 0, mean_brier: null, note: "no entries" };
    }
    const all = {};
    for (const p of ["compliance", "quant", "engineer", "trader", "advisor"]) {
      all[p] = memorySingleton.recallCalibrationStats({ persona: p });
    }
    return { personas: all };
  }

  if (name === "shadow_traceability") {
    const include_aa = args.include_adverse_action_codes !== false;
    const aa_codes = include_aa
      ? Object.fromEntries(
          Object.keys(ADVERSE_ACTION_CODES).map((code) => [
            code,
            { label: ADVERSE_ACTION_CODES[code], source: AA_SOURCES[code] }
          ])
        )
      : undefined;

    if (args.rule) {
      const source = TRACEABILITY[args.rule];
      if (!source) {
        return {
          error: "rule not found in traceability dict",
          requested_rule: args.rule,
          available_rules: Object.keys(TRACEABILITY)
        };
      }
      // Classify the governance layer from the source string
      const layer =
        source.startsWith("BRD") ? "institutional risk framework" :
        source.startsWith("Addendum") && source.includes("Risk Appetite Note") ? "benchmark calibration parameter" :
        source.startsWith("Addendum") ? "product-line policy" :
        source.startsWith("CFPB") || source.startsWith("Federal Reserve") ? "regulatory" :
        "unclassified";
      return {
        rule: args.rule,
        source,
        governance_layer: layer,
        attribution_note: "Authored by Loredana C. Levitchi; MIT-licensed merge into shadow-mentor per 2026-06-19 grant.",
        ...(aa_codes ? { adverse_action_codes: aa_codes } : {})
      };
    }
    return {
      traceability: TRACEABILITY,
      governance_layers: {
        institutional_risk_framework: "BRD — board-approved, version-controlled, rarely changes",
        product_line_policy: "Addenda A/B/C — product-team owned, quarterly revisable",
        benchmark_calibration_parameter: "Addendum C Risk Appetite Note — model-team owned, validation-cycle revisable",
        regulatory: "CFPB / ECOA / Reg B / SR 11-7 / EU AI Act Article 14 — external"
      },
      attribution: "Primary author of risk, credit-policy, threshold, adverse-action, and traceability modules: Loredana C. Levitchi. Integration maintainer: Alex Xiaoyu Ji. License: MIT (per 2026-06-19 explicit grant).",
      source_documents: "docs/external/ — BRD_ALIGNMENT, ADDENDUM_A/B/C, TRACEABILITY_MATRIX, IMPLEMENTATION_GUIDE, TECHNICAL_REPORT",
      ...(aa_codes ? { adverse_action_codes: aa_codes } : {})
    };
  }

  if (name === "shadow_verify_attestation") {
    const { attestation, original_request, original_response, public_key, hmac_key, secret } = args;
    if (!attestation) return { error: "attestation required" };
    if (!original_request) return { error: "original_request required" };
    if (!original_response) return { error: "original_response required" };
    const keys = {};
    if (public_key) keys.publicKey = public_key;
    // Accept both `hmac_key` (new schema name) + `secret` (legacy alias for
    // callers that already speak the lib/attestation.js verifier vocabulary).
    const hmacMaterial = hmac_key ?? secret;
    if (hmacMaterial) keys.secret = hmacMaterial;
    const result = verifyAttestation(attestation, original_request, original_response, keys);
    return {
      ...result,
      mode: attestation.mode ?? SIGNATURE_MODES.HMAC,
      model_id: attestation.model_id,
      completed_at_utc: attestation.completed_at_utc,
      key_id: attestation.key_id,
      interpretation: result.ok
        ? "Attestation verified. Request + response were not tampered, the pinned model ran, and the deployment key matches."
        : "Attestation FAILED verification. Do NOT trust this record — it may have been tampered, silently model-swapped, or signed with a different key."
    };
  }

  if (name === "shadow_banking_profile") {
    const { bundle, public_key, payloads, packet } = args;
    if (!bundle || typeof bundle !== "object") return { error: "bundle required" };
    const verified = public_key ? verifyBundle(bundle, { publicKey: public_key }) : null;
    const conformance = checkBankingProfileV1(bundle, { verified, payloads: payloads ?? null });
    const out = {
      conformance,
      interpretation: conformance.pass
        ? `Conforms to ${conformance.profile} (${conformance.coverage_pct}% of evidence slots present): the examiner-required evidence is present and tamper-evident. This does NOT certify the decision was correct, fair, or compliant.`
        : `NON-CONFORMANT to ${conformance.profile}: missing required evidence — ${conformance.missing_required.join(", ") || "none"}.`
    };
    if (packet) out.examiner_packet_markdown = renderPacketMarkdown(buildExaminerPacket(bundle, { verified, payloads: payloads ?? null }));
    return out;
  }

  if (name === "shadow_disparity") {
    if (args.mode === "air") {
      if (!args.protected_outcomes || !args.reference_outcomes) {
        return { error: "shadow_disparity mode=air requires protected_outcomes and reference_outcomes" };
      }
      try {
        return {
          mode: "air",
          methodology: "SolasAI-aligned (github.com/SolasAI/solas-ai-disparity, Apache-2.0), Node port",
          regulatory_anchor: "EEOC UGSEP 1978 §1607.4(D) four-fifths rule",
          ...adverseImpactRatio(args.protected_outcomes, args.reference_outcomes),
        };
      } catch (err) {
        return { error: err.message };
      }
    }
    if (args.mode === "smd") {
      if (!args.protected_outcomes || !args.reference_outcomes) {
        return { error: "shadow_disparity mode=smd requires protected_outcomes and reference_outcomes" };
      }
      try {
        return {
          mode: "smd",
          methodology: "SolasAI-aligned Node port; Cohen's d style",
          ...standardizedMeanDifference(args.protected_outcomes, args.reference_outcomes),
        };
      } catch (err) {
        return { error: err.message };
      }
    }
    if (args.mode === "segmented_air") {
      if (!Array.isArray(args.rows)) {
        return { error: "shadow_disparity mode=segmented_air requires rows array" };
      }
      return {
        mode: "segmented_air",
        methodology: "SolasAI-aligned Node port; surfaces per-segment violations hidden by aggregate AIR",
        segments: segmentedAIR(args.rows),
      };
    }
    return { error: `unknown shadow_disparity mode: ${args.mode}` };
  }

  if (name === "shadow_scenarios") {
    return {
      service: "shadow-mentor",
      rubric_version: "0.3.3",
      personas: Object.keys(PERSONA_PROMPTS).map((id) => ({ id, voices: Object.keys(PERSONA_PROMPTS[id]) })),
      scenarios: Object.entries(SCENARIO_CONTEXTS).map(([id, ctx]) => ({ id, short_context: ctx.slice(0, 120) })),
      devices: [
        { id: "desktop", label: "Desktop overlay" },
        { id: "g2", label: "Even G2 (no camera)" },
        { id: "frame", label: "Brilliant Frame (open SDK)" },
        { id: "xreal", label: "XReal Air 2 Ultra (spatial AR)" }
      ],
      providers: ["anthropic", "glm"],
      defaults: LOAN_DEFAULTS,
      cells_total: Object.keys(PERSONA_PROMPTS).length * Object.keys(SCENARIO_CONTEXTS).length
    };
  }

  if (name === "shadow_size_position") {
    try {
      return sizePosition(args);
    } catch (err) {
      return { error: `Risk Sizer input invalid: ${err.message}` };
    }
  }

  throw new Error(`unknown tool: ${name}`);
}

async function main() {
  const server = new Server(
    { name: "shadow-mentor", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const result = handleToolCall(name, args);
      // v1.5.45: tools may opt-in to the dual-envelope pattern by
      // returning a value built with createResponse(). The dispatch
      // handler recognizes those and emits them directly; legacy
      // plain-object returns get wrapped as before. See mcp/response.js.
      if (isEnvelope(result)) {
        const { [Symbol.for("shadow.mcp.response.v1")]: _marker, ...envelope } = result;
        return envelope;
      }
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: err?.message ?? String(err) }) }],
        isError: true
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Only auto-run when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { TOOLS };
