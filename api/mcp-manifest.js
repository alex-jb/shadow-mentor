// GET /api/mcp-manifest
// v1.5.12 — MCP tool auto-discovery SBOM for bank SIEM + compliance teams.
//
// A bank's SIEM or compliance-oversight team asks: "what MCP tools are in
// my LLM session with Shadow?" This endpoint answers it with a JSON
// manifest listing every tool Shadow's MCP server exposes, its schema
// version, and a SHA-256 hash of the tool descriptor so the bank can
// pin the manifest hash in procurement contracts.
//
// The response is Ed25519-signable via /api/attestation-info + a
// separate signing step in the deploying bank's ops runbook — this
// endpoint returns the raw manifest; the signing pipeline is a
// separate operational concern.
//
// Motivation (2026-07-06 competitor audit): if Comply.ai launches with
// MCP-native compliance and ships a discoverable manifest, Shadow's
// invisible-tool discovery becomes a procurement gap. This endpoint
// closes the gap by publishing the manifest as a first-class artifact.
//
// Cache-safe: 5 minutes. Manifest changes only on version bumps.

import { createHash } from "node:crypto";

const SHADOW_VERSION = "v1.5.15";
const MCP_PROTOCOL_VERSION = "2024-11-05";

// Canonical tool list — must match mcp/server.js TOOLS array.
// If mcp/server.js gains a tool, this list must be updated in the same PR
// (enforced by test/mcp-manifest.test.js contract test).
const CANONICAL_TOOLS = [
  {
    name: "shadow_loan_council",
    description:
      "Run 5-voice loan-origination council on a structured loan dict. Pure compute. Returns final_verdict (block | escalate | approve), voice rationales, risk_packet, applied thresholds.",
    inputSchemaKeys: ["loan"],
    regulatoryScope: [
      "SR 26-2 footnote 3 delegation",
      "ECOA/Reg B (12 CFR 1002)",
      "CFPB Circular 2026-03",
    ],
    determinismClaim: "no-llm-inside-tool",
    latencyPercentiles: { p50_ms: 2, p95_ms: 5 },
  },
  {
    name: "shadow_loan_council_typed",
    description:
      "v1.5.45 dual-envelope variant of shadow_loan_council. Returns human-readable markdown in content[] + typed structured JSON in structuredContent. LLM callers reason from markdown; downstream bank SIEM tooling parses structured payload. Ports ChromeDevTools/chrome-devtools-mcp pattern (Apache-2.0).",
    inputSchemaKeys: ["loan"],
    regulatoryScope: [
      "SR 26-2 footnote 3 delegation",
      "ECOA/Reg B (12 CFR 1002)",
      "CFPB Circular 2026-03",
    ],
    determinismClaim: "no-llm-inside-tool",
    latencyPercentiles: { p50_ms: 3, p95_ms: 6 },
  },
  {
    name: "shadow_risk_tools",
    description:
      "Institutional risk primitives — VaR (historical/parametric/MC), Expected Shortfall, concentration (HHI/Gini), sector exposure, correlation, factor exposures, beta.",
    inputSchemaKeys: ["tool", "params"],
    regulatoryScope: ["BRD Risk Core Specification", "SR 26-2 (GenAI/agentic AI carved out by footnote 3)"],
    determinismClaim: "no-llm-inside-tool",
    latencyPercentiles: { p50_ms: 1, p95_ms: 3 },
  },
  {
    name: "shadow_recall",
    description:
      "Cross-session memory recall for prior council deliberations, keyed by persona + scenario.",
    inputSchemaKeys: ["persona", "scenario"],
    regulatoryScope: ["SR 26-2 audit trail continuity"],
    determinismClaim: "no-llm-inside-tool",
    latencyPercentiles: { p50_ms: 2, p95_ms: 8 },
  },
  {
    name: "shadow_calibration",
    description:
      "Per-persona Brier calibration stats for SR 26-2 (formerly SR 11-7) model risk monitoring.",
    inputSchemaKeys: ["persona"],
    regulatoryScope: ["SR 26-2 Model Risk Management"],
    determinismClaim: "no-llm-inside-tool",
    latencyPercentiles: { p50_ms: 1, p95_ms: 4 },
  },
  {
    name: "shadow_scenarios",
    description:
      "Surface enumeration — 6 personas × 4 scenarios × 4 device clients × 3 providers.",
    inputSchemaKeys: [],
    regulatoryScope: [],
    determinismClaim: "no-llm-inside-tool",
    latencyPercentiles: { p50_ms: 1, p95_ms: 2 },
  },
  {
    name: "shadow_traceability",
    description:
      "Source attribution for any benchmark rule (BRD vs Addendum vs Risk Appetite Note) with governance-layer classification.",
    inputSchemaKeys: ["rule"],
    regulatoryScope: [
      "CFPB Circular 2026-03",
      "ECOA/Reg B",
      "SR 26-2",
      "GDPR Art. 22",
      "Schufa C-634/21",
    ],
    determinismClaim: "no-llm-inside-tool",
    latencyPercentiles: { p50_ms: 1, p95_ms: 2 },
  },
  {
    name: "shadow_verify_attestation",
    description:
      "Verify an Ed25519 attestation record (RFC 8032) inline from Claude Desktop / Cursor without shelling to the CLI. Returns {ok, reason, checks}.",
    inputSchemaKeys: ["attestation", "originalRequest", "originalResponse"],
    regulatoryScope: ["SR 26-2 tamper-evident audit chain"],
    determinismClaim: "no-llm-inside-tool",
    latencyPercentiles: { p50_ms: 2, p95_ms: 6 },
  },
  {
    name: "shadow_size_position",
    description:
      "Cross-vertical Trader Pack Risk Sizer voice (FinPos arXiv 2510.27251). Takes upstream Judge direction + Kelly params + volatility regime + optional drawdown. Returns fund/skip verdict + position_usd + Kelly notional + volatility scalar. Never emits a direction — Judge owns direction, Sizer only sizes.",
    inputSchemaKeys: [
      "direction",
      "bankroll_usd",
      "volatility_regime",
      "kelly_p_win",
      "kelly_avg_win_pct",
      "kelly_avg_loss_pct",
    ],
    regulatoryScope: [
      "FinPos dual-agent architecture",
      "Kelly-cap discipline",
    ],
    determinismClaim: "no-llm-inside-tool",
    latencyPercentiles: { p50_ms: 1, p95_ms: 3 },
  },
];

