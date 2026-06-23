// POST /api/loan-council-from-pdf
//
// Intern-facing endpoint: scan PDF → 5-voice loan council verdict.
// Wraps OCR layer (lib/ocr/) + existing /api/loan-council compute path.
//
// Yeshiva course final project flow (Reality Extend × Shadow × Flow):
//   Intern receives PDF loan application
//     → Upload via XR overlay (XReal Air 2 Ultra) or web form
//     → Shadow extracts structured fields via OCR (Mistral → Claude → stub)
//     → 5 personas debate via runLoanCouncil
//     → Flow Workspace renders verdict + traceability chain in 3D
//     → Intern sees 5-voice spatial verdict + each voice's BR citation
//
// Request:
//   POST /api/loan-council-from-pdf
//   Content-Type: application/json
//   Body: {
//     pdf_base64: string,           // base64-encoded PDF bytes
//     force_ocr_provider?: "mistral"|"claude"|"stub"   // optional
//   }
//
// Response: same shape as /api/loan-council + meta:
//   {
//     final_verdict, voices[], risk_packet, thresholds_applied, ...
//     ocr: { provider, latency_ms, char_count, notice? },
//     extraction: { confidence, extracted_fields, missing_fields, ... },
//     loan_extracted: { credit_score, debt_to_income, ... }
//   }
//
// Errors:
//   400 missing pdf_base64
//   400 OCR confidence below 0.5 (PDF unreadable or non-loan-template)
//   400 extracted loan failed validateLoan (schema violation)

import { extractTextFromPdf } from "../lib/ocr/index.js";
import { extractLoanFieldsStub } from "../lib/ocr/extract-loan-fields-stub.js";
import { runLoanCouncil } from "../lib/run-loan-council.js";
import { validateLoan } from "../lib/schemas/loan.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const { pdf_base64, force_ocr_provider } = req.body ?? {};

  let pdfBuffer = null;
  if (pdf_base64) {
    try {
      pdfBuffer = Buffer.from(pdf_base64, "base64");
    } catch (err) {
      return res.status(400).json({
        error: "pdf_base64 not valid base64",
        details: err?.message
      });
    }
  }
  // Allow empty body for stub-demo mode (no PDF uploaded → OCR returns stub text)
  // This is the Yeshiva course demo path before intern has a real PDF.

  const ocrResult = await extractTextFromPdf(pdfBuffer ?? Buffer.alloc(0), {
    force_provider: force_ocr_provider
  });

  const extractResult = extractLoanFieldsStub(ocrResult.text);

  if (extractResult._meta.confidence < 0.5) {
    return res.status(400).json({
      error: "OCR extraction confidence too low",
      ocr: ocrResult,
      extraction: extractResult._meta,
      hint: "PDF unreadable or non-loan-template format. Try a cleaner scan or use a Mid-Tier Bank Standard Form."
    });
  }

  // Strip _meta before validating
  const { _meta: extractionMeta, ...loanFields } = extractResult;

  const v = validateLoan(loanFields);
  if (!v.valid) {
    return res.status(400).json({
      error: "extracted loan failed schema validation",
      ocr: ocrResult,
      extraction: extractionMeta,
      loan_extracted: loanFields,
      validation_errors: v.errors
    });
  }

  const t0 = Date.now();
  const council = runLoanCouncil(loanFields);
  const council_latency_ms = Date.now() - t0;

  return res.status(200).json({
    ...council,
    council_latency_ms,
    total_latency_ms: ocrResult.latency_ms + council_latency_ms,
    ocr: {
      provider: ocrResult.provider,
      latency_ms: ocrResult.latency_ms,
      char_count: ocrResult.char_count,
      ...(ocrResult.notice ? { notice: ocrResult.notice } : {})
    },
    extraction: extractionMeta,
    loan_extracted: loanFields,
    timestamp: new Date().toISOString()
  });
}
