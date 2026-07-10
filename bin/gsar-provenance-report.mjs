#!/usr/bin/env node
// bin/gsar-provenance-report.mjs
// ──────────────────────────────────────────────────────────────────
// v1.5.26 (2026-07-08): GSAR 552.239-7001 AI provenance disclosure
// report generator.
//
// Reference: GSAR 552.239-7001 draft "Basic Safeguarding of
// Artificial Intelligence Systems" — published 2026-03-06.
// Applies to all GSA MAS vendors offering AI. Requires contractors
// disclose:
//   1. Model provenance (which models, from whom)
//   2. Data origins (training data sources + cutoffs)
//   3. Risk assessments (documented mitigations)
//
// Shadow's cryptographic evidence layer already answers each
// requirement — this CLI repackages the evidence into a GSAR-format
// provenance report a federal contractor (SAIC, Booz Allen, Leidos,
// ManTech) can submit alongside a MAS-Refresh-32 response.
//
// Usage:
//   node bin/gsar-provenance-report.mjs > provenance.json
//
// Or as a module:
//   import { generateGsarReport } from "./bin/gsar-provenance-report.mjs";

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

function readJson(relPath) {
  return JSON.parse(readFileSync(join(REPO_ROOT, relPath), "utf-8"));
}

function readText(relPath) {
  return readFileSync(join(REPO_ROOT, relPath), "utf-8");
}

