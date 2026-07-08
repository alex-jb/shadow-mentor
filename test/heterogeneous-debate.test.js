// test/heterogeneous-debate.test.js
// ──────────────────────────────────────────────────────────────────
// v1.5.32 contract tests for heterogeneous-debate enforcement per
// arXiv:2606.19826. Same test-shape pattern as
// test/sampling-attestation.test.js + test/evidence-partition.test.js.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import {
  DEFAULT_MIN_PROVIDERS,
  enforceHeterogeneousDebate,
  heterogeneityCommitment,
  enforceAndCommit,
  detectDominanceRisk,
} from "../lib/heterogeneous-debate.js";
import {
  buildAttestation, verifyAttestation, SIGNATURE_MODES,
} from "../lib/attestation.js";


const VOICES = ["compliance", "credit", "risk", "advocate", "contrarian"];


test("DEFAULT_MIN_PROVIDERS is 2 per arXiv:2606.19826 minimum defense", () => {
  assert.equal(DEFAULT_MIN_PROVIDERS, 2);
});


test("enforceHeterogeneousDebate: FAIL when only 1 provider available", () => {
  const r = enforceHeterogeneousDebate({
    voiceNames: VOICES,
    availableProviders: ["anthropic"],
  });
  assert.equal(r.ok, false);
  assert.equal(r.unique_providers_used, 1);
  assert.equal(r.providers_available_count, 1);
  assert.equal(r.min_required, 2);
  assert.match(r.reason, /arXiv:2606\.19826/);
  assert.match(r.reason, /ANTHROPIC_API_KEY|GLM_API_KEY|SHADOW_LOCAL_LLM_URL/);
});


test("enforceHeterogeneousDebate: PASS when 2 providers available", () => {
  const r = enforceHeterogeneousDebate({
    voiceNames: VOICES,
    availableProviders: ["anthropic", "glm"],
  });
  assert.equal(r.ok, true);
  assert.equal(r.unique_providers_used, 2);
  assert.equal(r.providers_available_count, 2);
  assert.deepEqual(r.providers_used_sorted, ["anthropic", "glm"]);
});


test("enforceHeterogeneousDebate: PASS when 3 providers available", () => {
  const r = enforceHeterogeneousDebate({
    voiceNames: VOICES,
    availableProviders: ["anthropic", "glm", "local"],
  });
  assert.equal(r.ok, true);
  assert.equal(r.unique_providers_used, 3);
  assert.deepEqual(r.providers_used_sorted, ["anthropic", "glm", "local"]);
});


test("enforceHeterogeneousDebate: FAIL when zero providers", () => {
  const r = enforceHeterogeneousDebate({
    voiceNames: VOICES,
    availableProviders: [],
  });
  assert.equal(r.ok, false);
  assert.equal(r.unique_providers_used, 0);
});


