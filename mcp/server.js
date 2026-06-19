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
import { PERSONA_PROMPTS, SCENARIO_CONTEXTS } from "../lib/prompts.js";
import { TRACEABILITY } from "../lib/traceability.js";
import { ADVERSE_ACTION_CODES, AA_SOURCES } from "../lib/schemas/adverse-action.js";

const TOOLS = [
  {
    name: "shadow_loan_council",
    description: "Run Loredana Levitchi's 5-voice loan-origination council on a structured loan dict. Pure compute, no LLM call, ~1-5ms latency. Returns final_verdict (block | escalate | approve), the 5 voice rationales, the risk_packet (VaR / ES / concentration / sector exposure), and the BR thresholds applied. Best when the user wants a deterministic risk verdict that's auditable for SR 11-7 / ECOA / Reg B.",
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
