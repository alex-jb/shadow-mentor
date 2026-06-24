// Live OCR smoke tests — exercise claudeVisionOcr() + mistralOcr() against
// real provider APIs using a real loan PDF fixture.
//
// Skips when keys absent (CI default) — runs locally / on Alex's machine
// when ANTHROPIC_API_KEY or MISTRAL_API_KEY is set.
//
// Gates the Yeshiva 6/25 Hieu Ngo demo: surfaces real API regressions
// (auth, payload shape, response shape) that the stub path can't catch.
//
// Cost: ~$0.001-0.005 per fire on Claude Vision (claude-haiku-4-5, 1-page).
// Mistral OCR ~$0.001/page per docs (2026-06-24).

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extractTextFromPdf } from "../lib/ocr/index.js";
import { extractLoanFieldsStub } from "../lib/ocr/extract-loan-fields-stub.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, "fixtures", "sample-loan.pdf");

const HAS_ANTHROPIC = !!(process.env.ANTHROPIC_API_KEY?.trim() || existsSync(`${process.env.HOME}/.config/anthropic_key`));
const HAS_MISTRAL = !!(process.env.MISTRAL_API_KEY?.trim() || existsSync(`${process.env.HOME}/.config/mistral_key`));

function loadFixture() {
  if (!existsSync(FIXTURE)) {
    throw new Error(`fixture missing: ${FIXTURE} — run 'node scripts/gen-loan-pdf-fixture.mjs'`);
  }
  return readFileSync(FIXTURE);
}

describe("OCR live smoke — real provider end-to-end", () => {
  test("fixture exists + is a valid PDF", () => {
    const buf = loadFixture();
    // PDF magic: %PDF-
    assert.equal(buf.slice(0, 5).toString("ascii"), "%PDF-");
    assert.ok(buf.length > 500, "fixture should be > 500 bytes");
  });

  test("claude-vision: real PDF → text → loan fields parse", { skip: !HAS_ANTHROPIC ? "ANTHROPIC_API_KEY not set" : false }, async () => {
    const pdf = loadFixture();
    const result = await extractTextFromPdf(pdf, { force_provider: "claude" });

    assert.equal(result.provider, "claude-vision");
    assert.ok(result.text.length > 100, `expected >100 chars, got ${result.text.length}`);
    assert.ok(result.latency_ms > 0);

    // Claude should have transcribed enough labeled fields for the regex parser
    // to extract the 5 critical loan metrics.
    const loan = extractLoanFieldsStub(result.text);
    assert.equal(loan.credit_score, 720, `FICO mismatch — Claude text: ${result.text.slice(0, 500)}`);
    assert.equal(loan.debt_to_income, 0.30);
    assert.equal(loan.loan_to_value, 0.75);
    assert.equal(loan.amount, 250000);
    assert.equal(loan.sector, "industrials");
  });

  test("mistral-ocr: real PDF → text → loan fields parse", { skip: !HAS_MISTRAL ? "MISTRAL_API_KEY not set" : false }, async () => {
    const pdf = loadFixture();
    const result = await extractTextFromPdf(pdf, { force_provider: "mistral" });

    assert.equal(result.provider, "mistral");
    assert.ok(result.text.length > 100, `expected >100 chars, got ${result.text.length}`);
    assert.ok(result.latency_ms > 0);

    const loan = extractLoanFieldsStub(result.text);
    assert.equal(loan.credit_score, 720, `FICO mismatch — Mistral text: ${result.text.slice(0, 500)}`);
    assert.equal(loan.debt_to_income, 0.30);
    assert.equal(loan.loan_to_value, 0.75);
    assert.equal(loan.amount, 250000);
    assert.equal(loan.sector, "industrials");
  });

  test("auto-fallback chain: no force → picks first available real provider", { skip: !(HAS_ANTHROPIC || HAS_MISTRAL) ? "no OCR keys set" : false }, async () => {
    const pdf = loadFixture();
    const result = await extractTextFromPdf(pdf);
    assert.ok(["mistral", "claude-vision"].includes(result.provider), `unexpected provider: ${result.provider}`);
    assert.ok(result.text.length > 100);
  });
});
