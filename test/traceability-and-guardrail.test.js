// Contract tests for the 2026-06-19 procurement-defensibility patterns
// ported from Loredana C. Levitchi's Mode A reference implementation:
//   - inline traceability dict in /api/deliberate response
//   - 5-code adverse-action mapping (AA01..AA05)
//   - 3-bucket VaR classifier (within_budget / escalate / breach)
//   - enforceAnalysisOnly regex guardrail
//
// Reference: Lora's `orallexa_modea` package, shared 2026-06-19 via Drive
// (Orallexa_Shadow_ModeA_Complete_BRD_Addenda_Package.zip).

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runLoanCouncil } from "../lib/run-loan-council.js";
import {
  enforceAnalysisOnly,
  AnalysisOnlyViolationError
} from "../lib/audit-guardrail.js";
import {
  TRACEABILITY,
  classifyVarStatus
} from "../lib/traceability.js";
import {
  ADVERSE_ACTION_CODES,
  AA_SOURCES
} from "../lib/schemas/adverse-action.js";

const baseLoan = {
  credit_score: 720,
  debt_to_income: 0.32,
  loan_to_value: 0.78,
  amount: 1_200_000,
  borrower_rating: "B",
  sector: "industrials",
  fair_lending_review_flag: false,
  adverse_action_reasons: [],
  market_proxy_prices: [100, 99, 101, 98, 97, 100, 96, 95, 99, 94, 93],
  collateral_positions: [],
  borrower_exposure_weights: { primary: 0.7, guarantor: 0.3 }
};

describe("traceability — inline citation chain", () => {
  it("returns 8+ source mappings keyed to BRD vs Addenda", () => {
    const r = runLoanCouncil(baseLoan);
    assert.ok(r.traceability, "response must include traceability dict");
    assert.equal(r.traceability["FICO >= 700"], "Addendum A - Loan Origination Credit Policy");
    assert.equal(r.traceability["DTI <= 0.36"], "Addendum B - Debt-to-Income Eligibility Policy");
    assert.equal(r.traceability["LTV <= 0.80"], "Addendum C - Collateral / LTV Policy");
    assert.equal(r.traceability["VaR <= 0.12"], "Addendum C - Risk Appetite Note (benchmark calibration)");
    assert.equal(r.traceability["VaR/ES Framework"], "BRD Risk Core Specification");
    assert.equal(r.traceability["10-Day Horizon"], "BRD Risk Packet Methodology");
    assert.equal(r.traceability["Confidence 95%"], "BRD Risk Packet Methodology");
    assert.equal(r.traceability["Analysis Only"], "BRD Governance Controls");
  });

  it("never cites BRD for FICO / DTI / LTV / VaR cutoff (provenance separation)", () => {
    const entries = Object.entries(TRACEABILITY);
    for (const [rule, source] of entries) {
      if (/FICO|DTI|LTV/.test(rule) || /VaR <=/.test(rule)) {
        assert.ok(
          !source.startsWith("BRD"),
          `${rule} must NOT cite BRD (was: ${source}) — it must be sourced from an Addendum`
        );
      }
    }
  });
});

describe("VaR 3-bucket classifier", () => {
  it("classifies within_budget at or below threshold", () => {
    assert.equal(classifyVarStatus(0.08), "within_budget");
    assert.equal(classifyVarStatus(0.12), "within_budget");
  });
  it("classifies escalate in [threshold, threshold+0.03]", () => {
    assert.equal(classifyVarStatus(0.13), "escalate");
    assert.equal(classifyVarStatus(0.15), "escalate");
  });
  it("classifies breach above threshold + 0.03", () => {
    assert.equal(classifyVarStatus(0.16), "breach");
    assert.equal(classifyVarStatus(0.40), "breach");
  });
  it("Risk Officer voice surfaces risk_budget_status", () => {
    const r = runLoanCouncil(baseLoan);
    assert.ok(["within_budget", "escalate", "breach"].includes(r.risk_packet.risk_budget_status));
  });
});

describe("Adverse-action code mapping (CFPB-grade)", () => {
  it("has 5 codes AA01..AA05 with source attribution", () => {
    const codes = Object.keys(ADVERSE_ACTION_CODES).sort();
    assert.deepEqual(codes, ["AA01", "AA02", "AA03", "AA04", "AA05"]);
    for (const code of codes) {
      assert.ok(typeof ADVERSE_ACTION_CODES[code] === "string");
      assert.ok(typeof AA_SOURCES[code] === "string");
    }
  });

  it("AA01 fires when FICO is below floor", () => {
    const r = runLoanCouncil({ ...baseLoan, credit_score: 680 });
    const aa = r.adverse_action_codes.find((a) => a.code === "AA01");
    assert.ok(aa, "AA01 must be present when FICO < 700");
    assert.equal(aa.source, "Addendum A");
  });

  it("AA02 fires when DTI exceeds ceiling", () => {
    const r = runLoanCouncil({ ...baseLoan, debt_to_income: 0.45 });
    const aa = r.adverse_action_codes.find((a) => a.code === "AA02");
    assert.ok(aa, "AA02 must be present when DTI > 0.36");
  });

  it("AA05 fires when fair_lending_review_flag is set", () => {
    const r = runLoanCouncil({ ...baseLoan, fair_lending_review_flag: true });
    const aa = r.adverse_action_codes.find((a) => a.code === "AA05");
    assert.ok(aa, "AA05 must be present when fair-lending flag set");
  });
});

describe("Analysis-only guardrail", () => {
  it("certifies a clean payload", () => {
    const cert = enforceAnalysisOnly({ verdict: "escalate", reason: "FICO low" });
    assert.equal(cert.analysis_only, true);
    assert.equal(cert.trade_execution_enabled, false);
  });

  it("rejects payloads containing trade-execution verbs", () => {
    assert.throws(
      () => enforceAnalysisOnly({ recommendation: "buy and execute trade now" }),
      AnalysisOnlyViolationError
    );
    assert.throws(
      () => enforceAnalysisOnly("auto_approve the loan and submit_order"),
      AnalysisOnlyViolationError
    );
  });

  it("runLoanCouncil response passes guardrail by construction", () => {
    // If runLoanCouncil ever produces forbidden verbs in voice rationale,
    // this test breaks before the deploy ships.
    const r = runLoanCouncil(baseLoan);
    const cert = enforceAnalysisOnly(r);
    assert.equal(cert.analysis_only, true);
  });
});

describe("Schema version bumped to 1.1.0-mode-a", () => {
  it("response schema reports new version reflecting traceability + AA + guardrail", () => {
    const r = runLoanCouncil(baseLoan);
    assert.equal(r.schema_version, "1.1.0-mode-a");
  });
});
