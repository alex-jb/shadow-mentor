// lib/adverse-action-drafter.js
// ──────────────────────────────────────────────────────────────────
// v1.5.24 (2026-07-08): GAICF-compatible adverse-action language
// drafter. Layer 3 of the Wang et al 2026-07-05 arXiv:2607.04103
// GAICF (Generative AI Control Framework) proposal for SR 26-2
// Tier 3 GenAI systems.
//
// Why this exists
// ---------------
// Shadow ships GAICF layers 1 (monitoring-interpretation controls,
// via the 5-voice council + verdict-invariance tests) and 2 (policy
// analysis workflows, via `runLoanCouncil` + the risk-tools). Layer
// 3 in the paper is "adverse-action language drafting mechanisms"
// and Shadow didn't have it. Bank counsel had to draft the notice
// separately from Shadow's verdict, which is where the largest
// CFPB liability tail sits (§1002.9(b)(2) failures).
//
// This module turns an AA01-AA06 code emitted by `run-loan-council`
// into a §1002.9(b)(2)-compliant notice text, grounded in the
// citation registry so every sentence traces to a primary source
// bank counsel can pin.
//
// Design rules — verbatim from §1002.9(b)(2)
// -------------------------------------------
// The section requires:
//   1. **Specific reasons.** Template phrases like "internal
//      standards" or "did not meet our credit scoring policy" are
//      explicitly INSUFFICIENT per the CFR text quoted in
//      `citation-registry.json:12CFR1002.9(b)(2)`.
//   2. **Principal reason.** The notice must state the primary
//      reason, not the exhaustive list.
//   3. **Bilingual disclosure** (§1002.4 CFPB bilingual rule).
//      Every notice ships in English + Spanish.
//   4. **No protected-class term leakage.** Per §1002.6(b) the
//      notice may not contain any of the ECOA-enumerated protected
//      classes as a reason. Shadow refuses to emit a notice that
//      contains any protected-class term.
//
// The Judge Card / attestation tie-in
// -----------------------------------
// Every emitted notice gets a `notice_sha256`. That hash goes into
// the attestation as `adverse_action_notice_sha256` (sixth append-
// only field). Bank counsel pins the hash in the procurement
// contract so any post-hoc softening of the notice text (e.g.
// removing a citation, vaguening a specific reason) breaks
// Ed25519 verification.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ADVERSE_ACTION_CODES } from "./schemas/adverse-action.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = join(__dirname, "schemas", "citation-registry.json");

let _registryCache = null;
function loadRegistry() {
  if (_registryCache) return _registryCache;
  const raw = JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
  _registryCache = raw;
  return raw;
}

/**
 * §1002.6(b) protected-class enumeration. If a notice text contains
 * ANY of these terms, the drafter refuses to emit — because doing
 * so would violate §1002.6(b) prohibiting protected-class terms
 * from appearing in the reason.
 */
export const PROTECTED_CLASS_TERMS = Object.freeze([
  "race",
  "color",
  "religion",
  "national origin",
  "sex",
  "gender",
  "marital status",
  "age",
  "public assistance",
  "receipt of income from any public assistance program",
]);

/**
 * §1002.9(b)(2) explicitly-insufficient template phrases. If a
 * notice text contains ANY of these phrases the drafter refuses to
 * emit, because the CFR itself says these phrases are insufficient.
 */
export const INSUFFICIENT_TEMPLATE_PHRASES = Object.freeze([
  "internal standards",
  "internal policies",
  "internal policy",
  "did not achieve a qualifying score",
  "credit scoring system",
]);

/**
 * Localized reason strings per AA code + language. Each string is
 * a specific, principal reason — NOT a template phrase. The
 * numeric-blank slots are filled in from the loan context if
 * available; otherwise the notice ships with the generic reason.
 */
