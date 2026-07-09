// lib/bian-coverage.js
// ──────────────────────────────────────────────────────────────────
// v1.5.39 (2026-07-08). Maps Shadow's 5-persona council to BIAN
// (Banking Industry Architecture Network) service domains — the
// industry-standard framing bank counsel already knows.
//
// Anchor: arXiv:2607.01740 — "Meta-Benchmarks for Financial-Services
// LLM Evaluation" (2026-07-02). Organizes 452 finance-LLM benchmarks
// into 41 O*NET Generalized Work Activities × 38 BIAN banking
// domains, Elo-scored per domain. The paper's contribution is
// treating BIAN as the ground-truth industry taxonomy for measuring
// financial-LLM coverage.
//
// Why this matters at procurement time
// ------------------------------------
// Bank counsel evaluating Shadow does NOT recognize "5-voice council
// with 10 append-only attestation fields." They DO recognize BIAN
// service domains because BIAN is the framework their core-banking
// vendors (Temenos, Finastra, TCS BaNCS) already use. Mapping Shadow
// personas to BIAN gives counsel an industry-standard entry point
// into an otherwise homegrown taxonomy.
//
// The map is signed via the 11th append-only attestation field
// (`bian_coverage_sha256`) so post-hoc silent widening of a persona's
// claimed domains (e.g. quietly asserting Compliance Officer covers
// "Fraud Detection" when it does not) breaks Ed25519 verification.

import { createHash } from "node:crypto";


/**
 * BIAN v9 service domain names used in Shadow's persona mapping.
 * We do not enumerate all 38 BIAN v9 service domains — only the ones
 * Shadow's 5 personas actually claim coverage of. Adding a new
 * domain to the map requires updating this list AND re-signing the
 * dictionary hash (bank counsel signature workflow).
 */
export const BIAN_DOMAINS = Object.freeze({
  REGULATORY_REPORTING: "Regulatory Compliance",
  FAIR_LENDING: "Fair Lending & Consumer Protection",
  CREDIT_RISK: "Credit Risk",
  CREDIT_ASSESSMENT: "Credit Assessment",
  MARKET_ANALYSIS: "Market Analysis",
  STRESS_TESTING: "Stress Testing",
  CUSTOMER_SERVICING: "Customer Servicing",
  CUSTOMER_INTERACTION: "Customer Interaction",
  AML_KYC: "AML / KYC / Sanctions Screening",
  PORTFOLIO_MANAGEMENT: "Portfolio Management",
  MODEL_RISK_MANAGEMENT: "Model Risk Management",
});


/**
 * Shadow persona → BIAN service domain(s) map.
 *
 * Every persona MUST cover ≥1 BIAN domain. Zero-coverage would mean
 * the persona has no industry-standard mapping and cannot be pinned
 * in a procurement contract.
 *
 * Ordered lists — first entry is the persona's primary domain.
 */
export const PERSONA_BIAN_MAP = Object.freeze({
  "Compliance Officer": [
    BIAN_DOMAINS.REGULATORY_REPORTING,
    BIAN_DOMAINS.FAIR_LENDING,
    BIAN_DOMAINS.MODEL_RISK_MANAGEMENT,
  ],
  "Fair Lending Compliance": [
    BIAN_DOMAINS.FAIR_LENDING,
    BIAN_DOMAINS.REGULATORY_REPORTING,
  ],
  "Credit Fundamentals": [
    BIAN_DOMAINS.CREDIT_ASSESSMENT,
    BIAN_DOMAINS.CREDIT_RISK,
  ],
  "Risk Officer": [
    BIAN_DOMAINS.CREDIT_RISK,
    BIAN_DOMAINS.PORTFOLIO_MANAGEMENT,
    BIAN_DOMAINS.MODEL_RISK_MANAGEMENT,
  ],
  "Customer Advocate": [
    BIAN_DOMAINS.CUSTOMER_SERVICING,
    BIAN_DOMAINS.CUSTOMER_INTERACTION,
  ],
  "Macro Contrarian": [
    BIAN_DOMAINS.STRESS_TESTING,
    BIAN_DOMAINS.MARKET_ANALYSIS,
  ],
  "AML/KYC Investigator": [
    BIAN_DOMAINS.AML_KYC,
    BIAN_DOMAINS.REGULATORY_REPORTING,
  ],
});


/**
 * Get the BIAN service domains a specific persona claims coverage
 * of. Returns an empty array if the persona is unknown — callers
 * should treat this as a lookup miss (not "no coverage").
 *
 * @param {string} personaName
 * @returns {string[]}
 */
export function getBianDomainsForPersona(personaName) {
  const list = PERSONA_BIAN_MAP[personaName];
  return list ? [...list] : [];
}


/**
 * Get every persona that claims coverage of a specific BIAN domain.
 * Used by bank counsel + auditors to check "which Shadow voice
 * handles CFPB adverse-action?" (answer: everyone who covers
 * FAIR_LENDING and REGULATORY_REPORTING).
 *
 * @param {string} bianDomain
 * @returns {string[]}
 */
export function getPersonasForBianDomain(bianDomain) {
  const personas = [];
  for (const [name, list] of Object.entries(PERSONA_BIAN_MAP)) {
    if (list.includes(bianDomain)) personas.push(name);
  }
  return personas;
}


/**
 * Compute the canonical SHA-256 commitment over the persona→BIAN map.
 * Bound into aex-attestation/v1 as the 11th append-only field so a
 * silent widening (e.g. quietly asserting Compliance also covers
 * "Fraud Detection") breaks Ed25519 verification.
 *
 * @returns {string} 64-char hex
 */
export function bianCoverageCommitment() {
  const canonical = JSON.stringify({
    spec_version: "shadow-bian-coverage/v1",
    map: PERSONA_BIAN_MAP,
  });
  return createHash("sha256").update(canonical).digest("hex");
}


/**
 * Audit helper: verify every persona in PERSONA_BIAN_MAP has ≥1 BIAN
 * domain assigned. Zero-coverage would mean the persona has no
 * industry-standard mapping and cannot be pinned in a procurement
 * contract. Bank counsel runs this to catch silent zero-out edits.
 *
 * @returns {{ok: boolean, empty_personas: string[]}}
 */
export function auditBianCoverage() {
  const empty = [];
  for (const [name, list] of Object.entries(PERSONA_BIAN_MAP)) {
    if (!Array.isArray(list) || list.length === 0) empty.push(name);
  }
  return { ok: empty.length === 0, empty_personas: empty };
}


/**
 * Return a matrix view of the persona→BIAN mapping. Useful for
 * generating procurement docs / BIAN_COVERAGE.md tables.
 *
 * @returns {Array<{persona: string, domains: string[], primary_domain: string}>}
 */
export function getBianCoverageMatrix() {
  return Object.entries(PERSONA_BIAN_MAP).map(([persona, domains]) => ({
    persona,
    domains: [...domains],
    primary_domain: domains[0],
  }));
}
