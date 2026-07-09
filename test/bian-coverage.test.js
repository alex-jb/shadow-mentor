// test/bian-coverage.test.js
// v1.5.39 contract tests for BIAN persona coverage + attestation binding.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createHash } from "node:crypto";

import {
  BIAN_DOMAINS,
  PERSONA_BIAN_MAP,
  getBianDomainsForPersona,
  getPersonasForBianDomain,
  bianCoverageCommitment,
  auditBianCoverage,
  getBianCoverageMatrix,
} from "../lib/bian-coverage.js";
import {
  buildAttestation, verifyAttestation, SIGNATURE_MODES,
} from "../lib/attestation.js";


test("BIAN_DOMAINS enum has 11 domains (Shadow's coverage set)", () => {
  assert.equal(Object.values(BIAN_DOMAINS).length, 11);
  assert.ok(BIAN_DOMAINS.REGULATORY_REPORTING);
  assert.ok(BIAN_DOMAINS.FAIR_LENDING);
  assert.ok(BIAN_DOMAINS.CREDIT_RISK);
  assert.ok(BIAN_DOMAINS.AML_KYC);
});


test("PERSONA_BIAN_MAP: every Shadow persona has ≥1 BIAN domain", () => {
  const audit = auditBianCoverage();
  assert.equal(audit.ok, true);
  assert.deepEqual(audit.empty_personas, []);
});


test("Compliance Officer primary domain is REGULATORY_REPORTING", () => {
  const domains = getBianDomainsForPersona("Compliance Officer");
  assert.equal(domains[0], BIAN_DOMAINS.REGULATORY_REPORTING);
  assert.ok(domains.includes(BIAN_DOMAINS.FAIR_LENDING));
});


test("Credit Fundamentals covers CREDIT_ASSESSMENT + CREDIT_RISK", () => {
  const domains = getBianDomainsForPersona("Credit Fundamentals");
  assert.ok(domains.includes(BIAN_DOMAINS.CREDIT_ASSESSMENT));
  assert.ok(domains.includes(BIAN_DOMAINS.CREDIT_RISK));
});


test("AML/KYC Investigator covers AML_KYC domain", () => {
  const domains = getBianDomainsForPersona("AML/KYC Investigator");
  assert.ok(domains.includes(BIAN_DOMAINS.AML_KYC));
});


test("getBianDomainsForPersona: unknown persona → empty array", () => {
  const domains = getBianDomainsForPersona("Nonexistent Persona");
  assert.deepEqual(domains, []);
});


test("getPersonasForBianDomain: FAIR_LENDING → Compliance + Fair Lending personas", () => {
  const personas = getPersonasForBianDomain(BIAN_DOMAINS.FAIR_LENDING);
  assert.ok(personas.includes("Compliance Officer"));
  assert.ok(personas.includes("Fair Lending Compliance"));
});


test("getPersonasForBianDomain: STRESS_TESTING → Macro Contrarian", () => {
  const personas = getPersonasForBianDomain(BIAN_DOMAINS.STRESS_TESTING);
  assert.deepEqual(personas, ["Macro Contrarian"]);
});


test("bianCoverageCommitment: deterministic 64-char hex", () => {
  const a = bianCoverageCommitment();
  const b = bianCoverageCommitment();
  assert.equal(a, b);
  assert.equal(a.length, 64);
  assert.match(a, /^[0-9a-f]{64}$/);
});


test("getBianCoverageMatrix: shape correct + every row has primary_domain", () => {
  const matrix = getBianCoverageMatrix();
  assert.equal(matrix.length, Object.keys(PERSONA_BIAN_MAP).length);
  for (const row of matrix) {
    assert.ok(row.persona);
    assert.ok(row.primary_domain);
    assert.ok(Array.isArray(row.domains));
    assert.ok(row.domains.length >= 1);
    assert.equal(row.primary_domain, row.domains[0]);
  }
});


test("BINDING: attestation signs over bian_coverage_sha256 (HMAC)", () => {
  const hash = bianCoverageCommitment();
  const request = { loan: { fico: 720 } };
  const response = { verdict: "escalate" };
  const att = buildAttestation({
    request, response,
    modelId: "claude-sonnet-4-6",
    secret: "test-secret",
    bianCoverageSha256: hash,
  });
  assert.equal(att.bian_coverage_sha256, hash);
  const v = verifyAttestation(att, request, response, "test-secret");
  assert.equal(v.ok, true);
});


test("TAMPER DETECTION: silent widening of persona domain breaks verify", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const originalHash = bianCoverageCommitment();
  // Simulate a post-hoc silent widening — recompute over a tampered map
  const tamperedMap = {
    ...PERSONA_BIAN_MAP,
    "Compliance Officer": [...PERSONA_BIAN_MAP["Compliance Officer"], "Fraud Detection"],
  };
  const tamperedHash = createHash("sha256")
    .update(JSON.stringify({ spec_version: "shadow-bian-coverage/v1", map: tamperedMap }))
    .digest("hex");
  assert.notEqual(originalHash, tamperedHash, "hashes must differ");

  const request = { loan: { fico: 720 } };
  const response = { verdict: "escalate" };
  const att = buildAttestation({
    request, response,
    modelId: "claude-sonnet-4-6",
    mode: SIGNATURE_MODES.ED25519,
    privateKey,
    bianCoverageSha256: originalHash,
  });
  att.bian_coverage_sha256 = tamperedHash;
  const v = verifyAttestation(att, request, response, { publicKey });
  assert.equal(v.ok, false);
});


test("BACK-COMPAT: attestation without bian_coverage_sha256 verifies unchanged", () => {
  const request = { loan: { fico: 720 } };
  const response = { verdict: "approve" };
  const att = buildAttestation({
    request, response,
    modelId: "claude-sonnet-4-6",
    secret: "test-secret",
    // no bianCoverageSha256
  });
  assert.equal(att.bian_coverage_sha256, undefined);
  const v = verifyAttestation(att, request, response, "test-secret");
  assert.equal(v.ok, true);
});


test("BINDING: attestation signs over bian_coverage_sha256 (Ed25519)", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const hash = bianCoverageCommitment();
  const request = { loan: { fico: 720 } };
  const response = { verdict: "escalate" };
  const att = buildAttestation({
    request, response,
    modelId: "claude-sonnet-4-6",
    mode: SIGNATURE_MODES.ED25519,
    privateKey,
    bianCoverageSha256: hash,
  });
  const v = verifyAttestation(att, request, response, { publicKey });
  assert.equal(v.ok, true);
});


test("PROCUREMENT: matrix output is bank-counsel-friendly (persona + primary_domain visible)", () => {
  const matrix = getBianCoverageMatrix();
  const complianceRow = matrix.find((r) => r.persona === "Compliance Officer");
  assert.ok(complianceRow);
  assert.equal(complianceRow.primary_domain, "Regulatory Compliance");
  assert.ok(complianceRow.domains.length >= 3);
});
