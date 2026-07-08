// test/siem-export.test.js
// ──────────────────────────────────────────────────────────────────
// v1.5.22 (2026-07-08) — Splunk CIM Alerts + ArcSight CEF export
// format contract tests.
//
// These lock the wire-format for both formats so a bank's SIEM
// correlation rules keyed on our signature ids never break silently
// on Shadow upgrades. If any of these fail, a downstream SIEM would
// misparse Shadow verdicts.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatCEF,
  formatCIMAlerts,
  formatForSiem,
  SIEM_SIGNATURES,
  SEVERITY_BY_VERDICT,
} from "../lib/siem-export.js";

// Minimal but realistic Shadow response fixture. Represents a
// council block on ECOA §701 proxy detection with a real Ed25519-
// signed attestation blob shape.
const FIXTURE_BLOCK = {
  final_verdict: "block",
  adverse_action_codes: [
    { code: "AA02", label: "Debt-to-income ratio exceeds threshold" },
  ],
  voices: [
    { voice: "credit", verdict: "block", rationale: "DTI 0.48 above 0.36 cap" },
    { voice: "compliance", verdict: "block", rationale: "Adverse action notice required per §1002.9(b)(2)" },
    { voice: "risk", verdict: "block", rationale: "Beyond risk appetite for BBB tranche" },
    { voice: "advocate", verdict: "escalate", rationale: "Borrower disclosure incomplete" },
    { voice: "contrarian", verdict: "block", rationale: "Sector concentration warning" },
  ],
  attestation: {
    version: 3,
    mode: "ed25519",
    request_commitment: "a".repeat(64),
    output_commitment: "b".repeat(64),
    model_id: "anthropic/claude-sonnet-4-5-20250929",
    completed_at_utc: "2026-07-08T14:32:11.234Z",
    previous_hash: "c".repeat(64),
    key_id: "prod-2026-Q3",
    signature: "d".repeat(128),
    dictionary_hash: "e".repeat(64),
    citation_registry_sha256: "f".repeat(64),
  },
};

const FIXTURE_PROXY_BLOCK = {
  ...FIXTURE_BLOCK,
  adverse_action_codes: [
    { code: "AA05", label: "ECOA §701 protected-class proxy detected" },
  ],
};

const FIXTURE_APPROVE = {
  ...FIXTURE_BLOCK,
  final_verdict: "approve",
  adverse_action_codes: [],
};

const FIXTURE_AML = {
  ...FIXTURE_BLOCK,
  final_verdict: "escalate",
  adverse_action_codes: [{ code: "AA06", label: "AML/KYC review required" }],
};


// ═════════════════════════════════════════════════════════════════
// CEF format tests
// ═════════════════════════════════════════════════════════════════

test("formatCEF starts with CEF:0 header", () => {
  const line = formatCEF(FIXTURE_BLOCK);
  assert.ok(line.startsWith("CEF:0|"), `unexpected CEF prefix: ${line.slice(0, 20)}`);
});

test("formatCEF header carries vendor / product / version fields", () => {
  const line = formatCEF(FIXTURE_BLOCK);
  const parts = line.split("|");
  assert.equal(parts[0], "CEF:0");
  assert.equal(parts[1], "shadow-mentor");
  assert.equal(parts[2], "compliance-council");
  assert.equal(parts[3], "1.5.22");
});

test("formatCEF assigns the block signature id + high severity", () => {
  const line = formatCEF(FIXTURE_BLOCK);
  const parts = line.split("|");
  assert.equal(parts[4], SIEM_SIGNATURES.block);
  assert.equal(parts[5], "Shadow council verdict: block");
  assert.equal(parts[6], String(SEVERITY_BY_VERDICT.block.cef));
});

test("formatCEF escalates AA05 proxy detection to a distinct signature", () => {
  const line = formatCEF(FIXTURE_PROXY_BLOCK);
  const parts = line.split("|");
  assert.equal(parts[4], SIEM_SIGNATURES.proxy_block);
  // Severity for proxy_block should be higher than plain block.
  assert.ok(Number(parts[6]) >= SEVERITY_BY_VERDICT.block.cef, "proxy_block severity must be ≥ block severity");
});

test("formatCEF assigns AA06 AML the aml_flag signature", () => {
  const line = formatCEF(FIXTURE_AML);
  const parts = line.split("|");
  assert.equal(parts[4], SIEM_SIGNATURES.aml_flag);
});