const REASON_TEMPLATES = Object.freeze({
  AA01: {
    en: (ctx) =>
      ctx.credit_score != null
        ? `Your credit score of ${ctx.credit_score} is below our standard approval threshold for this product.`
        : "Your credit score is below our standard approval threshold for this product.",
    es: (ctx) =>
      ctx.credit_score != null
        ? `Su puntaje de crédito de ${ctx.credit_score} está por debajo de nuestro umbral de aprobación estándar para este producto.`
        : "Su puntaje de crédito está por debajo de nuestro umbral de aprobación estándar para este producto.",
  },
  AA02: {
    en: (ctx) =>
      ctx.debt_to_income != null
        ? `Your debt-to-income ratio of ${(ctx.debt_to_income * 100).toFixed(1)}% exceeds our standard eligibility threshold for this product.`
        : "Your debt-to-income ratio exceeds our standard eligibility threshold for this product.",
    es: (ctx) =>
      ctx.debt_to_income != null
        ? `Su relación deuda-ingreso de ${(ctx.debt_to_income * 100).toFixed(1)}% supera nuestro umbral de elegibilidad estándar para este producto.`
        : "Su relación deuda-ingreso supera nuestro umbral de elegibilidad estándar para este producto.",
  },
  AA03: {
    en: (ctx) =>
      ctx.loan_to_value != null
        ? `Your loan-to-value ratio of ${(ctx.loan_to_value * 100).toFixed(1)}% exceeds our standard collateral coverage requirement for this product.`
        : "Your loan-to-value ratio exceeds our standard collateral coverage requirement for this product.",
    es: (ctx) =>
      ctx.loan_to_value != null
        ? `Su relación préstamo-valor de ${(ctx.loan_to_value * 100).toFixed(1)}% supera nuestro requisito estándar de cobertura de garantía para este producto.`
        : "Su relación préstamo-valor supera nuestro requisito estándar de cobertura de garantía para este producto.",
  },
  AA04: {
    en: () =>
      "The requested transaction exceeds our current portfolio risk-appetite threshold for this sector and rating.",
    es: () =>
      "La transacción solicitada supera nuestro umbral actual de apetito de riesgo de cartera para este sector y calificación.",
  },
  AA05: {
    en: () =>
      "Additional fair-lending review is required before a final decision on your application can be issued.",
    es: () =>
      "Se requiere una revisión adicional de préstamos justos antes de emitir una decisión final sobre su solicitud.",
  },
  AA06: {
    en: () =>
      "Your application requires additional review under Bank Secrecy Act / anti-money-laundering procedures before a decision can be issued.",
    es: () =>
      "Su solicitud requiere una revisión adicional bajo los procedimientos de la Ley de Secreto Bancario y prevención de lavado de dinero antes de emitir una decisión.",
  },
});

/**
 * Boilerplate rights-notification language required by §1002.9(a)
 * (right to a statement of specific reasons) + §1002.9(b)(1) (name
 * + address of the creditor that took adverse action). Ships in both
 * languages verbatim.
 */
const RIGHTS_BLOCK = Object.freeze({
  en: [
    "You have the right to a statement of the specific reasons for this decision under the Equal Credit Opportunity Act (15 U.S.C. §1691).",
    "The Federal Equal Credit Opportunity Act prohibits creditors from discriminating against credit applicants on the basis of race, color, religion, national origin, sex, marital status, or age (provided the applicant has the capacity to contract); because all or part of the applicant's income derives from any public assistance program; or because the applicant has in good faith exercised any right under the Consumer Credit Protection Act.",
    "The federal agency that administers compliance with this law concerning this creditor is the Consumer Financial Protection Bureau, 1700 G Street NW, Washington, DC 20552.",
  ].join(" "),
  es: [
    "Usted tiene derecho a una declaración de las razones específicas de esta decisión bajo la Ley de Igualdad de Oportunidad de Crédito (15 U.S.C. §1691).",
    "La Ley Federal de Igualdad de Oportunidad de Crédito prohíbe a los acreedores discriminar contra los solicitantes de crédito por motivos de raza, color, religión, origen nacional, sexo, estado civil o edad (siempre que el solicitante tenga capacidad para contratar); porque la totalidad o parte de los ingresos del solicitante proviene de cualquier programa de asistencia pública; o porque el solicitante ha ejercido de buena fe cualquier derecho bajo la Ley de Protección de Crédito al Consumidor.",
    "La agencia federal que administra el cumplimiento de esta ley con respecto a este acreedor es la Oficina de Protección Financiera del Consumidor, 1700 G Street NW, Washington, DC 20552.",
  ].join(" "),
});

/**
 * Given an AA code, return the citation-registry entries whose
 * `valid_for_aa_codes` list includes that code. This is what
 * grounds every sentence in a primary source — the drafter refuses
 * to emit a notice for a code with zero matching citations.
 */
export function citationsForAaCode(aaCode, registry = loadRegistry()) {
  if (!registry || !registry.citations) return [];
  return Object.values(registry.citations).filter((c) =>
    Array.isArray(c.valid_for_aa_codes) && c.valid_for_aa_codes.includes(aaCode)
  );
}

/**
 * Verify a notice text contains no §1002.6(b) protected-class terms
 * and no §1002.9(b)(2) explicitly-insufficient template phrases.
 * Returns { ok, violations: [{type, term}] }.
 */
