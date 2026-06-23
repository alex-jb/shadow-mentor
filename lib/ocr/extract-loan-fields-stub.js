// Structured-field extraction from raw OCR text → typed loan dict.
//
// Stub implementation: regex-based parsing of standard loan application
// templates. Works on STUB_LOAN_PDF_TEXT (always) + real-world templates
// that follow the labeled-field pattern (FICO Score: ###).
//
// When LLM credit returns, swap this for Claude tool-use call with
// loan schema as a tool. Until then: deterministic regex extraction
// covers the demo path.
//
// Confidence score:
//   - all 4 required fields parsed → 0.9 (high)
//   - 3/4 parsed                    → 0.6 (medium)
//   - 2/4 parsed                    → 0.3 (low) — falls back to defaults
//   - 0-1 parsed                    → 0.0 + throws (caller must use stub PDF)

const REQUIRED_FIELDS = ["credit_score", "debt_to_income", "loan_to_value", "amount"];
const VALID_SECTORS = ["industrials", "technology", "financials", "consumer", "healthcare",
                        "energy", "materials", "utilities", "real_estate", "telecom"];

// Field patterns — capture group is the value
const PATTERNS = {
  credit_score: [
    /FICO\s+Score:\s*(\d{3})/i,
    /Credit\s+Score:\s*(\d{3})/i,
    /credit_score[:\s]+(\d{3})/i
  ],
  debt_to_income: [
    /Debt[-\s]to[-\s]Income\s+Ratio:\s*([0-9]*\.?\d+)/i,
    /DTI:\s*([0-9]*\.?\d+)/i
  ],
  loan_to_value: [
    /Loan[-\s]to[-\s]Value\s+Ratio:\s*([0-9]*\.?\d+)/i,
    /LTV:\s*([0-9]*\.?\d+)/i
  ],
  amount: [
    /Requested\s+Amount:\s*\$?([\d,]+(?:\.\d+)?)/i,
    /Loan\s+Amount:\s*\$?([\d,]+(?:\.\d+)?)/i,
    /Amount:\s*\$?([\d,]+(?:\.\d+)?)/i
  ],
  sector: [
    /Sector:\s*([A-Za-z][A-Za-z\s]*?)(?:\s*\(|$|\n)/im
  ],
  fair_lending_review_flag: [
    /Fair\s+Lending\s+Review\s+Required:\s*(Yes|No|True|False)/i
  ]
};

function tryParse(text, fieldKey) {
  const patterns = PATTERNS[fieldKey] || [];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      return m[1];
    }
  }
  return null;
}

function parseNumber(raw) {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).replace(/,/g, "").trim();
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseBool(raw) {
  if (raw === null || raw === undefined) return null;
  return /^(yes|true)$/i.test(String(raw).trim());
}

function parseSector(raw) {
  if (!raw) return null;
  const norm = String(raw).toLowerCase().trim();
  // Accept first valid sector token
  for (const s of VALID_SECTORS) {
    if (norm.includes(s)) return s;
  }
  return null;
}

/**
 * Extract structured loan fields from raw OCR text.
 * @param {string} text - OCR output
 * @returns {Object} loan dict + _meta {confidence, extracted_fields, missing_fields}
 */
export function extractLoanFieldsStub(text) {
  const extracted = {};
  const missing = [];

  // Numeric required fields
  for (const field of REQUIRED_FIELDS) {
    const raw = tryParse(text, field);
    const num = parseNumber(raw);
    if (num !== null) {
      extracted[field] = num;
    } else {
      missing.push(field);
    }
  }

  // Optional fields
  const sectorRaw = tryParse(text, "sector");
  const sector = parseSector(sectorRaw);
  if (sector) extracted.sector = sector;

  const fairLendingRaw = tryParse(text, "fair_lending_review_flag");
  const fairLending = parseBool(fairLendingRaw);
  if (fairLending !== null) extracted.fair_lending_review_flag = fairLending;

  // Confidence: ratio of required fields parsed
  const parsedRequired = REQUIRED_FIELDS.length - missing.length;
  const confidence = parsedRequired / REQUIRED_FIELDS.length;

  if (confidence < 0.5) {
    // Not enough data — caller should reject + ask for re-scan
    return {
      _meta: {
        confidence,
        extracted_fields: Object.keys(extracted),
        missing_fields: missing,
        extraction_method: "regex-stub",
        notice: "Confidence below 0.5 — OCR text didn't match any known loan template. Recheck PDF quality."
      }
    };
  }

  // Stable market_proxy_prices for stub demos so council voices reproduce
  if (!extracted.market_proxy_prices) {
    extracted.market_proxy_prices = [100, 101, 99, 102, 100, 101, 99, 100, 101, 100, 99];
  }

  return {
    ...extracted,
    _meta: {
      confidence,
      extracted_fields: Object.keys(extracted),
      missing_fields: missing,
      extraction_method: "regex-stub",
      notice: confidence === 1.0
        ? "All required fields parsed cleanly."
        : `Parsed ${parsedRequired}/4 required fields. Missing: ${missing.join(", ")}`
    }
  };
}
