// Shadow OCR layer — extract text from PDF/image into normalized loan fields.
//
// Pattern mirrors lib/ai-provider.ts in vibex:provider abstraction with
// graceful fallback. 3 tiers:
//
//   1. Mistral OCR API     — primary, cheap, best multilang receipt accuracy
//   2. Claude Vision API   — fallback when MISTRAL_API_KEY missing
//   3. Stub                 — deterministic mock data, ships scaffold without
//                             any LLM credit (current state 2026-06-23)
//
// Intern workflow (Yeshiva course final project):
//   PDF upload → extract_text_from_pdf() → extract_loan_fields() →
//   validateLoan() → runLoanCouncil() → 5-voice verdict.
//
// All providers return:
//   { text: string, provider: string, latency_ms: number, char_count: number }

import { extractLoanFieldsStub } from "./extract-loan-fields-stub.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/**
 * Load API key from env, fallback to ~/.config/{name}_key file.
 * Mirrors brain memory pattern from polymarket_daily.py — keeps cron
 * jobs working when launchd doesn't source ~/.zshrc.
 */
function loadKey(envName, configFileName) {
  const fromEnv = process.env[envName]?.trim();
  if (fromEnv) return fromEnv;
  const fromFile = join(homedir(), ".config", configFileName);
  if (existsSync(fromFile)) {
    try {
      return readFileSync(fromFile, "utf-8").trim();
    } catch {
      return "";
    }
  }
  return "";
}

const MISTRAL_KEY = loadKey("MISTRAL_API_KEY", "mistral_key");
const ANTHROPIC_KEY = loadKey("ANTHROPIC_API_KEY", "anthropic_key");

/**
 * Extract text from a PDF buffer.
 * @param {Buffer|Uint8Array} pdfBuffer - raw PDF bytes
 * @param {Object} opts - { force_provider?: 'mistral'|'claude'|'stub' }
 * @returns {Promise<{text:string, provider:string, latency_ms:number, char_count:number}>}
 */
export async function extractTextFromPdf(pdfBuffer, opts = {}) {
  const t0 = Date.now();
  const forced = opts.force_provider;

  // Force stub mode for tests / when both keys dry
  if (forced === "stub" || (!MISTRAL_KEY && !ANTHROPIC_KEY)) {
    const stubText = STUB_LOAN_PDF_TEXT;
    return {
      text: stubText,
      provider: "stub",
      latency_ms: Date.now() - t0,
      char_count: stubText.length,
      notice: "OCR providers not configured (MISTRAL_API_KEY + ANTHROPIC_API_KEY both missing). Using stub demo data."
    };
  }

  if ((forced === "mistral" || !forced) && MISTRAL_KEY) {
    try {
      const text = await mistralOcr(pdfBuffer, MISTRAL_KEY);
      return {
        text,
        provider: "mistral",
        latency_ms: Date.now() - t0,
        char_count: text.length
      };
    } catch (err) {
      if (forced === "mistral") throw err;
      // Fall through to claude
    }
  }

  if ((forced === "claude" || !forced) && ANTHROPIC_KEY) {
    try {
      const text = await claudeVisionOcr(pdfBuffer, ANTHROPIC_KEY);
      return {
        text,
        provider: "claude-vision",
        latency_ms: Date.now() - t0,
        char_count: text.length
      };
    } catch (err) {
      if (forced === "claude") throw err;
      // Fall through to stub
    }
  }

  // All providers failed → stub fallback
  return {
    text: STUB_LOAN_PDF_TEXT,
    provider: "stub",
    latency_ms: Date.now() - t0,
    char_count: STUB_LOAN_PDF_TEXT.length,
    notice: "All OCR providers failed. Using stub demo data."
  };
}

/**
 * Mistral OCR API call. Cheaper than Claude Vision, optimized for
 * structured documents like loan applications.
 *
 * Stub for now — real implementation goes here once MISTRAL_API_KEY set.
 * See https://docs.mistral.ai/capabilities/document/
 */
async function mistralOcr(_pdfBuffer, _key) {
  throw new Error("mistral_ocr_not_implemented — TODO: wire real Mistral Document API");
}

/**
 * Claude Vision OCR via Anthropic API. Higher cost (~$0.01-0.05/PDF) but
 * excellent accuracy on free-form loan documents. Uses claude-haiku-4-5
 * for cost — vision-capable, ~10x cheaper than sonnet for this task.
 *
 * Anthropic vision accepts PDFs directly via `document` content blocks
 * with base64 source. See: https://docs.anthropic.com/en/docs/build-with-claude/pdf-support
 *
 * The prompt asks Claude to extract verbatim text in a structured format
 * the downstream regex parser can consume — bridging modalities without
 * losing structured-field-locality.
 */
async function claudeVisionOcr(pdfBuffer, key) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: key });

  const base64Pdf = Buffer.from(pdfBuffer).toString("base64");

  const resp = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64Pdf,
            },
          },
          {
            type: "text",
            text: `Extract all text from this loan application PDF verbatim. Preserve labeled-field patterns like "FICO Score: 720", "Debt-to-Income Ratio: 0.30", "Loan-to-Value Ratio: 0.75", "Requested Amount: $250,000", "Sector: Industrials", "Fair Lending Review Required: No". Output ONLY the extracted text — no commentary, no analysis. The downstream parser uses regex to find these labeled fields, so accurate transcription matters more than summarization.`,
          },
        ],
      },
    ],
  });

  // Concatenate text blocks
  const text = resp.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  if (!text || text.length < 20) {
    throw new Error(`claude_vision_returned_empty — got ${text.length} chars`);
  }

  return text;
}

/**
 * Stub PDF representing a typical mid-tier bank loan application.
 * Used when OCR providers are unconfigured / failing. Lets us ship the
 * scaffold + demo end-to-end without LLM credit.
 *
 * Real intern PDFs vary — this is the "hello world" loan: FICO 720,
 * DTI 0.30, LTV 0.75, $250k industrials sector. Should APPROVE.
 */
export const STUB_LOAN_PDF_TEXT = `
LOAN APPLICATION — Mid-Tier Bank Standard Form

Borrower: Acme Industrial Holdings LLC
Application Date: 2026-06-23
Applicant ID: ACM-2026-0623-001

CREDIT METRICS
  FICO Score: 720
  Debt-to-Income Ratio: 0.30
  Loan-to-Value Ratio: 0.75
  Borrower Rating: BB+

LOAN DETAILS
  Requested Amount: $250,000
  Purpose: Working capital expansion
  Term: 5 years
  Sector: Industrials (NAICS 332710)
  Collateral: Equipment + receivables (LTV-eligible)

REGULATORY FLAGS
  Fair Lending Review Required: No
  CRA Assessment Area: Yes
  HMDA Reportable: No

UNDERWRITER NOTES
  Strong industrial sub-sector tailwinds.
  Receivables aging within 60-day band.
  Recommend Compliance + Risk Officer sign-off.
`.trim();

/**
 * Default export: extract loan fields from PDF buffer end-to-end.
 * Convenience for callers who don't need raw text.
 */
export async function extractLoanFromPdf(pdfBuffer, opts = {}) {
  const ocrResult = await extractTextFromPdf(pdfBuffer, opts);
  const loanFields = extractLoanFieldsStub(ocrResult.text);
  return {
    loan: loanFields,
    ocr: ocrResult
  };
}
