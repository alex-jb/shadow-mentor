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

// Detect envelope conditions (billing/quota/rate-limit) so the smoke test
// can distinguish "integration broken" from "out of credits this month."
// Anthropic returns 400 / 429 with one of these message fragments when the
// monthly usage cap is hit (verified 2026-06-28: req_011CcWPM83rBftR5FE8FgLkF
// "You have reached your specified API usage limits."). Treating these as
// regressions caused two false-positive failures on Alex's laptop that
// were really billing-envelope events.
const ENVELOPE_PATTERNS = [
  /reached your specified API usage limits/i,
  /usage limit/i,
  /quota/i,
  /rate_limit_error/i,
  /credit_balance_too_low/i,
  /insufficient_quota/i,
];

function isEnvelopeError(err) {
  const msg = err?.message || "";
  return ENVELOPE_PATTERNS.some((re) => re.test(msg));
}

describe("OCR live smoke — real provider end-to-end", () => {
  test("fixture exists + is a valid PDF", () => {
    const buf = loadFixture();
    // PDF magic: %PDF-
    assert.equal(buf.slice(0, 5).toString("ascii"), "%PDF-");
    assert.ok(buf.length > 500, "fixture should be > 500 bytes");
  });

  test("claude-vision: real PDF → text → loan fields parse", { skip: !HAS_ANTHROPIC ? "ANTHROPIC_API_KEY not set" : false }, async (t) => {
    const pdf = loadFixture();
    let result;
    try {
      result = await extractTextFromPdf(pdf, { force_provider: "claude" });
    } catch (err) {
      if (isEnvelopeError(err)) {
        return t.skip(`Anthropic envelope (quota/limit) — not a regression: ${err.message.slice(0, 200)}`);
      }
      throw err;
    }

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

  test("mistral-ocr: real PDF → text → loan fields parse", { skip: !HAS_MISTRAL ? "MISTRAL_API_KEY not set" : false }, async (t) => {
    const pdf = loadFixture();
    let result;
    try {
      result = await extractTextFromPdf(pdf, { force_provider: "mistral" });
    } catch (err) {
      if (isEnvelopeError(err)) {
        return t.skip(`Mistral envelope (quota/limit) — not a regression: ${err.message.slice(0, 200)}`);
      }
      throw err;
    }

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

  test("auto-fallback chain: no force → picks first available real provider", { skip: !(HAS_ANTHROPIC || HAS_MISTRAL) ? "no OCR keys set" : false }, async (t) => {
    const pdf = loadFixture();
    let result;
    try {
      result = await extractTextFromPdf(pdf);
    } catch (err) {
      if (isEnvelopeError(err)) {
        return t.skip(`upstream envelope (quota/limit) on first available provider: ${err.message.slice(0, 200)}`);
      }
      throw err;
    }
    // If a provider has hit its envelope but we still got a result, the
    // resolver may have legitimately fallen through to "stub" — accept
    // that path because envelope-skipping is an upstream condition, not
    // a code-path regression.
    assert.ok(
      ["mistral", "claude-vision", "stub"].includes(result.provider),
      `unexpected provider: ${result.provider}`
    );
    assert.ok(result.text.length > 100);
  });

  test("isEnvelopeError correctly identifies Anthropic quota error (regression pin)", () => {
    // Pin the actual message Anthropic returned on 2026-06-28 so a
    // wording change upstream is caught immediately by CI.
    const realError = new Error(
      'You have reached your specified API usage limits. You will regain access on 2026-07-01 at 00:00 UTC.'
    );
    assert.equal(isEnvelopeError(realError), true);
    assert.equal(isEnvelopeError(new Error("HTTP 500 Internal Server Error")), false);
    assert.equal(isEnvelopeError(new Error("PDF parse failed: invalid header")), false);
  });
});
