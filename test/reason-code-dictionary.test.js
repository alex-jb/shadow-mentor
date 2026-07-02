// test/reason-code-dictionary.test.js
// ──────────────────────────────────────────────────────────────────
// Pins the reason-code dictionary + guardrail contract shipped
// 2026-07-02 for post-2026-07-21 Reg B compliance.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  loadReasonCodeDictionary,
  enforceReasonCodesInDictionary,
  enforceNoProtectedClassProxies,
  getBorrowerReadableForCode,
  getRegBCategoryForCode,
} from "../lib/enforce-reason-code-dictionary.js";


// ═══════════════════════════════════════════════════════════════
// Dictionary structure
// ═══════════════════════════════════════════════════════════════

test("dictionary has schema_version", () => {
  const dict = loadReasonCodeDictionary();
  assert.ok(dict.schema_version);
  assert.ok(dict.schema_version.startsWith("reason-code-dictionary/"));
});


test("dictionary has all AA01-06 mappings", () => {
  const dict = loadReasonCodeDictionary();
  const codes = dict.mappings.map((m) => m.aa_code).sort();
  // AA06 (AML/KYC) added 2026-07-02 alongside the AML/KYC voice.
  assert.deepEqual(codes, ["AA01", "AA02", "AA03", "AA04", "AA05", "AA06"]);
});


test("every mapping row has feature + threshold_field + reg_b_category", () => {
  const dict = loadReasonCodeDictionary();
  for (const row of dict.mappings) {
    assert.ok(row.feature, `${row.aa_code} missing feature`);
    assert.ok(row.threshold_field, `${row.aa_code} missing threshold_field`);
    assert.ok(row.reg_b_category, `${row.aa_code} missing reg_b_category`);
    assert.ok(row.source_document, `${row.aa_code} missing source_document`);
  }
});


test("dictionary has protected_class_proxies blocklist", () => {
  const dict = loadReasonCodeDictionary();
  assert.ok(Array.isArray(dict.protected_class_proxies));
  // ECOA protected classes must be present
  const proxies = new Set(dict.protected_class_proxies);
  for (const req of ["zipcode", "age", "sex", "race", "religion",
                     "national_origin", "marital_status"]) {
    assert.ok(proxies.has(req), `blocklist missing ${req}`);
  }
});


test("dictionary has signature placeholder for bank counsel sign-off", () => {
  const dict = loadReasonCodeDictionary();
  assert.ok(dict.signature);
  assert.ok(dict.signature.signer_name);
});


// ═══════════════════════════════════════════════════════════════
// enforceReasonCodesInDictionary
// ═══════════════════════════════════════════════════════════════

test("valid AA codes pass enforcement", () => {
  const result = enforceReasonCodesInDictionary(["AA01", "AA02"]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.invalid, []);
});


test("invalid AA code fails enforcement", () => {
  const result = enforceReasonCodesInDictionary(["AA01", "AA99_MADE_UP"]);
  assert.equal(result.ok, false);
  assert.deepEqual(result.invalid, ["AA99_MADE_UP"]);
  assert.match(result.reason, /not backed by signed reason-code dictionary/);
  // Must cite the CFPB circular for auditor
  assert.match(result.reason, /Circular 2022-03/);
});


test("empty AA code list is a no-op pass", () => {
  const result = enforceReasonCodesInDictionary([]);
  assert.equal(result.ok, true);
});


test("null AA codes is a no-op pass", () => {
  const result = enforceReasonCodesInDictionary(null);
  assert.equal(result.ok, true);
});


// ═══════════════════════════════════════════════════════════════
// enforceNoProtectedClassProxies
// ═══════════════════════════════════════════════════════════════

test("legitimate features pass proxy check", () => {
  const result = enforceNoProtectedClassProxies([
    "credit_score", "debt_to_income", "loan_to_value",
  ]);
  assert.equal(result.ok, true);
});


test("zipcode feature fails proxy check", () => {
  const result = enforceNoProtectedClassProxies([
    "credit_score", "zipcode",
  ]);
  assert.equal(result.ok, false);
  assert.deepEqual(result.prohibited, ["zipcode"]);
  assert.match(result.reason, /protected-class proxy blocklist/);
  // Must mention that this is still an issue post-2026-07-21
  assert.match(result.reason, /2026-07-21/);
});


test("age feature fails proxy check", () => {
  const result = enforceNoProtectedClassProxies(["age"]);
  assert.equal(result.ok, false);
  assert.deepEqual(result.prohibited, ["age"]);
});


test("multiple protected proxies all reported", () => {
  const result = enforceNoProtectedClassProxies([
    "credit_score", "zipcode", "age", "religion",
  ]);
  assert.equal(result.ok, false);
  assert.deepEqual(result.prohibited.sort(), ["age", "religion", "zipcode"]);
});


// ═══════════════════════════════════════════════════════════════
// Lookup helpers for borrower-facing notice generation
// ═══════════════════════════════════════════════════════════════

test("borrower-readable text is retrievable for AA01", () => {
  const text = getBorrowerReadableForCode("AA01");
  assert.ok(text);
  assert.match(text, /credit score/i);
});


test("borrower-readable text handles unknown code gracefully", () => {
  const text = getBorrowerReadableForCode("AA_NONEXISTENT");
  assert.equal(text, null);
});


test("Reg B category is retrievable for AA02", () => {
  const cat = getRegBCategoryForCode("AA02");
  assert.equal(cat, "Income + debts");
});


test("Reg B category returns null for unknown code", () => {
  const cat = getRegBCategoryForCode("AA_NONEXISTENT");
  assert.equal(cat, null);
});
