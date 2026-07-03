// test/persona-schema.test.js
// ──────────────────────────────────────────────────────────────────
// Pins the persona L1/L2/L3 schema contract shipped 2026-07-02.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  loadPersonaSchema,
  getVoiceLayers,
  listVoiceNames,
  verifyL3AgainstLoanDefaults,
} from "../lib/persona-schema.js";
import { LOAN_DEFAULTS } from "../lib/schemas/loan.js";


// ═══════════════════════════════════════════════════════════════
// Structural
// ═══════════════════════════════════════════════════════════════

test("schema has L1_universal + voices{}", () => {
  const s = loadPersonaSchema();
  assert.ok(s.L1_universal);
  assert.ok(Array.isArray(s.L1_universal.principles));
  assert.ok(typeof s.voices === "object");
});


test("schema cites SR 26-2 (retire SR 11-7)", () => {
  const s = loadPersonaSchema();
  assert.match(s.regulatory_frame, /SR 26-2/);
});


test("L1 principles include never-take-irreversible-actions", () => {
  const s = loadPersonaSchema();
  const combined = s.L1_universal.principles.join(" ").toLowerCase();
  assert.match(combined, /irreversible/);
  assert.match(combined, /clarification/);
});


test("L1 principles cite CFPB Circular 2022-03", () => {
  const s = loadPersonaSchema();
  const combined = s.L1_universal.principles.join(" ");
  assert.match(combined, /2022-03/);
});


// ═══════════════════════════════════════════════════════════════
// Coverage — every runtime voice is in the schema
// ═══════════════════════════════════════════════════════════════

test("schema covers all 6 canonical voice names", () => {
  const names = listVoiceNames().sort();
  assert.deepEqual(names, [
    "AML/KYC Investigator",
    "Credit Fundamentals",
    "Customer Advocate",
    "Fair Lending Compliance",
    "Macro Contrarian",
    "Risk Officer",
  ]);
});


test("every voice has L2_voice_role", () => {
  const s = loadPersonaSchema();
  for (const [name, v] of Object.entries(s.voices)) {
    assert.ok(v.L2_voice_role, `${name} missing L2_voice_role`);
    assert.ok(v.L2_voice_role.role_summary, `${name} missing role_summary`);
    assert.ok(Array.isArray(v.L2_voice_role.principles),
      `${name} L2 principles must be array`);
  }
});


test("every voice has L3_thresholds with source_document", () => {
  const s = loadPersonaSchema();
  for (const [name, v] of Object.entries(s.voices)) {
    assert.ok(v.L3_thresholds, `${name} missing L3_thresholds`);
    assert.ok(v.L3_thresholds.source_document,
      `${name} L3 missing source_document`);
  }
});


test("every voice has adverse_action_codes array", () => {
  const s = loadPersonaSchema();
  for (const [name, v] of Object.entries(s.voices)) {
    assert.ok(Array.isArray(v.adverse_action_codes),
      `${name} adverse_action_codes must be array`);
  }
});


// ═══════════════════════════════════════════════════════════════
// getVoiceLayers helper
// ═══════════════════════════════════════════════════════════════

test("getVoiceLayers returns full triple for Credit Fundamentals", () => {
  const layers = getVoiceLayers("Credit Fundamentals");
  assert.ok(layers.L1);
  assert.ok(layers.L2);
  assert.ok(layers.L3);
  assert.equal(layers.L3.fico_approve_floor, 700);
  assert.deepEqual(layers.adverse_action_codes, ["AA01", "AA02"]);
});


test("getVoiceLayers returns AML voice with regulatory frame", () => {
  const layers = getVoiceLayers("AML/KYC Investigator");
  assert.ok(layers.L2);
  const principles = layers.L2.principles.join(" ");
  assert.match(principles, /OFAC/);
  assert.match(principles, /PATRIOT/);
  assert.match(principles, /FinCEN/);
});


test("getVoiceLayers returns null for unknown voice", () => {
  assert.equal(getVoiceLayers("Nonexistent Persona"), null);
});


// ═══════════════════════════════════════════════════════════════
// Drift detection — schema must match runtime
// ═══════════════════════════════════════════════════════════════

test("schema L3 thresholds match runtime LOAN_DEFAULTS", () => {
  const result = verifyL3AgainstLoanDefaults(LOAN_DEFAULTS);
  assert.equal(result.ok, true, `mismatches: ${JSON.stringify(result.mismatches)}`);
  assert.ok(result.checked_count >= 4, "should check at least FICO/DTI/LTV/VaR");
});


test("schema drift detected when LOAN_DEFAULTS changes", () => {
  const tamperedDefaults = { ...LOAN_DEFAULTS, fico_approve_floor: 999 };
  const result = verifyL3AgainstLoanDefaults(tamperedDefaults);
  assert.equal(result.ok, false);
  const ficoMismatch = result.mismatches.find(
    (m) => m.field === "fico_approve_floor",
  );
  assert.ok(ficoMismatch);
  assert.equal(ficoMismatch.schema_value, 700);
  assert.equal(ficoMismatch.runtime_value, 999);
});


test("every voice's AA codes are backed by reason-code dictionary", async () => {
  // Verify each AA code named in the persona schema is a real code
  // in the reason-code dictionary (drift would mean an audit claim
  // about a code that doesn't exist).
  const { loadReasonCodeDictionary } = await import(
    "../lib/enforce-reason-code-dictionary.js"
  );
  const dict = loadReasonCodeDictionary();
  const validCodes = new Set(dict.mappings.map((m) => m.aa_code));
  const s = loadPersonaSchema();
  for (const [name, v] of Object.entries(s.voices)) {
    for (const code of v.adverse_action_codes) {
      assert.ok(validCodes.has(code),
        `Voice ${name} claims AA code ${code} but dictionary has no such row`);
    }
  }
});
