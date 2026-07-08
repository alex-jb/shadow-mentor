// test/evidence-partition.test.js
// ──────────────────────────────────────────────────────────────────
// v1.5.30 (2026-07-08) — Per-persona evidence partitioning contract
// tests. Anchors arXiv:2607.01661 (InfoDelphi, 2026-07-02).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evidencePartitionFor,
  partitionLoanAcrossVoices,
  auditPartitionLeak,
  partitionSchemeHash,
  getPartitionScheme,
  EVIDENCE_PARTITION_SCHEME_VERSION,
} from "../lib/evidence-partition.js";
import { buildAttestation, verifyAttestation } from "../lib/attestation.js";


const FULL_LOAN = {
  credit_score: 720,
  debt_to_income: 0.32,
  loan_to_value: 0.65,
  amount: 500000,
  borrower_rating: "BBB",
  sector: "healthcare",
  fair_lending_review_flag: false,
  market_proxy_prices: [100, 101, 99, 102, 98, 100],
  collateral_positions: [
    { ticker: "AAPL", sector: "Tech", weight: 0.5 },
    { ticker: "MSFT", sector: "Tech", weight: 0.5 },
  ],
  borrower_exposure_weights: { WidgetCo: 0.3, GadgetInc: 0.7 },
  applicant_narrative: "Family medical practice expansion",
  hardship_disclosure: null,
  public_assistance_flag: false,
};


// ═════════════════════════════════════════════════════════════════
// Scheme integrity
// ═════════════════════════════════════════════════════════════════

test("EVIDENCE_PARTITION_SCHEME_VERSION is versioned string", () => {
  assert.equal(typeof EVIDENCE_PARTITION_SCHEME_VERSION, "string");
  assert.match(EVIDENCE_PARTITION_SCHEME_VERSION, /shadow-evidence-partition\/v\d+/);
});

test("getPartitionScheme returns 5 persona keys", () => {
  const scheme = getPartitionScheme();
  const keys = Object.keys(scheme).sort();
  assert.deepEqual(keys, ["advocate", "compliance", "contrarian", "credit", "risk"]);
});

test("partitionSchemeHash is deterministic across calls", () => {
  const a = partitionSchemeHash();
  const b = partitionSchemeHash();
  assert.equal(a, b);
  assert.match(a, /^[a-f0-9]{64}$/);
});


// ═════════════════════════════════════════════════════════════════
// Per-persona partitions — allowed field lists
// ═════════════════════════════════════════════════════════════════

test("compliance partition sees regulatory fields, NOT credit_score / DTI / LTV", () => {
  const p = evidencePartitionFor("compliance", FULL_LOAN);
  assert.ok("fair_lending_review_flag" in p);
  assert.ok(!("credit_score" in p), "compliance MUST NOT see credit_score");
  assert.ok(!("debt_to_income" in p), "compliance MUST NOT see DTI");
  assert.ok(!("loan_to_value" in p), "compliance MUST NOT see LTV");
});

test("credit partition sees numeric ratios, NOT narrative or regulatory", () => {
  const p = evidencePartitionFor("credit", FULL_LOAN);
  assert.equal(p.credit_score, 720);
  assert.equal(p.debt_to_income, 0.32);
  assert.equal(p.loan_to_value, 0.65);
  assert.ok(!("applicant_narrative" in p), "credit MUST NOT see narrative");
  assert.ok(!("fair_lending_review_flag" in p), "credit MUST NOT see fair-lending flag");
});

test("risk partition sees market_proxy + collateral, NOT narrative", () => {
  const p = evidencePartitionFor("risk", FULL_LOAN);
  assert.ok(Array.isArray(p.market_proxy_prices));
  assert.ok(Array.isArray(p.collateral_positions));
  assert.ok(!("applicant_narrative" in p));
  assert.ok(!("debt_to_income" in p), "risk MUST NOT see DTI");
});

test("advocate partition sees narrative + hardship, NOT financial ratios", () => {
  const p = evidencePartitionFor("advocate", FULL_LOAN);
  assert.equal(p.applicant_narrative, "Family medical practice expansion");
  assert.ok(!("credit_score" in p), "advocate MUST NOT see credit_score");
  assert.ok(!("debt_to_income" in p));
  assert.ok(!("loan_to_value" in p));
});

