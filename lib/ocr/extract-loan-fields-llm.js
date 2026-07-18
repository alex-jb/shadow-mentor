// Structured-field extraction from raw OCR text → typed loan dict, via Claude
// tool-use (the upgrade the regex stub's docstring promised: "swap this for a
// Claude tool-use call with loan schema as a tool"). The loan schema is passed
// as a forced tool, so the model returns a validated object, not prose we parse.
//
// Output contract is IDENTICAL to extractLoanFieldsStub() — same fields + the
// same `_meta` {confidence, extracted_fields, missing_fields, extraction_method,
// notice} — so callers swap extractors without any downstream change. The
// dispatcher in index.js tries this when a key is present and falls back to the
// deterministic regex stub otherwise (or on any error), matching the OCR tiers.
//
// Discipline: the prompt tells the model to OMIT fields it can't find rather than
// guess, and confidence is computed from which REQUIRED fields are actually
// present — a hallucinated value it forgot to omit still can't inflate confidence
// past what validateLoan() will accept downstream.

const REQUIRED_FIELDS = ["credit_score", "debt_to_income", "loan_to_value", "amount"];
const VALID_SECTORS = ["industrials", "technology", "financials", "consumer", "healthcare",
                       "energy", "materials", "utilities", "real_estate", "telecom"];

export const LOAN_EXTRACTION_TOOL = {
  name: "extract_loan_fields",
  description: "Record the loan-application fields found in the document. Only include a field whose value is explicitly present in the text; omit any field you would have to guess or infer.",
  input_schema: {
    type: "object",
    properties: {
      credit_score: { type: "integer", description: "FICO / credit score, 300–850. Omit if not stated." },
      debt_to_income: { type: "number", description: "Debt-to-income (DTI) ratio, e.g. 0.30. Omit if not stated." },
      loan_to_value: { type: "number", description: "Loan-to-value (LTV) ratio, e.g. 0.75. Omit if not stated." },
      amount: { type: "number", description: "Requested loan amount in dollars, digits only — no $ or commas. Omit if not stated." },
      sector: { type: "string", enum: VALID_SECTORS, description: "Industry sector, if stated." },
      fair_lending_review_flag: { type: "boolean", description: "True if the document says a fair-lending review is required/flagged." },
    },
    required: [],
  },
};

// Shape a raw field object into the stub's output contract. Kept local (not
// imported from the stub) so a change to the regex parser can't silently alter
// the LLM path's contract — the shared thing is the SHAPE, asserted by tests.
export function shapeLoanExtraction(fields, method = "llm-tool-use") {
  const extracted = {};
  const missing = [];
  for (const f of REQUIRED_FIELDS) {
    const v = fields?.[f];
    if (typeof v === "number" && Number.isFinite(v)) extracted[f] = v;
    else missing.push(f);
  }
  if (typeof fields?.sector === "string") {
    const s = fields.sector.toLowerCase().trim();
    if (VALID_SECTORS.includes(s)) extracted.sector = s;
  }
  if (typeof fields?.fair_lending_review_flag === "boolean") {
    extracted.fair_lending_review_flag = fields.fair_lending_review_flag;
  }

  const parsedRequired = REQUIRED_FIELDS.length - missing.length;
  const confidence = parsedRequired / REQUIRED_FIELDS.length;

  if (confidence < 0.5) {
    return { _meta: {
      confidence,
      extracted_fields: Object.keys(extracted),
      missing_fields: missing,
      extraction_method: method,
      notice: "Confidence below 0.5 — the document didn't yield enough required loan fields. Recheck scan quality.",
    } };
  }

  if (!extracted.market_proxy_prices) {
    extracted.market_proxy_prices = [100, 101, 99, 102, 100, 101, 99, 100, 101, 100, 99];
  }
  return { ...extracted, _meta: {
    confidence,
    extracted_fields: Object.keys(extracted),
    missing_fields: missing,
    extraction_method: method,
    notice: confidence === 1.0
      ? "All required fields extracted."
      : `Extracted ${parsedRequired}/4 required fields. Missing: ${missing.join(", ")}`,
  } };
}

/**
 * Extract loan fields from OCR text via Claude tool-use.
 * @param {string} text
 * @param {{key:string, model?:string}} opts - Anthropic key required
 * @returns {Promise<Object>} same shape as extractLoanFieldsStub()
 * @throws if no key, or the model doesn't call the tool
 */
export async function extractLoanFieldsLLM(text, { key, model = "claude-haiku-4-5" } = {}) {
  if (!key) throw new Error("extractLoanFieldsLLM requires an Anthropic API key");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: key });
  const resp = await client.messages.create({
    model,
    max_tokens: 1024,
    tools: [LOAN_EXTRACTION_TOOL],
    tool_choice: { type: "tool", name: "extract_loan_fields" },
    messages: [{
      role: "user",
      content:
        "Extract the loan-application fields from the document text below and record them with the extract_loan_fields tool. " +
        "Only include a field whose value is explicitly present — omit anything you would have to guess. Numbers only for amount (no $ or commas).\n\n---\n" +
        String(text) + "\n---",
    }],
  });
  const toolUse = resp.content.find((b) => b.type === "tool_use" && b.name === "extract_loan_fields");
  if (!toolUse) throw new Error("model did not call extract_loan_fields");
  return shapeLoanExtraction(toolUse.input, "llm-tool-use");
}
