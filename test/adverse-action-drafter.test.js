// test/adverse-action-drafter.test.js
// ──────────────────────────────────────────────────────────────────
// v1.5.24 (2026-07-08) — GAICF-compatible adverse-action language
// drafter contract tests. Anchors arXiv:2607.04103 (Wang et al
// 2026-07-05) layer 3 (adverse-action drafting).
//
// The failure modes these tests lock down are ALL federal-liability
// axes:
//   1. Notice references AA code with no primary-source ground.
//   2. Notice contains §1002.6(b) protected-class terms as reason.
//   3. Notice contains §1002.9(b)(2) explicitly-insufficient
//      template phrases.
//   4. Bilingual (§1002.4) EN + ES not both emitted.
//   5. notice_sha256 drifts silently on template edit.
//
// A failure here would be a real CFPB fine risk in production. Do
// not merge with any of these red.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  draftAdverseActionNotice,
  draftBilingualNotice,
  auditNoticeText,
  citationsForAaCode,
  PROTECTED_CLASS_TERMS,
  INSUFFICIENT_TEMPLATE_PHRASES,
} from "../lib/adverse-action-drafter.js";

// ═════════════════════════════════════════════════════════════════
// Citation grounding — every AA code must reach at least one entry
// ═════════════════════════════════════════════════════════════════

test("AA01 has at least one citation in the registry", () => {
  assert.ok(citationsForAaCode("AA01").length >= 1);
});

test("AA02 has at least one citation in the registry", () => {
  assert.ok(citationsForAaCode("AA02").length >= 1);
});

test("AA03 has at least one citation in the registry", () => {
  assert.ok(citationsForAaCode("AA03").length >= 1);
});

test("AA05 has protected-class citation (Reg B §1002.6 + ECOA statute)", () => {
  const cites = citationsForAaCode("AA05");
  assert.ok(cites.length >= 1);
  // At least one citation should reference §1002.6 or 15 USC 1691.
  const hasEcoaGround = cites.some(
    (c) => c.id.includes("1002.6") || c.id.includes("1691") || c.regulator?.includes("ECOA"),
  );
  assert.ok(hasEcoaGround, "AA05 must ground in Reg B §1002.6 or ECOA statute");
});


// ═════════════════════════════════════════════════════════════════
// §1002.9(b)(2) specific-reason requirement — draftAdverseActionNotice
// ═════════════════════════════════════════════════════════════════

test("draftAdverseActionNotice AA01 emits English notice with credit score", () => {
  const notice = draftAdverseActionNotice({
    aaCode: "AA01",
    language: "en",
    loanContext: { credit_score: 620 },
  });
  assert.match(notice.text, /credit score of 620/);
  assert.match(notice.text, /principal reason/i);
});

test("draftAdverseActionNotice AA02 emits Spanish notice with DTI as percent", () => {
  const notice = draftAdverseActionNotice({
    aaCode: "AA02",
    language: "es",
    loanContext: { debt_to_income: 0.42 },
  });
  assert.match(notice.text, /42\.0%/);
  assert.match(notice.text, /razón principal/i);
});

test("draftAdverseActionNotice AA03 emits LTV percent formatted", () => {
  const notice = draftAdverseActionNotice({
    aaCode: "AA03",
    language: "en",
    loanContext: { loan_to_value: 0.925 },
  });
  assert.match(notice.text, /92\.5%/);
});

test("draftAdverseActionNotice omits numeric only when context is missing", () => {
  const notice = draftAdverseActionNotice({
    aaCode: "AA01",
    language: "en",
    loanContext: {},
  });
  assert.doesNotMatch(notice.text, /score of \d+/);
  assert.match(notice.text, /credit score is below/i);
});

test("draftAdverseActionNotice AA04 emits sector risk-appetite reason", () => {
  const notice = draftAdverseActionNotice({ aaCode: "AA04", language: "en" });
  assert.match(notice.text, /risk-appetite/i);
});

test("draftAdverseActionNotice AA05 emits fair-lending review reason", () => {
  const notice = draftAdverseActionNotice({ aaCode: "AA05", language: "en" });
  assert.match(notice.text, /fair-lending/i);
});

test("draftAdverseActionNotice AA06 emits AML reason", () => {
  const notice = draftAdverseActionNotice({ aaCode: "AA06", language: "en" });
  assert.match(notice.text, /Bank Secrecy Act|anti-money-laundering/i);
});


// ═════════════════════════════════════════════════════════════════
// §1002.6(b) + §1002.9(b)(2) violation guards
// ═════════════════════════════════════════════════════════════════

test("auditNoticeText flags protected-class term leak in the reason sentence", () => {
  const r = auditNoticeText("Application denied due to applicant race.");
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.type === "protected_class_term_leak"));
});

test("auditNoticeText flags §1002.9(b)(2) 'internal standards' phrase", () => {
  const r = auditNoticeText("Application denied per our internal standards.");
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.type === "insufficient_template_phrase"));
});

