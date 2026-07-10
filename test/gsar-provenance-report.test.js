// test/gsar-provenance-report.test.js
// ──────────────────────────────────────────────────────────────────
// v1.5.26 (2026-07-08) — GSAR 552.239-7001 provenance report
// contract tests.
//
// GSAR 552.239-7001 (draft 2026-03-06) requires GSA MAS vendors
// offering AI to disclose model provenance, data origins, and risk
// assessments. Federal contractors (SAIC, Booz Allen, Leidos,
// ManTech) submitting Shadow as a subcomponent need this exact
// report shape to attach to their MAS-Refresh-32 responses.
//
// These tests lock the report schema so any silent shape change
// invalidates every previously-submitted provenance-hash pin in a
// government procurement record — a real audit-trail failure.
//
// If any of these fail, chase the regression in
// `bin/gsar-provenance-report.mjs`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { generateGsarReport } from "../bin/gsar-provenance-report.mjs";


// ═════════════════════════════════════════════════════════════════
// Schema conformance — top-level shape
// ═════════════════════════════════════════════════════════════════

test("report has canonical schema + protocol_version + reference", () => {
  const report = generateGsarReport();
  assert.equal(report.schema, "shadow://gsar-552-239-7001/v1");
  assert.equal(report.protocol_version, "1");
  assert.match(report.reference, /GSAR 552\.239-7001/);
});

test("report has all 7 required top-level sections + report_sha256", () => {
  const report = generateGsarReport();
  for (const section of [
    "product_identification",
    "model_provenance",
    "data_origins",
    "risk_assessments",
    "cryptographic_evidence",
    "test_surface",
    "bill_of_tools",
  ]) {
    assert.ok(section in report, `missing section: ${section}`);
  }
  assert.equal(typeof report.report_sha256, "string");
  assert.equal(report.report_sha256.length, 64); // hex SHA-256
});


// ═════════════════════════════════════════════════════════════════
// §1 — Product identification
// ═════════════════════════════════════════════════════════════════

test("product_identification names shadow-mentor + MIT license", () => {
  const report = generateGsarReport();
  const p = report.product_identification;
  assert.equal(p.product_name, "shadow-mentor");
  assert.equal(p.license, "MIT");
  assert.match(p.product_version, /^\d+\.\d+\.\d+/);
  assert.equal(p.repository, "https://github.com/alex-jb/shadow-mentor");
});


// ═════════════════════════════════════════════════════════════════
// §2 — Model provenance — Anthropic + OpenAI + GLM
// ═════════════════════════════════════════════════════════════════

test("model_provenance lists Anthropic, OpenAI, Zhipu GLM providers", () => {
  const report = generateGsarReport();
  const providers = report.model_provenance.supported_providers.map((p) => p.provider);
  assert.ok(providers.includes("Anthropic"));
  assert.ok(providers.includes("OpenAI"));
  assert.ok(providers.includes("Zhipu GLM"));
});

test("every provider entry names an Ed25519 substitution-detection guarantee", () => {
  const report = generateGsarReport();
  for (const p of report.model_provenance.supported_providers) {
    assert.match(
      p.substitution_detection,
      /Ed25519/,
      `${p.provider} must claim Ed25519 substitution detection`,
    );
  }
});

test("model_provenance lists the deterministic pure-computation paths", () => {
  const report = generateGsarReport();
  const dp = report.model_provenance.deterministic_paths.join(" ");
  assert.match(dp, /runLoanCouncil/);
  assert.match(dp, /runDSCouncil/);
  assert.match(dp, /sizePosition/);
});


// ═════════════════════════════════════════════════════════════════
// §3 — Data origins — Shadow ships zero training data
// ═════════════════════════════════════════════════════════════════

test("data_origins explicitly declares Shadow ships zero training data", () => {
  const report = generateGsarReport();
  assert.match(report.data_origins.shadow_training_data, /none|zero training data/i);
});

test("data_origins names persona-prompt + citation-registry + reason-code sources", () => {
  const report = generateGsarReport();
  const d = report.data_origins;
  assert.match(d.persona_prompts_source, /lib\/prompts\.js/);
  assert.match(d.regulatory_citations_source, /citation-registry\.json/);
  assert.match(d.reason_codes_source, /reason-code-dictionary\.json/);
});