test("formatCEF assigns approve → informational severity", () => {
  const line = formatCEF(FIXTURE_APPROVE);
  const parts = line.split("|");
  assert.equal(parts[4], SIEM_SIGNATURES.approve);
  assert.equal(parts[6], String(SEVERITY_BY_VERDICT.approve.cef));
});

test("formatCEF extension carries attestation commitments via csN slots", () => {
  const line = formatCEF(FIXTURE_BLOCK);
  assert.match(line, /cs1Label=attestation_request_commitment/);
  assert.match(line, /cs1=a{64}/);
  assert.match(line, /cs2Label=attestation_output_commitment/);
  assert.match(line, /cs2=b{64}/);
  assert.match(line, /cs3Label=attestation_model_id/);
  assert.match(line, /cs3=anthropic\\\/claude-sonnet-4-5-20250929|cs3=anthropic\/claude-sonnet-4-5-20250929/);
  assert.match(line, /cs4Label=attestation_previous_hash/);
  assert.match(line, /cs5Label=attestation_key_id/);
});

test("formatCEF flattens adverse_action_codes into cs6 comma-separated", () => {
  const line = formatCEF({
    ...FIXTURE_BLOCK,
    adverse_action_codes: [
      { code: "AA02", label: "DTI" },
      { code: "AA05", label: "proxy" },
    ],
  });
  assert.match(line, /cs6=AA02,AA05/);
});

test("formatCEF escapes pipe + backslash + equals inside extension values", () => {
  const scary = {
    ...FIXTURE_BLOCK,
    attestation: {
      ...FIXTURE_BLOCK.attestation,
      model_id: "anthropic|claude=v1\\slash",
    },
  };
  const line = formatCEF(scary);
  // pipe, equals, and backslash must be escaped inside extension.
  assert.match(line, /cs3=anthropic\\\|claude\\=v1\\\\slash/);
});

test("formatCEF has no unescaped newlines even when input has them", () => {
  const withNewlines = {
    ...FIXTURE_BLOCK,
    attestation: {
      ...FIXTURE_BLOCK.attestation,
      model_id: "anthropic\nclaude",
    },
  };
  const line = formatCEF(withNewlines);
  assert.doesNotMatch(line, /\n/);
  assert.match(line, /cs3=anthropic\\nclaude/);
});

test("formatCEF is a single line", () => {
  const line = formatCEF(FIXTURE_BLOCK);
  assert.equal(line.split("\n").length, 1);
});

test("formatCEF surfaces voice_count via cn1", () => {
  const line = formatCEF(FIXTURE_BLOCK);
  assert.match(line, /cn1Label=voice_count/);
  assert.match(line, /cn1=5/);
});

test("formatCEF throws on missing response", () => {
  assert.throws(() => formatCEF(null), /response object required/);
  assert.throws(() => formatCEF(undefined), /response object required/);
});


// ═════════════════════════════════════════════════════════════════
// Splunk CIM Alerts format tests
// ═════════════════════════════════════════════════════════════════

test("formatCIMAlerts carries all CIM Alerts required fields", () => {
  const cim = formatCIMAlerts(FIXTURE_BLOCK);
  // Per Splunk CIM Alerts data model.
  for (const key of ["action", "severity", "signature", "src", "user", "vendor", "product", "app"]) {
    assert.ok(key in cim, `missing required CIM field: ${key}`);
    assert.ok(cim[key] !== null && cim[key] !== undefined && cim[key] !== "", `empty CIM field: ${key}`);
  }
});

test("formatCIMAlerts action namespaces the verdict", () => {
  const cim = formatCIMAlerts(FIXTURE_BLOCK);
  assert.equal(cim.action, "council_block");
});

test("formatCIMAlerts severity mirrors CEF numeric severity semantically", () => {
  assert.equal(formatCIMAlerts(FIXTURE_APPROVE).severity, "informational");
  assert.equal(formatCIMAlerts(FIXTURE_BLOCK).severity, "high");
  assert.equal(formatCIMAlerts(FIXTURE_PROXY_BLOCK).severity, "critical");
  assert.equal(formatCIMAlerts(FIXTURE_AML).severity, "medium");
});

test("formatCIMAlerts signature id stable across CEF + CIM", () => {
  const cim = formatCIMAlerts(FIXTURE_BLOCK);
  const cef = formatCEF(FIXTURE_BLOCK);
  const cefSigId = cef.split("|")[4];
  assert.equal(cim.signature, cefSigId);
  assert.equal(cim.signature_id, cefSigId);
});