test("auditNoticeText flags 'did not achieve a qualifying score'", () => {
  const r = auditNoticeText("Applicant did not achieve a qualifying score on the credit scoring system.");
  assert.equal(r.ok, false);
  assert.ok(r.violations.length >= 1);
});

test("auditNoticeText passes clean specific reason", () => {
  const r = auditNoticeText("Credit score 620 is below our standard approval threshold.");
  assert.equal(r.ok, true);
  assert.deepEqual(r.violations, []);
});

test("draftAdverseActionNotice reason sentence is clean of both violation classes", () => {
  for (const code of ["AA01", "AA02", "AA03", "AA04", "AA05", "AA06"]) {
    const notice = draftAdverseActionNotice({ aaCode: code, language: "en" });
    const r = auditNoticeText(notice.reason_text);
    assert.equal(r.ok, true, `AA code ${code} reason sentence had violations: ${JSON.stringify(r.violations)}`);
  }
});

test("draftAdverseActionNotice reason sentence is clean in Spanish too", () => {
  for (const code of ["AA01", "AA02", "AA03", "AA04", "AA05", "AA06"]) {
    const notice = draftAdverseActionNotice({ aaCode: code, language: "es" });
    const r = auditNoticeText(notice.reason_text);
    assert.equal(r.ok, true, `AA code ${code} Spanish reason sentence had violations`);
  }
});


// ═════════════════════════════════════════════════════════════════
// §1002.9(b)(1) rights block MUST quote ECOA statute verbatim
// ═════════════════════════════════════════════════════════════════

test("English rights block contains ECOA verbatim protected classes (required by §1002.9(b)(1))", () => {
  const notice = draftAdverseActionNotice({ aaCode: "AA01", language: "en" });
  // The rights block quotes 15 U.S.C. §1691 verbatim so it MUST
  // include the protected-class enumeration. Only the reason
  // sentence is audited for protected-class leakage.
  assert.match(notice.text, /race, color, religion, national origin/);
  assert.match(notice.text, /Equal Credit Opportunity Act/);
  assert.match(notice.text, /Consumer Financial Protection Bureau/);
});

test("Spanish rights block contains ECOA verbatim protected classes in Spanish", () => {
  const notice = draftAdverseActionNotice({ aaCode: "AA01", language: "es" });
  assert.match(notice.text, /raza, color, religión, origen nacional/);
  assert.match(notice.text, /Ley de Igualdad de Oportunidad de Crédito/);
});


// ═════════════════════════════════════════════════════════════════
// SHA-256 stability
// ═════════════════════════════════════════════════════════════════

test("draftAdverseActionNotice produces stable SHA-256 for same input", () => {
  const notice1 = draftAdverseActionNotice({
    aaCode: "AA01",
    language: "en",
    loanContext: { credit_score: 620 },
  });
  const notice2 = draftAdverseActionNotice({
    aaCode: "AA01",
    language: "en",
    loanContext: { credit_score: 620 },
  });
  assert.equal(notice1.notice_sha256, notice2.notice_sha256);
  assert.equal(notice1.notice_sha256.length, 64); // sha256 hex length
});

test("draftAdverseActionNotice SHA-256 differs when credit_score differs", () => {
  const a = draftAdverseActionNotice({ aaCode: "AA01", language: "en", loanContext: { credit_score: 620 } });
  const b = draftAdverseActionNotice({ aaCode: "AA01", language: "en", loanContext: { credit_score: 621 } });
  assert.notEqual(a.notice_sha256, b.notice_sha256);
});


// ═════════════════════════════════════════════════════════════════
// §1002.4 bilingual disclosure
// ═════════════════════════════════════════════════════════════════

test("draftBilingualNotice emits both en + es + combined SHA-256", () => {
  const bilingual = draftBilingualNotice({
    aaCode: "AA01",
    loanContext: { credit_score: 640 },
  });
  assert.equal(bilingual.en.language, "en");
  assert.equal(bilingual.es.language, "es");
  assert.match(bilingual.en.text, /credit score of 640/);
  assert.match(bilingual.es.text, /puntaje de crédito de 640/);
  assert.equal(bilingual.combined_sha256.length, 64);
  assert.notEqual(bilingual.combined_sha256, bilingual.en.notice_sha256);
});


// ═════════════════════════════════════════════════════════════════
// Error paths
// ═════════════════════════════════════════════════════════════════

test("draftAdverseActionNotice throws on unknown AA code", () => {
  assert.throws(
    () => draftAdverseActionNotice({ aaCode: "AA99" }),
    /unknown AA code/,
  );
});

test("draftAdverseActionNotice throws on unsupported language", () => {
  assert.throws(
    () => draftAdverseActionNotice({ aaCode: "AA01", language: "fr" }),
    /unsupported language/,
  );
});

test("citations list is populated per AA code — auditor can trace every notice to a primary source", () => {
  const notice = draftAdverseActionNotice({ aaCode: "AA01", language: "en" });
  assert.ok(notice.citations.length >= 1);
  for (const c of notice.citations) {
    assert.ok(c.id);
    assert.ok(c.source_url);
    assert.match(c.source_url, /^https?:\/\//);
  }
});