test("enforceHeterogeneousDebate: FAIL when minProviders is invalid", () => {
  const r = enforceHeterogeneousDebate({
    voiceNames: VOICES,
    availableProviders: ["anthropic", "glm"],
    minProviders: 0,
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /positive integer/);
});


test("enforceHeterogeneousDebate: min_providers=3 fails with only 2 available", () => {
  const r = enforceHeterogeneousDebate({
    voiceNames: VOICES,
    availableProviders: ["anthropic", "glm"],
    minProviders: 3,
  });
  assert.equal(r.ok, false);
  assert.equal(r.min_required, 3);
});


test("heterogeneityCommitment: deterministic for same inputs", () => {
  const a = heterogeneityCommitment({
    minProviders: 2,
    uniqueProvidersUsed: 2,
    providersUsedSorted: ["anthropic", "glm"],
  });
  const b = heterogeneityCommitment({
    minProviders: 2,
    uniqueProvidersUsed: 2,
    providersUsedSorted: ["anthropic", "glm"],
  });
  assert.equal(a, b);
  assert.equal(a.length, 64);
  assert.match(a, /^[0-9a-f]{64}$/);
});


test("heterogeneityCommitment: order-insensitive", () => {
  const a = heterogeneityCommitment({
    minProviders: 2,
    uniqueProvidersUsed: 2,
    providersUsedSorted: ["glm", "anthropic"],
  });
  const b = heterogeneityCommitment({
    minProviders: 2,
    uniqueProvidersUsed: 2,
    providersUsedSorted: ["anthropic", "glm"],
  });
  assert.equal(a, b);
});


test("heterogeneityCommitment: distinct for different min_providers", () => {
  const a = heterogeneityCommitment({
    minProviders: 2,
    uniqueProvidersUsed: 2,
    providersUsedSorted: ["anthropic", "glm"],
  });
  const b = heterogeneityCommitment({
    minProviders: 3,
    uniqueProvidersUsed: 2,
    providersUsedSorted: ["anthropic", "glm"],
  });
  assert.notEqual(a, b);
});


test("heterogeneityCommitment: distinct when provider set changes", () => {
  const a = heterogeneityCommitment({
    minProviders: 2,
    uniqueProvidersUsed: 2,
    providersUsedSorted: ["anthropic", "glm"],
  });
  const b = heterogeneityCommitment({
    minProviders: 2,
    uniqueProvidersUsed: 2,
    providersUsedSorted: ["anthropic", "local"],
  });
  assert.notEqual(a, b);
});


test("enforceAndCommit: returns enforcement + commitment together", () => {
  const r = enforceAndCommit({
    voiceNames: VOICES,
    availableProviders: ["anthropic", "glm"],
  });
  assert.equal(r.ok, true);
  assert.equal(r.commitment_sha256.length, 64);
});


test("detectDominanceRisk: flags 4/5 single-provider dominance", () => {
  const assignment = {
    compliance: "anthropic",
    credit: "anthropic",
    risk: "anthropic",
    advocate: "anthropic",
    contrarian: "glm",
  };
  const r = detectDominanceRisk(assignment);
  assert.equal(r.dominant_provider, "anthropic");
  assert.equal(r.dominance_ratio, 0.8);
  assert.equal(r.at_risk, true);
});


test("detectDominanceRisk: does NOT flag when only 1 provider (no heterogeneity to lose)", () => {
  const assignment = {
    compliance: "anthropic",
    credit: "anthropic",
    risk: "anthropic",
  };
  const r = detectDominanceRisk(assignment);
  assert.equal(r.at_risk, false);
});


test("detectDominanceRisk: does NOT flag balanced 2-provider assignment", () => {
  const assignment = {
    a: "anthropic", b: "glm", c: "anthropic", d: "glm",
  };
  const r = detectDominanceRisk(assignment);
  assert.equal(r.at_risk, false);
  assert.equal(r.dominance_ratio, 0.5);
});


test("BINDING: attestation signs over heterogeneity_commitment_sha256 (HMAC)", () => {
  const commitmentHash = heterogeneityCommitment({
    minProviders: 2,
    uniqueProvidersUsed: 2,
    providersUsedSorted: ["anthropic", "glm"],
  });
  const request = { loan: { fico: 720 }, min_providers: 2 };
  const response = { verdict: "approve", voice_count: 5 };
  const att = buildAttestation({
    request, response,
    modelId: "claude-sonnet-4-6",
    secret: "test-secret",
    heterogeneityCommitmentSha256: commitmentHash,
  });
  assert.equal(att.heterogeneity_commitment_sha256, commitmentHash);
  const verify = verifyAttestation(att, request, response, "test-secret");
  assert.equal(verify.ok, true);
});


test("TAMPER DETECTION: swapping heterogeneity commitment breaks verify (HMAC)", () => {
  const commitmentHash = heterogeneityCommitment({
    minProviders: 2,
    uniqueProvidersUsed: 2,
    providersUsedSorted: ["anthropic", "glm"],
  });
  const tamperedHash = heterogeneityCommitment({
    minProviders: 1,   // silent relaxation of the enforcement threshold
    uniqueProvidersUsed: 1,
    providersUsedSorted: ["anthropic"],
  });
  const request = { loan: { fico: 720 } };
  const response = { verdict: "approve" };
  const att = buildAttestation({
    request, response,
    modelId: "claude-sonnet-4-6",
    secret: "test-secret",
    heterogeneityCommitmentSha256: commitmentHash,
  });
  att.heterogeneity_commitment_sha256 = tamperedHash;
  const verify = verifyAttestation(att, request, response, "test-secret");
  assert.equal(verify.ok, false);
  assert.match(verify.reason, /signature mismatch/);
});


test("BACK-COMPAT: attestation without heterogeneity field verifies unchanged (HMAC)", () => {
  const request = { loan: { fico: 720 } };
  const response = { verdict: "approve" };
  const att = buildAttestation({
    request, response,
    modelId: "claude-sonnet-4-6",
    secret: "test-secret",
    // no heterogeneityCommitmentSha256
  });
  assert.equal(att.heterogeneity_commitment_sha256, undefined);
  const verify = verifyAttestation(att, request, response, "test-secret");
  assert.equal(verify.ok, true);
});


test("BINDING: attestation signs over heterogeneity_commitment_sha256 (Ed25519)", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const commitmentHash = heterogeneityCommitment({
    minProviders: 2,
    uniqueProvidersUsed: 3,
    providersUsedSorted: ["anthropic", "glm", "local"],
  });
  const request = { loan: { fico: 700 } };
  const response = { verdict: "escalate" };
  const att = buildAttestation({
    request, response,
    modelId: "claude-sonnet-4-6",
    mode: SIGNATURE_MODES.ED25519,
    privateKey,
    heterogeneityCommitmentSha256: commitmentHash,
  });
  const verify = verifyAttestation(att, request, response, { publicKey });
  assert.equal(verify.ok, true);
  assert.equal(att.heterogeneity_commitment_sha256, commitmentHash);
});


test("ADVERSARIAL-PEER SCENARIO: single-provider deployment fails enforcement, refuses to sign", () => {
  const r = enforceAndCommit({
    voiceNames: VOICES,
    availableProviders: ["anthropic"],
  });
  assert.equal(r.ok, false);
  // Caller should NOT sign an attestation when enforcement failed;
  // this test documents that pattern by asserting the enforcement
  // result carries actionable data.
  assert.ok(r.reason.includes("Heterogeneity floor NOT met"));
  assert.equal(r.min_required, 2);
  assert.equal(r.unique_providers_used, 1);
});
