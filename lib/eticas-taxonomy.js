// lib/eticas-taxonomy.js
// ──────────────────────────────────────────────────────────────────
// v1.5.40 (2026-07-08). Maps Shadow's controls to the Eticas AI Risk
// Taxonomy v2.0.0 — an open, calibrated taxonomy of 76 subcategories
// across 10 categories, with severity grades and mappings to 18
// external frameworks (NIST AI RMF, EU AI Act, ISO 42001, etc.).
//
// Anchor: arXiv:2607.02201 — "The Eticas AI Risk Taxonomy: Open
// Infrastructure for Operationalizing AI Audits" (2026-07-02).
//
// Why this matters at procurement time
// ------------------------------------
// SIEM auditors filter Shadow's test suite by regulatory citation
// (`docs/CITATION_MAP.md`). But different auditors reach for
// different taxonomies. NIST-friendly buyers want NIST AI RMF
// categories. ISO 42001 buyers want the ISO structure. Eticas is
// designed as the OPEN cross-framework taxonomy that maps ONE ROW
// into all 18 external frameworks. When Shadow tests bind to Eticas
// subcategories, auditors get "regulatory pluralism for free."
//
// The map is signed via the 12th append-only attestation field
// (`eticas_taxonomy_sha256`) so post-hoc silent widening of a
// Shadow test's claimed Eticas subcategory coverage breaks Ed25519
// verification.

import { createHash } from "node:crypto";


/**
 * Eticas v2.0.0 category names Shadow's controls map to. Not the
 * full 10-category × 76-subcategory framework — only the subset
 * Shadow actually claims coverage of. Each subcategory maps forward
 * to NIST AI RMF, EU AI Act article, ISO 42001 clause per the paper.
 */
export const ETICAS_CATEGORIES = Object.freeze({
  DISCRIMINATION_BIAS: "discrimination-and-bias",
  ROBUSTNESS_SECURITY: "robustness-and-security",
  TRANSPARENCY_EXPLAINABILITY: "transparency-and-explainability",
  ACCOUNTABILITY_GOVERNANCE: "accountability-and-governance",
  DATA_PROTECTION_PRIVACY: "data-protection-and-privacy",
  HUMAN_OVERSIGHT: "human-oversight-and-control",
  SAFETY_HARM_PREVENTION: "safety-and-harm-prevention",
});


/**
 * Eticas subcategories Shadow's tests bind to. Each subcategory has
 * a Shadow-side control (test file or lib module) + the primary
 * external framework mapping. Bank counsel picks a framework and
 * gets the Shadow coverage as a filter.
 */