test("contrarian partition sees macro (market_proxy + sector), NOT narrative", () => {
  const p = evidencePartitionFor("contrarian", FULL_LOAN);
  assert.ok(Array.isArray(p.market_proxy_prices));
  assert.equal(p.sector, "healthcare");
  assert.ok(!("applicant_narrative" in p));
  assert.ok(!("credit_score" in p), "contrarian MUST NOT see credit_score");
});


// ═════════════════════════════════════════════════════════════════
// Cross-persona leak audit
// ═════════════════════════════════════════════════════════════════

test("auditPartitionLeak passes when partition adheres to scheme", () => {
  for (const persona of ["compliance", "credit", "risk", "advocate", "contrarian"]) {
    const p = evidencePartitionFor(persona, FULL_LOAN);
    const result = auditPartitionLeak(persona, p);
    assert.equal(result.ok, true, `${persona} clean partition should audit clean`);
  }
});

test("auditPartitionLeak flags a leak when narrative is sent to credit", () => {
  const leaky = { ...evidencePartitionFor("credit", FULL_LOAN), applicant_narrative: "leaked!" };
  const result = auditPartitionLeak("credit", leaky);
  assert.equal(result.ok, false);
  assert.ok(result.leaks.includes("applicant_narrative"));
});

test("auditPartitionLeak flags a leak when credit_score is sent to compliance", () => {
  const leaky = { ...evidencePartitionFor("compliance", FULL_LOAN), credit_score: 720 };
  const result = auditPartitionLeak("compliance", leaky);
  assert.equal(result.ok, false);
  assert.ok(result.leaks.includes("credit_score"));
});


// ═════════════════════════════════════════════════════════════════
// Determinism + back-compat
// ═════════════════════════════════════════════════════════════════

test("evidencePartitionFor is deterministic across calls with same loan", () => {
  const a = evidencePartitionFor("credit", FULL_LOAN);
  const b = evidencePartitionFor("credit", FULL_LOAN);
  assert.deepEqual(a, b);
});

test("evidencePartitionFor returns empty object for unknown persona (fail-safe closed)", () => {
  const p = evidencePartitionFor("unknown-persona", FULL_LOAN);
  assert.deepEqual(p, {});
});

test("partitionLoanAcrossVoices returns partitions for all 5 personas", () => {
  const all = partitionLoanAcrossVoices(FULL_LOAN);
  const keys = Object.keys(all).sort();
  assert.deepEqual(keys, ["advocate", "compliance", "contrarian", "credit", "risk"]);
  // Each partition is non-empty for a well-formed loan.
  for (const k of keys) {
    assert.ok(Object.keys(all[k]).length > 0, `${k} partition should be non-empty`);
  }
});


// ═════════════════════════════════════════════════════════════════
// Ed25519 attestation binding
// ═════════════════════════════════════════════════════════════════

test("attestation with evidence_partition_scheme_sha256 verifies unchanged", () => {
  const schemeHash = partitionSchemeHash();
  const attestation = buildAttestation({
    request: { loan: "L-001" },
    response: { verdict: "approve" },
    modelId: "test/model",
    mode: "hmac-sha256",
    secret: "test-master",
    evidencePartitionSchemeSha256: schemeHash,
  });
  assert.equal(attestation.evidence_partition_scheme_sha256, schemeHash);
  const v = verifyAttestation(attestation, { loan: "L-001" }, { verdict: "approve" }, { secret: "test-master" });
  assert.equal(v.ok, true, `expected verified: ${v.reason}`);
});

test("tampering evidence_partition_scheme_sha256 breaks verification", () => {
  const schemeHash = partitionSchemeHash();
  const attestation = buildAttestation({
    request: { loan: "L-002" },
    response: { verdict: "approve" },
    modelId: "test/model",
    mode: "hmac-sha256",
    secret: "test-master",
    evidencePartitionSchemeSha256: schemeHash,
  });
  const tampered = { ...attestation, evidence_partition_scheme_sha256: "0".repeat(64) };
  const v = verifyAttestation(tampered, { loan: "L-002" }, { verdict: "approve" }, { secret: "test-master" });
  assert.equal(v.ok, false);
});
