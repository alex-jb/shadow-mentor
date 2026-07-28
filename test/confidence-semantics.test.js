// Confidence semantics guard (Alex 2026-07-21): the per-voice `confidence` numbers in
// the deterministic council are FIXED persona priors, not model probabilities. This test
// pins that the council output declares that semantics, keeps the backward-compatible
// `confidence` field, and never lets a reliability-diagram / probability-of-correctness
// claim slip in. UI/JSON/PPT must all read confidence under the same meaning.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runLoanCouncil } from "../lib/run-loan-council.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FACTS = JSON.parse(readFileSync(join(ROOT, "product-facts.json"), "utf8"));

const LOAN = {
  credit_score: 720, debt_to_income: 0.30, loan_to_value: 0.60, amount: 500000,
  borrower_rating: "BBB", sector: "healthcare", fair_lending_review_flag: false,
  market_proxy_prices: [100, 101, 99, 102, 98, 100],
  collateral_positions: [{ ticker: "AAPL", sector: "Tech", weight: 1.0 }],
  borrower_exposure_weights: { WidgetCo: 1.0 },
};

test("council output declares confidence_semantics = persona_prior (not model probability)", () => {
  const r = runLoanCouncil(LOAN);
  assert.ok(r.confidence_semantics, "confidence_semantics field missing");
  assert.equal(r.confidence_semantics.kind, "persona_prior");
  assert.equal(r.confidence_semantics.is_model_probability, false);
  assert.equal(r.confidence_semantics.is_probability_of_correctness, false);
  assert.equal(r.confidence_semantics.reliability_diagram_valid, false);
  // the declared kind must be one the manifest allows
  assert.ok(FACTS.confidence_semantics.allowed_values.includes(r.confidence_semantics.kind));
});

test("the backward-compatible `confidence` field is preserved on every voice", () => {
  const r = runLoanCouncil(LOAN);
  for (const v of r.voices) assert.equal(typeof v.confidence, "number", `voice ${v.voice} lost its confidence field`);
});

test("the UI label for persona_prior is STANCE STRENGTH, not a probability phrase", () => {
  const r = runLoanCouncil(LOAN);
  assert.equal(r.confidence_semantics.ui_label, FACTS.confidence_semantics.ui_labels.persona_prior);
  assert.equal(r.confidence_semantics.ui_label, "STANCE STRENGTH");
  assert.doesNotMatch(r.confidence_semantics.ui_label.toLowerCase(), /confidence|probability|%|correct/);
});