export const ETICAS_SUBCATEGORY_MAP = Object.freeze({
  // Discrimination + Bias
  "protected-class-proxy-exclusion": {
    category: ETICAS_CATEGORIES.DISCRIMINATION_BIAS,
    shadow_control: "lib/enforce-reason-code-dictionary.js",
    shadow_test: "test/reason-code-dictionary.test.js",
    nist_ai_rmf: "MAP-2.3 · MEASURE-2.7",
    eu_ai_act: "Article 10 (Data Governance)",
    iso_42001: "6.1 (Actions to address risks)",
    us_reg_b: "12 CFR 1002.6(b) prohibited basis",
  },
  "adverse-action-notice-specificity": {
    category: ETICAS_CATEGORIES.DISCRIMINATION_BIAS,
    shadow_control: "lib/adverse-action-drafter.js",
    shadow_test: "test/adverse-action-drafter.test.js",
    nist_ai_rmf: "GOVERN-6.1",
    eu_ai_act: "Article 13 (Transparency for high-risk)",
    iso_42001: "8.3 (Communication)",
    us_reg_b: "12 CFR 1002.9(b)(2) specific principal reasons",
  },

  // Robustness + Security
  "adversarial-peer-defense": {
    category: ETICAS_CATEGORIES.ROBUSTNESS_SECURITY,
    shadow_control: "lib/heterogeneous-debate.js",
    shadow_test: "test/heterogeneous-debate.test.js",
    nist_ai_rmf: "MEASURE-2.7",
    eu_ai_act: "Article 15 (Accuracy, robustness, cybersecurity)",
    iso_42001: "8.4 (Robustness)",
    arxiv_anchor: "2606.19826",
  },
  "sampling-substitution-detection": {
    category: ETICAS_CATEGORIES.ROBUSTNESS_SECURITY,
    shadow_control: "lib/sampling-attestation.js",
    shadow_test: "test/sampling-attestation.test.js",
    nist_ai_rmf: "MEASURE-4.2",
    eu_ai_act: "Article 15",
    iso_42001: "8.4",
    arxiv_anchor: "2606.16121",
  },

  // Transparency + Explainability
  "audit-trail-cryptographic": {
    category: ETICAS_CATEGORIES.TRANSPARENCY_EXPLAINABILITY,
    shadow_control: "lib/attestation.js + lib/attestation-chain.js",
    shadow_test: "test/attestation.test.js + test/attestation-chain.test.js",
    nist_ai_rmf: "GOVERN-1.4 · MANAGE-3.1",
    eu_ai_act: "Article 12 (Record-keeping)",
    iso_42001: "8.6 (Record and evidence retention)",
    rfc_anchor: "RFC 8032 (Ed25519)",
  },
  "reproducibility-manifest": {
    category: ETICAS_CATEGORIES.TRANSPARENCY_EXPLAINABILITY,
    shadow_control: "lib/reproducibility.js",
    shadow_test: "test/reproducibility.test.js",
    nist_ai_rmf: "MEASURE-3.3 · MANAGE-4.1",
    eu_ai_act: "Article 12 · Article 13",
    iso_42001: "8.6",
    arxiv_anchor: "2606.08285",
  },
  "typed-claim-classification": {
    category: ETICAS_CATEGORIES.TRANSPARENCY_EXPLAINABILITY,
    shadow_control: "lib/typed-claims.js",
    shadow_test: "test/typed-claims.test.js",
    nist_ai_rmf: "MEASURE-2.5",
    eu_ai_act: "Article 13",
    iso_42001: "8.3",
    arxiv_anchor: "2605.20312",
  },

  // Accountability + Governance
  "regulatory-citation-registry": {
    category: ETICAS_CATEGORIES.ACCOUNTABILITY_GOVERNANCE,
    shadow_control: "lib/citation-registry.js",
    shadow_test: "test/citation-registry.test.js",
    nist_ai_rmf: "GOVERN-1.1 · GOVERN-1.6",
    eu_ai_act: "Article 9 (Risk management system)",
    iso_42001: "6.1.2 (Risk assessment)",
  },
  "bian-service-domain-coverage": {
    category: ETICAS_CATEGORIES.ACCOUNTABILITY_GOVERNANCE,
    shadow_control: "lib/bian-coverage.js",
    shadow_test: "test/bian-coverage.test.js",
    nist_ai_rmf: "GOVERN-1.4",
    eu_ai_act: "Article 9",
    iso_42001: "5.2 (Policy)",
    arxiv_anchor: "2607.01740",
  },
  "threat-model-systematization": {
    category: ETICAS_CATEGORIES.ACCOUNTABILITY_GOVERNANCE,
    shadow_control: "lib/refuse-to-serve.js",
    shadow_test: "test/refuse-to-serve.test.js",
    nist_ai_rmf: "MAP-5.1 · MANAGE-1.3",
    eu_ai_act: "Article 5 (Prohibited AI practices)",
    iso_42001: "6.1.2",
    arxiv_anchor: "2606.29142",
  },

  // Human Oversight
  "escalate-vs-refuse-to-serve-discretion": {
    category: ETICAS_CATEGORIES.HUMAN_OVERSIGHT,
    shadow_control: "lib/refuse-to-serve.js + lib/run-loan-council.js",
    shadow_test: "test/refuse-to-serve.test.js + test/run-loan-council.test.js",
    nist_ai_rmf: "MEASURE-2.3 · MANAGE-3.2",
    eu_ai_act: "Article 14 (Human oversight)",
    iso_42001: "8.7 (Human oversight)",
  },

  // Data Protection + Privacy
  "aml-kyc-tipping-off-defense": {
    category: ETICAS_CATEGORIES.DATA_PROTECTION_PRIVACY,
    shadow_control: "lib/aml-kyc-voice.js + lib/refuse-to-serve.js",
    shadow_test: "test/aml-kyc-voice.test.js + test/aml-kyc-adversarial.test.js",
    nist_ai_rmf: "MEASURE-2.10 · MANAGE-2.4",
    eu_ai_act: "Article 10",
    iso_42001: "8.5 (Data governance)",
    us_bsa: "31 USC 5318(g)(2)",
  },
});


