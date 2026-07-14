// Contract tests for the MCP server tool dispatch. We don't spin up the
// real stdio transport — we exercise handleToolCall directly so the test
// runs in standard Node test framework, no subprocess.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { handleToolCall, TOOLS } from "../mcp/server.js";
import { buildAttestation, SIGNATURE_MODES } from "../lib/attestation.js";

test("MCP server exposes 9 tools (v1.5.45+ adds shadow_loan_council_typed)", () => {
  assert.equal(TOOLS.length, 10);
  const names = TOOLS.map((t) => t.name);
  for (const expected of [
    "shadow_loan_council",
    "shadow_loan_council_typed",
    "shadow_risk_tools",
    "shadow_recall",
    "shadow_calibration",
    "shadow_scenarios",
    "shadow_traceability",
    "shadow_verify_attestation",
    "shadow_size_position"
  ]) {
    assert.ok(names.includes(expected), `missing tool ${expected}`);
  }
});

test("shadow_size_position: valid input returns Risk Sizer verdict", () => {
  const r = handleToolCall("shadow_size_position", {
    direction: "long",
    directional_confidence: 0.72,
    bankroll_usd: 10000,
    volatility_regime: "medium",
    kelly_p_win: 0.55,
    kelly_avg_win_pct: 0.04,
    kelly_avg_loss_pct: 0.02,
  });
  assert.equal(r.voice, "Risk Sizer");
  assert.ok(["fund", "skip"].includes(r.verdict));
  // The tool NEVER exposes a direction (Judge owns direction).
  assert.equal(r.direction, undefined);
});

test("shadow_size_position: no_op direction → skip", () => {
  const r = handleToolCall("shadow_size_position", {
    direction: "no_op",
    bankroll_usd: 10000,
    volatility_regime: "medium",
    kelly_p_win: 0.55,
    kelly_avg_win_pct: 0.04,
    kelly_avg_loss_pct: 0.02,
  });
  assert.equal(r.verdict, "skip");
  assert.equal(r.position_usd, null);
});

test("shadow_size_position: negative-Kelly params skip cleanly", () => {
  const r = handleToolCall("shadow_size_position", {
    direction: "long",
    bankroll_usd: 10000,
    volatility_regime: "medium",
    kelly_p_win: 0.30,
    kelly_avg_win_pct: 0.02,
    kelly_avg_loss_pct: 0.02,
  });
  assert.equal(r.verdict, "skip");
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

// ─── shadow_verify_attestation ─────────────────────────────────────

test("shadow_verify_attestation verifies a good HMAC-signed record", () => {
  const request = { loan_id: "MCP-TEST-001", credit_score: 720 };
  const response = { verdict: "approve", voices: [] };
  const secret = "mcp-test-secret";
  const att = buildAttestation({
    request, response, modelId: "sonnet",
    mode: SIGNATURE_MODES.HMAC, secret,
  });
  const r = handleToolCall("shadow_verify_attestation", {
    attestation: att,
    original_request: request,
    original_response: response,
    secret,
  });
  assert.equal(r.ok, true);
  assert.equal(r.mode, SIGNATURE_MODES.HMAC);
  assert.equal(r.model_id, "sonnet");
  assert.match(r.interpretation, /verified/);
});

test("shadow_verify_attestation detects a tampered response", () => {
  const request = { loan_id: "MCP-TEST-002", credit_score: 640 };
  const response = { verdict: "block" };
  const secret = "mcp-test-secret";
  const att = buildAttestation({
    request, response, modelId: "sonnet",
    mode: SIGNATURE_MODES.HMAC, secret,
  });
  const tampered = { ...response, verdict: "approve" };
  const r = handleToolCall("shadow_verify_attestation", {
    attestation: att,
    original_request: request,
    original_response: tampered,
    secret,
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /output commitment mismatch/);
  assert.match(r.interpretation, /FAILED/);
});

test("shadow_verify_attestation verifies Ed25519-signed record with public key", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const request = { loan_id: "MCP-TEST-003" };
  const response = { verdict: "escalate" };
  const att = buildAttestation({
    request, response, modelId: "claude-sonnet-4-6",
    mode: SIGNATURE_MODES.ED25519, privateKey,
  });
  const r = handleToolCall("shadow_verify_attestation", {
    attestation: att,
    original_request: request,
    original_response: response,
    public_key: publicKey,
  });
  assert.equal(r.ok, true);
  assert.equal(r.mode, SIGNATURE_MODES.ED25519);
  assert.equal(r.model_id, "claude-sonnet-4-6");
});

test("shadow_verify_attestation rejects missing attestation arg", () => {
  const r = handleToolCall("shadow_verify_attestation", {
    original_request: {},
    original_response: {},
  });
  assert.match(r.error, /attestation required/);
});

test("shadow_verify_attestation surfaces model_id + key_id for audit trail", () => {
  const request = { loan_id: "MCP-TEST-004" };
  const response = { verdict: "approve" };
  const att = buildAttestation({
    request, response, modelId: "sonnet-v4",
    mode: SIGNATURE_MODES.HMAC, secret: "s", keyId: "prod-2026-Q3",
  });
  const r = handleToolCall("shadow_verify_attestation", {
    attestation: att,
    original_request: request,
    original_response: response,
    secret: "s",
  });
  assert.equal(r.model_id, "sonnet-v4");
  assert.equal(r.key_id, "prod-2026-Q3");
});