test("formatCIMAlerts exposes attestation_* fields at top level", () => {
  const cim = formatCIMAlerts(FIXTURE_BLOCK);
  assert.equal(cim.attestation_version, 3);
  assert.equal(cim.attestation_mode, "ed25519");
  assert.equal(cim.attestation_request_commitment, "a".repeat(64));
  assert.equal(cim.attestation_output_commitment, "b".repeat(64));
  assert.equal(cim.attestation_model_id, "anthropic/claude-sonnet-4-5-20250929");
  assert.equal(cim.attestation_previous_hash, "c".repeat(64));
  assert.equal(cim.attestation_key_id, "prod-2026-Q3");
});

test("formatCIMAlerts includes v1.5.8+ dictionary_hash when present", () => {
  const cim = formatCIMAlerts(FIXTURE_BLOCK);
  assert.equal(cim.attestation_dictionary_hash, "e".repeat(64));
});

test("formatCIMAlerts omits dictionary_hash when absent (back-compat)", () => {
  const noDict = {
    ...FIXTURE_BLOCK,
    attestation: { ...FIXTURE_BLOCK.attestation, dictionary_hash: undefined },
  };
  const cim = formatCIMAlerts(noDict);
  assert.ok(!("attestation_dictionary_hash" in cim), "should not include undefined dictionary_hash");
});

test("formatCIMAlerts includes v1.5.18 citation_registry_sha256 when present", () => {
  const cim = formatCIMAlerts(FIXTURE_BLOCK);
  assert.equal(cim.attestation_citation_registry_sha256, "f".repeat(64));
});

test("formatCIMAlerts flattens adverse_action_codes to array of codes only", () => {
  const cim = formatCIMAlerts(FIXTURE_BLOCK);
  assert.deepEqual(cim.adverse_action_codes, ["AA02"]);
});

test("formatCIMAlerts allows src / user / app override for multi-tenant deployment", () => {
  const cim = formatCIMAlerts(FIXTURE_BLOCK, {
    src: "shadow-mentor.acme-bank.internal",
    user: "svc-shadow",
    app: "acme-loan-origination",
  });
  assert.equal(cim.src, "shadow-mentor.acme-bank.internal");
  assert.equal(cim.user, "svc-shadow");
  assert.equal(cim.app, "acme-loan-origination");
});

test("formatCIMAlerts is JSON-serializable without loss", () => {
  const cim = formatCIMAlerts(FIXTURE_BLOCK);
  const roundtrip = JSON.parse(JSON.stringify(cim));
  assert.deepEqual(cim, roundtrip);
});

test("formatCIMAlerts throws on missing response", () => {
  assert.throws(() => formatCIMAlerts(null), /response object required/);
});


// ═════════════════════════════════════════════════════════════════
// formatForSiem dispatcher tests
// ═════════════════════════════════════════════════════════════════

test("formatForSiem returns CEF text with text/plain content-type when format=cef", () => {
  const { body, contentType } = formatForSiem(FIXTURE_BLOCK, "cef");
  assert.ok(body.startsWith("CEF:0|"));
  assert.equal(contentType, "text/plain; charset=utf-8");
});

test("formatForSiem returns CIM JSON with application/json when format=cim", () => {
  const { body, contentType } = formatForSiem(FIXTURE_BLOCK, "cim");
  assert.equal(contentType, "application/json");
  const parsed = JSON.parse(body);
  assert.equal(parsed.signature, SIEM_SIGNATURES.block);
});

test("formatForSiem accepts format=splunk as alias for cim", () => {
  const { body, contentType } = formatForSiem(FIXTURE_BLOCK, "splunk");
  assert.equal(contentType, "application/json");
  const parsed = JSON.parse(body);
  assert.equal(parsed.signature, SIEM_SIGNATURES.block);
});

test("formatForSiem defaults to JSON when format is unknown / empty", () => {
  const { body, contentType } = formatForSiem(FIXTURE_BLOCK, "");
  assert.equal(contentType, "application/json");
  const parsed = JSON.parse(body);
  // Should be the original shape, not the CIM-shaped one.
  assert.equal(parsed.final_verdict, "block");
});

test("formatForSiem is case-insensitive on format param", () => {
  const { contentType: ct1 } = formatForSiem(FIXTURE_BLOCK, "CEF");
  const { contentType: ct2 } = formatForSiem(FIXTURE_BLOCK, "Cim");
  assert.equal(ct1, "text/plain; charset=utf-8");
  assert.equal(ct2, "application/json");
});