function computeToolHash(tool) {
  // Canonicalize (sorted keys) before hashing so hash is stable across
  // JSON serializers.
  const canonical = JSON.stringify(tool, Object.keys(tool).sort());
  return createHash("sha256").update(canonical, "utf-8").digest("hex");
}

function computeManifestHash(manifest) {
  const canonical = JSON.stringify({
    shadow_version: manifest.shadow_version,
    mcp_protocol_version: manifest.mcp_protocol_version,
    tool_count: manifest.tool_count,
    tools: manifest.tools.map((t) => ({ name: t.name, hash: t.hash_sha256 })),
  });
  return createHash("sha256").update(canonical, "utf-8").digest("hex");
}

export function buildManifest() {
  const toolsWithHashes = CANONICAL_TOOLS.map((tool) => ({
    ...tool,
    hash_sha256: computeToolHash(tool),
  }));

  const manifestBody = {
    shadow_version: SHADOW_VERSION,
    mcp_protocol_version: MCP_PROTOCOL_VERSION,
    tool_count: toolsWithHashes.length,
    tools: toolsWithHashes,
    generated_at_utc: new Date().toISOString(),
    signing_pipeline_reference:
      "See /api/attestation-info for the Ed25519 public key + fingerprint used to sign this manifest in the deploying bank's ops runbook.",
    procurement_note:
      "Bank counsel can pin manifest_hash_sha256 in the procurement contract to detect silent tool-set changes across Shadow version bumps.",
  };

  const manifest_hash_sha256 = computeManifestHash(manifestBody);
  return { ...manifestBody, manifest_hash_sha256 };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "GET only" });
    return;
  }

  res.status(200).json(buildManifest());
}
