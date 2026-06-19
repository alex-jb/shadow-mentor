// Contract tests for the MCP server tool dispatch. We don't spin up the
// real stdio transport — we exercise handleToolCall directly so the test
// runs in standard Node test framework, no subprocess.

import { test } from "node:test";
import assert from "node:assert/strict";
import { handleToolCall, TOOLS } from "../mcp/server.js";

test("MCP server exposes 6 tools (v1.1.1+ adds shadow_traceability)", () => {
  assert.equal(TOOLS.length, 6);
  const names = TOOLS.map((t) => t.name);
  for (const expected of [
    "shadow_loan_council",
    "shadow_risk_tools",
    "shadow_recall",
    "shadow_calibration",
    "shadow_scenarios",
    "shadow_traceability"
  ]) {
    assert.ok(names.includes(expected), `missing tool ${expected}`);
  }
});

test("Every tool has name + description + inputSchema", () => {
  for (const t of TOOLS) {
    assert.ok(t.name, "tool needs name");
    assert.ok(t.description, "tool needs description");
    assert.ok(t.inputSchema, "tool needs inputSchema");
    assert.equal(t.inputSchema.type, "object");
  }
});

test("shadow_loan_council on clean loan returns approve", () => {
  const r = handleToolCall("shadow_loan_council", {
    loan: {
      credit_score: 740,
      debt_to_income: 0.28,
      loan_to_value: 0.65,
      amount: 250000,
      sector: "industrials",
      fair_lending_review_flag: false,
      market_proxy_prices: [100, 101, 99, 102, 100, 101, 99, 100, 101, 100, 99]
    }
  });
  assert.equal(r.final_verdict, "approve");
  assert.equal(r.voices.length, 5);
});

test("shadow_loan_council on invalid loan returns validation_errors", () => {
  const r = handleToolCall("shadow_loan_council", {
    loan: { credit_score: 100, debt_to_income: 0.3, loan_to_value: 0.5, amount: -1 }
  });
  assert.ok(r.error);
  assert.ok(Array.isArray(r.validation_errors));
});

test("shadow_risk_tools dispatches historical_var", () => {
  const r = handleToolCall("shadow_risk_tools", {
    tool: "historical_var",
    args: { prices: [100, 99, 101, 98, 97, 100, 96, 95, 99, 94, 93], confidence: 0.95, horizon_days: 10 }
  });
  assert.equal(r.tool, "historical_var");
  assert.ok(typeof r.result === "number" && r.result >= 0);
});

test("shadow_risk_tools dispatches concentration_limits", () => {
  const r = handleToolCall("shadow_risk_tools", {
    tool: "concentration_limits",
    args: { weights: { a: 0.5, b: 0.3, c: 0.2 }, max_single: 0.40 }
  });
  assert.equal(r.result.passes, false);
  assert.equal(r.result.breaches.length, 1);
});

test("shadow_risk_tools rejects unknown tool", () => {
  assert.throws(() => handleToolCall("shadow_risk_tools", { tool: "rocket_science", args: {} }));
});

test("shadow_recall returns entries + calibration_stats for persona", () => {
  const r = handleToolCall("shadow_recall", { persona: "compliance", scenario: "lbo", max_results: 3 });
  assert.ok(Array.isArray(r.entries));
  assert.ok(r.entries.length <= 3);
  assert.ok(r.calibration_stats);
});

test("shadow_calibration for known persona returns stats", () => {
  const r = handleToolCall("shadow_calibration", { persona: "compliance" });
  assert.equal(r.persona, "compliance");
  assert.ok(typeof r.n === "number" && r.n > 0);
  assert.ok(typeof r.mean_brier === "number");
});

test("shadow_calibration without persona returns all-persona snapshot", () => {
  const r = handleToolCall("shadow_calibration", {});
  assert.ok(r.personas);
  assert.ok("compliance" in r.personas);
  assert.ok("trader" in r.personas);
});

test("shadow_scenarios returns full surface catalog", () => {
  const r = handleToolCall("shadow_scenarios", {});
  assert.equal(r.service, "shadow-mentor");
  assert.equal(r.personas.length, 5);
  assert.equal(r.scenarios.length, 4);
  assert.equal(r.devices.length, 4);
  assert.equal(r.cells_total, 20);
  assert.ok(r.defaults.fico_approve_floor === 700);
});

test("unknown tool name throws", () => {
  assert.throws(() => handleToolCall("shadow_lol", {}));
});