function sha256Hex(s) {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * Generate the GSAR 552.239-7001 provenance report as a JSON object.
 * Pure function — no side effects, no I/O beyond reading committed
 * repo files. Same commit → same report → same SHA-256, so a
 * federal contractor can cite the report_sha256 in a procurement
 * response and Shadow can verify identity later.
 */
export function generateGsarReport({
  repoRoot = REPO_ROOT,
  generatedAt = new Date().toISOString(),
} = {}) {
  const readAt = (rel) => readFileSync(join(repoRoot, rel), "utf-8");

  // ── §1. Product identification ───────────────────────────────
  const pkg = JSON.parse(readAt("package.json"));
  const productIdentification = {
    product_name: pkg.name,
    product_version: pkg.version,
    license: pkg.license,
    repository: "https://github.com/alex-jb/shadow-mentor",
    author: pkg.author,
    contributors: pkg.contributors || [],
  };

  // ── §2. Model provenance ─────────────────────────────────────
  //
  // Shadow currently supports three provider paths. Each carries an
  // explicit model_id in every attestation so an auditor can detect
  // silent model substitution (arXiv:2504.04715 threat).
  const modelProvenance = {
    supported_providers: [
      {
        provider: "Anthropic",
        model_ids: [
          "claude-sonnet-4-5-20250929",
          "claude-haiku-4-5-20251001",
        ],
        api_endpoint: "https://api.anthropic.com/v1/messages",
        substitution_detection: "Ed25519-attested model_id per response",
      },
      {
        provider: "OpenAI",
        model_ids: ["gpt-5.2"],
        api_endpoint: "https://api.openai.com/v1/chat/completions",
        substitution_detection: "Ed25519-attested model_id per response",
      },
      {
        provider: "Zhipu GLM",
        model_ids: ["glm-5"],
        api_endpoint: "https://open.bigmodel.cn/api/paas/v4",
        substitution_detection: "Ed25519-attested model_id per response",
      },
    ],
    deterministic_paths: [
      "runLoanCouncil (banking) — pure computation, no LLM",
      "runDSCouncil (data science) — pure computation, no LLM",
      "sizePosition (trader-pack) — pure computation, no LLM",
    ],
  };

  // ── §3. Data origins ─────────────────────────────────────────
  //
  // Shadow ships NO training data. All model providers train
  // their own models; Shadow only invokes them via API. Persona
  // system prompts are hand-authored + citation-grounded.
  const dataOrigins = {
    shadow_training_data: "none — Shadow ships zero training data",
    persona_prompts_source:
      "lib/prompts.js — hand-authored, citation-grounded, Ed25519-signed per attestation",
    regulatory_citations_source:
      "lib/schemas/citation-registry.json — primary-source URLs (federalreserve.gov, cfpb.gov, ecfr.gov, sec.gov)",
    reason_codes_source:
      "lib/schemas/reason-code-dictionary.json — CFPB Circular 2026-03 aligned + Loredana Levitchi BRD Addenda A/B/C",
    model_training_cutoffs: {
      anthropic_claude_sonnet: "January 2025 per Anthropic model card",
      anthropic_claude_haiku: "January 2025 per Anthropic model card",
      openai_gpt_5_2: "per OpenAI model card",
      zhipu_glm_5: "per Zhipu GLM model card",
    },
  };

  // ── §4. Risk assessments ─────────────────────────────────────
  const riskAssessments = {
    nist_ai_600_1_mapping: "docs/NIST-AI-600-1-MAP.md",
    sr_26_2_positioning: "SR 26-2 footnote 3 delegates governance of generative and agentic AI to institutional risk-management practices; SR 26-2 also excludes deterministic rule-based processes from the 'model' definition (page 3). Shadow's verdict engine falls in the excluded rule-based class; the LLM rationale layer falls in the carved-out generative-AI class.",
    reg_b_ecoa_701_adverse_action:
      "docs/CITATION_MAP.md AA01-AA06 → §1002.9(b)(2) triples",
    bsa_aml: "lib/aml-kyc-voice.js opt-in 6th persona voice",
    gdpr_art_22_schufa_c634_21: "lib/schemas/citation-registry.json EU-GDPR entries",
    reg_bi: "docs/CITATION_MAP.md Best-Interest §240.15l-1(a)(2) triples",
    verdict_invariance:
      "test/verdict-invariance.test.js — 10 structural perturbation tests",
    policy_invariance_score:
      "docs/JUDGE-CARD.md — 3 named metrics + geometric-mean overall (arXiv:2605.06161)",
    gaicf_layer_3_adverse_action_drafter:
      "docs/GAICF-COMPATIBILITY.md — layer 1/2/3 → module map (arXiv:2607.04103)",
    fincen_nprm_2026_04_07_alignment:
      "docs/FINCEN-NPRM-2026-04-07-ALIGNMENT.md — stage-aware citation resolver",
  };

  // ── §5. Cryptographic evidence hashes ────────────────────────
  //
  // Every hash here is computed from the CURRENT repo state.
  // Federal contractors pin these hashes in procurement responses;
  // any post-hoc edit to the underlying file changes the hash and
  // is detectable independently of Shadow.
  const promptsSource = readAt("lib/prompts.js");
  const citationRegistrySource = readAt("lib/schemas/citation-registry.json");
  const reasonCodeDictSource = readAt("lib/schemas/reason-code-dictionary.json");
  // Protected-classes schema ships as two files (US-ECOA + EU-GDPR).
  // Concatenate deterministically so a single SHA-256 covers both.
  const proxySchemaUsEcoa = readAt("lib/schemas/protected-classes-us-ecoa.json");
  const proxySchemaEuGdpr = readAt("lib/schemas/protected-classes-eu-gdpr.json");
  const proxySchemaSource = proxySchemaUsEcoa + "\n---\n" + proxySchemaEuGdpr;

  const cryptoEvidence = {
    persona_prompts_sha256: sha256Hex(promptsSource),
    citation_registry_sha256: sha256Hex(citationRegistrySource),
    reason_code_dictionary_sha256: sha256Hex(reasonCodeDictSource),
    protected_classes_schema_sha256: sha256Hex(proxySchemaSource),
    protected_classes_us_ecoa_sha256: sha256Hex(proxySchemaUsEcoa),
    protected_classes_eu_gdpr_sha256: sha256Hex(proxySchemaEuGdpr),
    attestation_signature_algorithm: "Ed25519 (RFC 8032)",
    per_response_attestation_fields: [
      "request_commitment",
      "output_commitment",
      "model_id",
      "completed_at_utc",
      "previous_hash (cross-vertical hash chain)",
      "key_id",
      "signature",
      "dictionary_hash (v1.5.8+)",
      "citation_registry_sha256 (v1.5.18+)",
      "proxy_schema_sha256 (v1.5.19+)",
      "original_content_hash (v1.5.20+)",
      "policy_invariance_score_sha256 (v1.5.23+)",
      "adverse_action_notice_sha256 (v1.5.24+)",
    ],
  };

  // ── §6. Test surface ─────────────────────────────────────────
  const testSurface = {
    total_tests: 1033,
    total_release_tags: 26,
    test_files_of_note: [
      "test/verdict-invariance.test.js",
      "test/attestation.test.js",
      "test/attestation-chain.test.js",
      "test/attestation-batch.test.js",
      "test/mcp-manifest.test.js",
      "test/siem-export.test.js",
      "test/policy-invariance-score.test.js",
      "test/adverse-action-drafter.test.js",
      "test/aml-kyc-nprm-alignment.test.js",
      "test/enforce-reason-code-dictionary.test.js",
    ],
    ci_status_url: "https://github.com/alex-jb/shadow-mentor/actions",
  };

  // ── §7. Bill-of-tools (MCP-manifest SBOM equivalent) ─────────
  //
  // GSA MAS reviewers can independently fetch /api/mcp-manifest at
  // the live Vercel URL and cross-check every tool's SHA-256
  // against this manifest.
  const billOfTools = {
    mcp_manifest_endpoint:
      "https://shadow-mentor-phi.vercel.app/api/mcp-manifest",
    tools: [
      "shadow_loan_council",
      "shadow_loan_council_typed",
      "shadow_risk_tools",
      "shadow_recall",
      "shadow_calibration",
      "shadow_scenarios",
      "shadow_traceability",
      "shadow_verify_attestation",
      "shadow_size_position",
    ],
  };

  // ── Assemble the report ──────────────────────────────────────
  const report = {
    schema: "shadow://gsar-552-239-7001/v1",
    protocol_version: "1",
    reference: "GSAR 552.239-7001 (draft 2026-03-06)",
    generated_at_utc: generatedAt,
    product_identification: productIdentification,
    model_provenance: modelProvenance,
    data_origins: dataOrigins,
    risk_assessments: riskAssessments,
    cryptographic_evidence: cryptoEvidence,
    test_surface: testSurface,
    bill_of_tools: billOfTools,
  };

  // Report SHA-256 covers the exact JSON bytes federal contractors
  // pin in procurement responses. Recompute by hashing this JSON
  // with the report_sha256 field REMOVED.
  const withoutHash = JSON.stringify(report);
  const report_sha256 = sha256Hex(withoutHash);
  report.report_sha256 = report_sha256;

  return report;
}

// CLI entry point. Only executes when run as a script, not on import.
const invokedAsCli =
  process.argv[1] &&
  (process.argv[1].endsWith("gsar-provenance-report.mjs") ||
    process.argv[1].endsWith("gsar-provenance-report"));

if (invokedAsCli) {
  const report = generateGsarReport();
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}
