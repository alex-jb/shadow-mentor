// v1.5.11 — schema ↔ runtime coherence drift gates.
//
// The audit agent flagged that persona-schema.json ships as metadata
// but never fires against runtime state. Two silent-drift risks:
//
// 1. Schema L3 threshold (e.g. FICO 700) diverges from runtime LOAN_DEFAULTS
//    (e.g. someone tunes to 720 in one file, forgets the other). Bank
//    auditor sees a schema claim that no longer matches the code.
//
// 2. PERSONA_PROMPTS length caps + anchor terms drift silently — a
//    contributor edits a MAX cap or drops an ALWAYS-anchor term and
//    the next benchmark rerun regresses the Shadow Agentic Score. By
//    the time the score comes back it's too late.
//
// This suite pins both. Fires every `npm test` regardless of whether
// benchmark credits are available.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { verifyL3AgainstLoanDefaults, listVoiceNames } from "../lib/persona-schema.js";
import { LOAN_DEFAULTS } from "../lib/schemas/loan.js";
import { PERSONA_PROMPTS } from "../lib/prompts.js";

describe("schema L3 thresholds match runtime LOAN_DEFAULTS", () => {
  test("verifyL3AgainstLoanDefaults returns ok=true against current LOAN_DEFAULTS", () => {
    const result = verifyL3AgainstLoanDefaults(LOAN_DEFAULTS);
    if (!result.ok) {
      // Show every mismatch so the fix is obvious.
      const lines = result.mismatches.map((m) =>
        `  - voice=${m.voice} field=${m.field}: schema=${m.schema_value} runtime=${m.runtime_value}`
      ).join("\n");
      assert.fail(
        `persona-schema.json L3 thresholds no longer match lib/schemas/loan.js LOAN_DEFAULTS:\n${lines}\n\n` +
        "Fix: either update persona-schema.json L3 values OR revert LOAN_DEFAULTS. " +
        "These are the values a bank auditor cross-checks — schema drift means the " +
        "procurement claim silently no longer describes the code."
      );
    }
    assert.equal(result.ok, true);
    assert.ok(result.checked_count > 0, "no L3 checks fired — schema may be empty");
  });

  test("schema documents all 6 loan-council voices", () => {
    const names = listVoiceNames();
    for (const expected of [
      "Credit Fundamentals",
      "Risk Officer",
      "Fair Lending Compliance",
      "Customer Advocate",
      "Macro Contrarian",
      "AML/KYC Investigator",
    ]) {
      assert.ok(names.includes(expected),
        `persona-schema.json missing voice "${expected}"`);
    }
  });
});

describe("PERSONA_PROMPTS structural invariants (benchmark score guards)", () => {
  // The Shadow Agentic Score is highly sensitive to prompt structure.
  // Post-v0.3, the ceiling framing "HARD LIMIT: MAXIMUM X characters"
  // + persona anchor terms + "ONE sentence. No preamble." shape landed
  // the mean at 87 ± 3 (n=6). Any silent removal of these clauses
  // regresses the score. Pin them structurally so PR review catches
  // the change before the benchmark rerun.

  const PERSONA_ANCHORS = {
    compliance: /Policy/,
    quant: /SR 26-2/,   // current model-risk guidance (superseded SR 11-7, Fed 2026-04); SR 11-7 kept only as legacy alias
    engineer: /Fair Lending/,
    trader: /regime/,
    advisor: /Reg BI/,
  };

  const REQUIRED_CLAUSES = [
    /HARD LIMIT: MAXIMUM \d+ characters/,
    /ONE sentence/,
    /No preamble/,
    /No follow-up/,
    /No list/,
  ];

  for (const persona of Object.keys(PERSONA_PROMPTS)) {
    for (const seniority of ["junior", "senior", "third"]) {
      test(`${persona}/${seniority}: contains all 5 required clauses`, () => {
        const prompt = PERSONA_PROMPTS[persona][seniority];
        assert.ok(prompt, `missing prompt: ${persona}/${seniority}`);
        for (const clause of REQUIRED_CLAUSES) {
          assert.match(prompt, clause,
            `${persona}/${seniority} missing required clause: ${clause} — removing it regresses the Shadow Agentic Score`);
        }
      });

      test(`${persona}/${seniority}: contains persona anchor term`, () => {
        const anchor = PERSONA_ANCHORS[persona];
        const prompt = PERSONA_PROMPTS[persona][seniority];
        assert.match(prompt, anchor,
          `${persona}/${seniority} missing persona anchor ${anchor} — anchors are the primary signal for benchmark scoring`);
      });

      test(`${persona}/${seniority}: MAX cap within 250-360 range`, () => {
        // Cap ranges shipped in v0.3-v0.4 sweep. Escaping this range
        // means the benchmark harness assumptions no longer hold —
        // Sonnet's natural overshoot lands outside the rubric window
        // and score drops.
        const prompt = PERSONA_PROMPTS[persona][seniority];
        const m = prompt.match(/MAXIMUM (\d+) characters/);
        assert.ok(m, `${persona}/${seniority} has no MAXIMUM cap match`);
        const cap = parseInt(m[1], 10);
        assert.ok(cap >= 250 && cap <= 360,
          `${persona}/${seniority} MAX cap ${cap} outside benchmark-tuned window 250-360`);
      });
    }
  }

  test("all 5 personas × 3 seniorities × 1 prompt = 15 prompts total", () => {
    let count = 0;
    for (const p of Object.keys(PERSONA_PROMPTS)) {
      for (const s of ["junior", "senior", "third"]) {
        if (PERSONA_PROMPTS[p][s]) count++;
      }
    }
    assert.equal(count, 15,
      "persona/seniority count drift — either a prompt was deleted or a new dimension was added without wiring here");
  });
});