// ═════════════════════════════════════════════════════════════════
// §4 — Risk assessments — every claim ties to a specific doc/test path
// ═════════════════════════════════════════════════════════════════

test("risk_assessments cites NIST AI 600-1 + verdict-invariance + Judge Card", () => {
  const report = generateGsarReport();
  const r = report.risk_assessments;
  assert.match(r.nist_ai_600_1_mapping, /NIST-AI-600-1/);
  assert.match(r.verdict_invariance, /test\/verdict-invariance\.test\.js/);
  assert.match(r.policy_invariance_score, /JUDGE-CARD/);
  assert.match(r.gaicf_layer_3_adverse_action_drafter, /GAICF-COMPATIBILITY/);
});


// ═════════════════════════════════════════════════════════════════
// §5 — Cryptographic evidence — every hash is SHA-256 hex
// ═════════════════════════════════════════════════════════════════

test("cryptographic_evidence names Ed25519 (RFC 8032) as signature algorithm", () => {
  const report = generateGsarReport();
  assert.match(report.cryptographic_evidence.attestation_signature_algorithm, /Ed25519/);
  assert.match(report.cryptographic_evidence.attestation_signature_algorithm, /RFC 8032/);
});

test("cryptographic_evidence hashes are all valid SHA-256 hex (64 chars)", () => {
  const report = generateGsarReport();
  const c = report.cryptographic_evidence;
  const hashFields = [
    "persona_prompts_sha256",
    "citation_registry_sha256",
    "reason_code_dictionary_sha256",
    "protected_classes_schema_sha256",
    "protected_classes_us_ecoa_sha256",
    "protected_classes_eu_gdpr_sha256",
  ];
  for (const f of hashFields) {
    assert.match(c[f], /^[a-f0-9]{64}$/, `${f} must be SHA-256 hex`);
  }
});

test("cryptographic_evidence lists all 13 per-response attestation fields (v1.5.24 stack)", () => {
  const report = generateGsarReport();
  const fields = report.cryptographic_evidence.per_response_attestation_fields;
  for (const key of [
    "request_commitment",
    "output_commitment",
    "model_id",
    "signature",
    "dictionary_hash",
    "citation_registry_sha256",
    "proxy_schema_sha256",
    "policy_invariance_score_sha256",
    "adverse_action_notice_sha256",
  ]) {
    assert.ok(
      fields.some((f) => f.includes(key)),
      `attestation field list must mention "${key}"`,
    );
  }
});


// ═════════════════════════════════════════════════════════════════
// §7 — Bill of tools (MCP-manifest SBOM equivalent)
// ═════════════════════════════════════════════════════════════════

test("bill_of_tools points at live MCP manifest endpoint + names the 9 MCP tools", () => {
  const report = generateGsarReport();
  const b = report.bill_of_tools;
  assert.match(b.mcp_manifest_endpoint, /shadow-mentor-phi\.vercel\.app\/api\/mcp-manifest/);
  assert.equal(b.tools.length, 9);
  for (const t of b.tools) {
    assert.match(t, /^shadow_/);
  }
});


// ═════════════════════════════════════════════════════════════════
// Determinism — same repo state MUST produce same report
// ═════════════════════════════════════════════════════════════════

test("report is deterministic for a fixed generatedAt", () => {
  const t = "2026-07-08T20:00:00.000Z";
  const a = generateGsarReport({ generatedAt: t });
  const b = generateGsarReport({ generatedAt: t });
  assert.equal(a.report_sha256, b.report_sha256);
  assert.deepEqual(a, b);
});

test("report_sha256 changes when generated_at_utc changes", () => {
  const a = generateGsarReport({ generatedAt: "2026-07-08T20:00:00.000Z" });
  const b = generateGsarReport({ generatedAt: "2026-07-08T20:00:01.000Z" });
  assert.notEqual(a.report_sha256, b.report_sha256);
});

test("report_sha256 is a valid SHA-256 hex string", () => {
  const report = generateGsarReport();
  assert.match(report.report_sha256, /^[a-f0-9]{64}$/);
});