function _escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function auditNoticeText(text) {
  const violations = [];
  const lower = String(text || "").toLowerCase();
  for (const term of PROTECTED_CLASS_TERMS) {
    // Word-boundary match. Otherwise "age" matches inside "coverage",
    // "collateral" would match inside anything with "color" adjacent
    // to letters, etc. Substring matching was over-triggering on
    // AA03 (loan-to-value coverage requirement) — a false positive
    // that would block a legitimate notice.
    const re = new RegExp(`\\b${_escapeRegex(term)}\\b`, "i");
    if (re.test(lower)) {
      violations.push({ type: "protected_class_term_leak", term });
    }
  }
  for (const phrase of INSUFFICIENT_TEMPLATE_PHRASES) {
    if (lower.includes(phrase)) {
      violations.push({ type: "insufficient_template_phrase", term: phrase });
    }
  }
  return { ok: violations.length === 0, violations };
}

/**
 * Draft the adverse-action notice for a given AA code + loan
 * context. Emits { text, citations, language, aa_code, notice_sha256 }.
 *
 * The `notice_sha256` covers the exact notice text bytes so a
 * downstream attestation can bind the notice into the Ed25519
 * signing payload.
 *
 * The RIGHTS_BLOCK contains "race, color, religion, ..." because
 * §1002.9(b)(1) requires quoting the ECOA anti-discrimination
 * language verbatim in the notice. `auditNoticeText()` is scoped
 * to just the reason sentence (via `reasonText`) so it doesn't
 * false-positive on the mandated rights language.
 */
export function draftAdverseActionNotice({
  aaCode,
  language = "en",
  loanContext = {},
  registry = null,
} = {}) {
  if (!aaCode || !REASON_TEMPLATES[aaCode]) {
    throw new Error(`draftAdverseActionNotice: unknown AA code "${aaCode}"`);
  }
  const lang = (language || "en").toLowerCase();
  if (lang !== "en" && lang !== "es") {
    throw new Error(`draftAdverseActionNotice: unsupported language "${language}" (only en, es)`);
  }

  // Ground: every AA code MUST have at least one citation-registry
  // entry whose valid_for_aa_codes list contains it. If not, the
  // drafter refuses to emit. This is the "no ungrounded notice"
  // invariant.
  const cites = citationsForAaCode(aaCode, registry || loadRegistry());
  if (cites.length === 0) {
    throw new Error(
      `draftAdverseActionNotice: AA code "${aaCode}" has no citation-registry entries`
    );
  }

  const reasonFn = REASON_TEMPLATES[aaCode][lang];
  const reasonText = reasonFn(loanContext);

  // Audit the reason sentence only — the rights block quotes the
  // ECOA statute verbatim so it necessarily contains protected-class
  // terms. That's not a leak, that's a §1002.9(b)(1) requirement.
  const audit = auditNoticeText(reasonText);
  if (!audit.ok) {
    throw new Error(
      `draftAdverseActionNotice: reason sentence violates §1002.6(b) or §1002.9(b)(2): ` +
      JSON.stringify(audit.violations),
    );
  }

  const openLine =
    lang === "en"
      ? "This notice is being provided to you because your application for credit was not approved."
      : "Este aviso se le proporciona porque su solicitud de crédito no fue aprobada.";

  const specificReasonHeader =
    lang === "en"
      ? "The principal reason for this decision is:"
      : "La razón principal de esta decisión es:";

  const rightsBlock = RIGHTS_BLOCK[lang];

  const text = [
    openLine,
    "",
    specificReasonHeader,
    reasonText,
    "",
    rightsBlock,
  ].join("\n");

  const notice_sha256 = createHash("sha256").update(text).digest("hex");

  return {
    aa_code: aaCode,
    aa_code_summary: ADVERSE_ACTION_CODES[aaCode] || null,
    language: lang,
    text,
    reason_text: reasonText,
    citations: cites.map((c) => ({
      id: c.id,
      title: c.title,
      part: c.part,
      section: c.section,
      subsection: c.subsection,
      regulator: c.regulator,
      source_url: c.source_url,
    })),
    notice_sha256,
  };
}

/**
 * Convenience wrapper that drafts BOTH the English + Spanish
 * notices per §1002.4 bilingual disclosure rule. Returns
 * { en, es, combined_sha256 } where combined_sha256 covers both
 * language variants so a single Ed25519 attestation field binds
 * the whole bilingual notice.
 */
export function draftBilingualNotice({ aaCode, loanContext = {} } = {}) {
  const en = draftAdverseActionNotice({ aaCode, language: "en", loanContext });
  const es = draftAdverseActionNotice({ aaCode, language: "es", loanContext });
  const combined_sha256 = createHash("sha256")
    .update(en.text)
    .update("\n---\n")
    .update(es.text)
    .digest("hex");
  return { en, es, combined_sha256, aa_code: aaCode };
}
