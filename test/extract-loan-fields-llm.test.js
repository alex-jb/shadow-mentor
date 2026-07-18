// Tests for the LLM tool-use loan-field extractor + the dispatcher that prefers
// it. The live Claude call needs a key, so the deterministic coverage is on
// shapeLoanExtraction() (the output contract, which must match the regex stub)
// and the dispatcher's branch logic; the real call is a single skip-without-key
// smoke test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { LOAN_EXTRACTION_TOOL, shapeLoanExtraction, extractLoanFieldsLLM } from "../lib/ocr/extract-loan-fields-llm.js";
import { extractLoanFields } from "../lib/ocr/index.js";
import { existsSync } from "node:fs";

const HAS_KEY = !!(process.env.ANTHROPIC_API_KEY?.trim() || existsSync(`${process.env.HOME}/.config/anthropic_key`));

test("tool schema: forced tool with sector enum + the four required-domain fields", () => {
  assert.equal(LOAN_EXTRACTION_TOOL.name, "extract_loan_fields");
  const props = LOAN_EXTRACTION_TOOL.input_schema.properties;
  for (const f of ["credit_score", "debt_to_income", "loan_to_value", "amount"]) assert.ok(props[f], `missing ${f}`);
  assert.ok(Array.isArray(props.sector.enum) && props.sector.enum.includes("industrials"));
  assert.equal(props.fair_lending_review_flag.type, "boolean");
});

test("shapeLoanExtraction: full fields → confidence 1.0, llm-tool-use, market proxy default", () => {
  const r = shapeLoanExtraction({ credit_score: 720, debt_to_income: 0.30, loan_to_value: 0.75, amount: 250000, sector: "Industrials", fair_lending_review_flag: false });
  assert.equal(r.credit_score, 720);
  assert.equal(r.sector, "industrials"); // normalized
  assert.equal(r.fair_lending_review_flag, false);
  assert.equal(r._meta.confidence, 1.0);
  assert.equal(r._meta.extraction_method, "llm-tool-use");
  assert.equal(r._meta.missing_fields.length, 0);
  assert.ok(Array.isArray(r.market_proxy_prices) && r.market_proxy_prices.length >= 3);
});

test("shapeLoanExtraction: contract matches the stub (fields + _meta keys)", () => {
  const r = shapeLoanExtraction({ credit_score: 700, debt_to_income: 0.3, loan_to_value: 0.8, amount: 100000 });
  assert.deepEqual(Object.keys(r._meta).sort(), ["confidence", "extracted_fields", "extraction_method", "missing_fields", "notice"].sort());
});

test("shapeLoanExtraction: <0.5 required present → _meta-only, no leaked fields", () => {
  const r = shapeLoanExtraction({ credit_score: 700 }); // 1/4
  assert.ok(r._meta.confidence < 0.5);
  assert.equal(r.credit_score, undefined);
  assert.equal(r.market_proxy_prices, undefined);
});

test("shapeLoanExtraction: drops invalid sector + non-numeric required values", () => {
  const r = shapeLoanExtraction({ credit_score: 720, debt_to_income: 0.3, loan_to_value: 0.75, amount: 250000, sector: "banana" });
  assert.equal(r.sector, undefined);        // not in the enum → dropped
  const r2 = shapeLoanExtraction({ credit_score: "not a number", debt_to_income: 0.3, loan_to_value: 0.75, amount: 250000 });
  assert.ok(r2._meta.missing_fields.includes("credit_score")); // string didn't count
});

test("dispatcher: force_extractor:'regex' → deterministic regex path (no LLM call)", async () => {
  const text = "FICO Score: 700\nDebt-to-Income Ratio: 0.30\nLoan-to-Value Ratio: 0.75\nRequested Amount: $100,000";
  const r = await extractLoanFields(text, { force_extractor: "regex" });
  assert.equal(r._meta.extraction_method, "regex-stub");
  assert.equal(r.credit_score, 700);
});

test("dispatcher: force_extractor:'llm' with no key → throws (fails loudly, not silent regex)", async () => {
  await assert.rejects(
    () => extractLoanFields("FICO Score: 700", { force_extractor: "llm", key: "" }),
    /requires an Anthropic API key/,
  );
});

test("extractLoanFieldsLLM live: real tool-use extraction on the stub PDF text", { skip: !HAS_KEY }, async () => {
  const key = process.env.ANTHROPIC_API_KEY?.trim()
    || (await import("node:fs")).readFileSync(`${process.env.HOME}/.config/anthropic_key`, "utf-8").trim();
  const text = "FICO Score: 715\nDebt-to-Income Ratio: 0.28\nLoan-to-Value Ratio: 0.70\nRequested Amount: $300,000\nSector: Technology";
  try {
    const r = await extractLoanFieldsLLM(text, { key });
    assert.equal(r._meta.extraction_method, "llm-tool-use");
    assert.equal(r.credit_score, 715);
    assert.equal(r.sector, "technology");
    assert.ok(r._meta.confidence >= 0.5);
  } catch (err) {
    // billing-envelope events are not regressions (brain rule)
    if (/usage limit|credit balance|rate limit|429|quota/i.test(err.message)) { console.log("skipped (billing envelope):", err.message); return; }
    throw err;
  }
});
