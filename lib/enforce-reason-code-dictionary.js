// lib/enforce-reason-code-dictionary.js
// ──────────────────────────────────────────────────────────────────
// Reject any adverse-action code whose feature isn't in the
// checked-in reason-code dictionary. Reject any decision that cites
// a protected-class proxy feature.
//
// Ships 2026-07-02 to close the post-2026-07-21 Reg B compliance
// gap. The dictionary is at lib/schemas/reason-code-dictionary.json
// — bank counsel signs THAT FILE, not the LLM output. See file
// docstring for rationale.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DICT_PATH = join(__dirname, "schemas", "reason-code-dictionary.json");

let _cached = null;
let _cachedHash = null;

/**
 * SHA-256 hex of the raw bytes of `lib/schemas/reason-code-dictionary.json`.
 * Ships v1.5.8+. This is the value bound into every attestation's
 * `dictionary_hash` field so a post-hoc dictionary edit (adding a
 * borrower-facing rationale that wasn't counsel-signed at decision time)
 * breaks verification.
 *
 * Bank counsel signs the file bytes; Shadow signs an attestation that
 * binds this hash; auditor rehashes the file and confirms it matches.
 * Any drift between counsel-signed bytes and runtime bytes fails.
 */
export function computeDictionaryHash() {
  if (_cachedHash) return _cachedHash;
  const text = readFileSync(DICT_PATH, "utf-8");
  _cachedHash = createHash("sha256").update(text, "utf-8").digest("hex");
  return _cachedHash;
}

/**
 * Load the reason-code dictionary from disk. Cached after first call.
 * @param {{fresh?: boolean}} opts — set fresh=true to bypass cache (tests).
 */
export function loadReasonCodeDictionary(opts = {}) {
  if (!opts.fresh && _cached) return _cached;
  const text = readFileSync(DICT_PATH, "utf-8");
  const parsed = JSON.parse(text);
  // Shape guards — a corrupt file must fail the enforcement, not
  // silently pass everything through.
  if (!Array.isArray(parsed.mappings)) {
    throw new Error("reason-code-dictionary.json: missing mappings[]");
  }
  if (!Array.isArray(parsed.protected_class_proxies)) {
    throw new Error("reason-code-dictionary.json: missing protected_class_proxies[]");
  }
  _cached = parsed;
  return parsed;
}


/**
 * Reject an adverse-action code list if any code isn't backed by the
 * dictionary. Callers should invoke this at the output boundary of
 * runLoanCouncil — same layer as enforceAnalysisOnly() in
 * audit-guardrail.js.
 *
 * @param {Array<string>} aaCodes — e.g. ["AA01", "AA04"]
 * @returns {{ok: boolean, invalid: string[], reason: string}}
 */
export function enforceReasonCodesInDictionary(aaCodes) {
  if (!Array.isArray(aaCodes) || aaCodes.length === 0) {
    return { ok: true, invalid: [], reason: "no codes to validate" };
  }
  const dict = loadReasonCodeDictionary();
  const validCodes = new Set(
    dict.mappings.map((m) => m.aa_code).filter(Boolean),
  );
  const invalid = aaCodes.filter((c) => !validCodes.has(c));
  if (invalid.length > 0) {
    return {
      ok: false,
      invalid,
      reason:
        `Adverse-action code(s) ${invalid.join(", ")} not backed by ` +
        `signed reason-code dictionary. Per CFPB Circular 2022-03, ` +
        `denials cannot cite reasons the creditor cannot explain.`,
    };
  }
  return { ok: true, invalid: [], reason: "all codes in dictionary" };
}


/**
 * Reject a feature list if any feature is on the protected-class
 * proxy blocklist. Defends the "no proxy for protected class" claim.
 *
 * @param {Array<string>} featureList — e.g. ["credit_score", "zipcode"]
 * @returns {{ok: boolean, prohibited: string[], reason: string}}
 */
export function enforceNoProtectedClassProxies(featureList) {
  if (!Array.isArray(featureList) || featureList.length === 0) {
    return { ok: true, prohibited: [], reason: "no features to check" };
  }
  const dict = loadReasonCodeDictionary();
  const blocklist = new Set(dict.protected_class_proxies);
  const prohibited = featureList.filter((f) => blocklist.has(f));
  if (prohibited.length > 0) {
    return {
      ok: false,
      prohibited,
      reason:
        `Features ${prohibited.join(", ")} are on the protected-class ` +
        `proxy blocklist. Denials citing these features expose the ` +
        `institution to ECOA disparate-treatment liability regardless ` +
        `of the 2026-07-21 disparate-impact rule narrowing.`,
    };
  }
  return { ok: true, prohibited: [], reason: "no protected proxies cited" };
}


/**
 * Get the borrower-readable text for a specific AA code. Used to
 * generate the adverse-action notice text that goes to the borrower.
 * Returns null if the code isn't in the dictionary.
 */
export function getBorrowerReadableForCode(aaCode) {
  const dict = loadReasonCodeDictionary();
  const row = dict.mappings.find((m) => m.aa_code === aaCode);
  return row ? (row.borrower_readable || null) : null;
}


/**
 * Get the Reg B category for a specific AA code. Used for auditor
 * reports that group denials by Reg B category.
 */
export function getRegBCategoryForCode(aaCode) {
  const dict = loadReasonCodeDictionary();
  const row = dict.mappings.find((m) => m.aa_code === aaCode);
  return row ? (row.reg_b_category || null) : null;
}


// For tests that need to reset the cache
export function _clearCache() {
  _cached = null;
}