/**
 * Get the Eticas subcategory row for a specific subcategory name.
 * Returns null if the subcategory is unknown.
 *
 * @param {string} subcategoryName
 * @returns {object|null}
 */
export function getEticasSubcategory(subcategoryName) {
  const row = ETICAS_SUBCATEGORY_MAP[subcategoryName];
  return row ? { ...row } : null;
}


/**
 * Get every subcategory Shadow covers within an Eticas category.
 * Used by SIEM auditors filtering by category (e.g. show me all
 * Discrimination + Bias tests).
 *
 * @param {string} categoryValue — one of ETICAS_CATEGORIES values
 * @returns {string[]} subcategory names
 */
export function getSubcategoriesInCategory(categoryValue) {
  return Object.entries(ETICAS_SUBCATEGORY_MAP)
    .filter(([_, row]) => row.category === categoryValue)
    .map(([name, _]) => name);
}


/**
 * Return the mapping in matrix form for RFP / procurement docs.
 * Each row is a Shadow test → Eticas subcategory → external
 * framework citation.
 *
 * @returns {Array<{subcategory, category, shadow_control, shadow_test, nist_ai_rmf, eu_ai_act, iso_42001}>}
 */
export function getEticasCoverageMatrix() {
  return Object.entries(ETICAS_SUBCATEGORY_MAP).map(([name, row]) => ({
    subcategory: name,
    ...row,
  }));
}


/**
 * SHA-256 commitment over the Eticas subcategory map. Bound into
 * aex-attestation/v1 as the 12th append-only field so silent
 * widening (e.g. quietly claiming coverage of an Eticas subcategory
 * without adding the underlying test) breaks Ed25519 verification.
 *
 * @returns {string} 64-char hex
 */
export function eticasTaxonomyCommitment() {
  const canonical = JSON.stringify({
    spec_version: "shadow-eticas-taxonomy/v1",
    anchor: "arXiv:2607.02201",
    eticas_version: "v2.0.0",
    map: ETICAS_SUBCATEGORY_MAP,
  });
  return createHash("sha256").update(canonical).digest("hex");
}


/**
 * Audit helper: every subcategory row MUST have shadow_control +
 * shadow_test + at least ONE external framework mapping (NIST or EU
 * or ISO). Zero-external-mapping would defeat the whole point.
 *
 * @returns {{ok: boolean, invalid_rows: string[]}}
 */
export function auditEticasCoverage() {
  const invalid = [];
  for (const [name, row] of Object.entries(ETICAS_SUBCATEGORY_MAP)) {
    if (!row.shadow_control || !row.shadow_test) {
      invalid.push(`${name}: missing shadow_control or shadow_test`);
      continue;
    }
    const hasFramework =
      row.nist_ai_rmf || row.eu_ai_act || row.iso_42001;
    if (!hasFramework) {
      invalid.push(`${name}: no external framework mapping`);
    }
  }
  return { ok: invalid.length === 0, invalid_rows: invalid };
}
