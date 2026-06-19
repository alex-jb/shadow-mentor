// Contract tests for the shadow_traceability MCP tool added 2026-06-19
// after Loredana C. Levitchi's MIT-license grant + IEEE 2027 co-author
// confirmation. Per the BRD vs Addenda Source Separation Principle,
// procurement audit consumers must be able to query the source attribution
// for any benchmark rule without retrieval — including from Claude
// Desktop / Cursor / Zed via the MCP surface.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { handleToolCall, TOOLS } from "../mcp/server.js";

describe("shadow_traceability MCP tool — declaration", () => {
  it("appears in the TOOLS catalog with correct inputSchema", () => {
    const tool = TOOLS.find((t) => t.name === "shadow_traceability");
    assert.ok(tool, "shadow_traceability tool must be declared");
    assert.equal(tool.inputSchema.type, "object");
    assert.ok(tool.inputSchema.properties.rule);
    assert.ok(tool.inputSchema.properties.include_adverse_action_codes);
  });
});

describe("shadow_traceability MCP tool — full lookup", () => {
  it("returns all rules + governance layers + attribution when no rule specified", () => {
    const r = handleToolCall("shadow_traceability", {});
    assert.ok(r.traceability);
    assert.ok(r.traceability["FICO >= 700"]);
    assert.ok(r.governance_layers);
    assert.ok(r.governance_layers.institutional_risk_framework);
    assert.ok(r.governance_layers.product_line_policy);
    assert.ok(r.governance_layers.benchmark_calibration_parameter);
    assert.ok(r.governance_layers.regulatory);
    assert.ok(r.attribution.includes("Loredana C. Levitchi"));
    assert.ok(r.attribution.includes("MIT"));
    assert.ok(r.source_documents.includes("docs/external/"));
  });

  it("includes adverse-action codes by default", () => {
    const r = handleToolCall("shadow_traceability", {});
    assert.ok(r.adverse_action_codes);
    assert.ok(r.adverse_action_codes.AA01);
    assert.ok(r.adverse_action_codes.AA01.label);
    assert.ok(r.adverse_action_codes.AA01.source);
  });

  it("omits adverse-action codes when include_adverse_action_codes=false", () => {
    const r = handleToolCall("shadow_traceability", { include_adverse_action_codes: false });
    assert.equal(r.adverse_action_codes, undefined);
  });
});

describe("shadow_traceability MCP tool — single-rule lookup", () => {
  it("classifies FICO >= 700 as product-line policy with Addendum A source", () => {
    const r = handleToolCall("shadow_traceability", { rule: "FICO >= 700" });
    assert.ok(r.source.includes("Addendum A"));
    assert.equal(r.governance_layer, "product-line policy");
    assert.ok(r.attribution_note.includes("Loredana C. Levitchi"));
    assert.ok(r.attribution_note.includes("MIT"));
  });

  it("classifies VaR <= 0.12 as benchmark calibration parameter", () => {
    const r = handleToolCall("shadow_traceability", { rule: "VaR <= 0.12" });
    assert.ok(r.source.includes("Risk Appetite Note"));
    assert.equal(r.governance_layer, "benchmark calibration parameter");
  });

  it("classifies VaR/ES Framework as institutional risk framework", () => {
    const r = handleToolCall("shadow_traceability", { rule: "VaR/ES Framework" });
    assert.ok(r.source.startsWith("BRD"));
    assert.equal(r.governance_layer, "institutional risk framework");
  });

  it("classifies SR 11-7 as regulatory", () => {
    const r = handleToolCall("shadow_traceability", { rule: "SR 11-7" });
    assert.equal(r.governance_layer, "regulatory");
  });

  it("returns helpful error on unknown rule (procurement-friendly)", () => {
    const r = handleToolCall("shadow_traceability", { rule: "FICO >= 750" });
    assert.ok(r.error);
    assert.equal(r.requested_rule, "FICO >= 750");
    assert.ok(Array.isArray(r.available_rules));
    assert.ok(r.available_rules.includes("FICO >= 700"));
  });
});
