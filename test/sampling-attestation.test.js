// test/sampling-attestation.test.js
// ──────────────────────────────────────────────────────────────────
// v1.5.28 (2026-07-08) — Sampling-seed commitment contract tests.
// Anchors arXiv:2606.16121 (2026-06-25).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeSamplingSeedCommitment,
  deterministicSamplingOptionsFor,
  commitFromProviderResponse,
} from "../lib/sampling-attestation.js";
import { buildAttestation, verifyAttestation } from "../lib/attestation.js";


// ═════════════════════════════════════════════════════════════════
// Deterministic commitment semantics
// ═════════════════════════════════════════════════════════════════

test("computeSamplingSeedCommitment is deterministic across calls", () => {
  const a = computeSamplingSeedCommitment({
    seed: 42, temperature: 0, provider: "openai", model_id: "gpt-5.2",
  });
  const b = computeSamplingSeedCommitment({
    seed: 42, temperature: 0, provider: "openai", model_id: "gpt-5.2",
  });
  assert.equal(a, b);
  assert.match(a, /^[a-f0-9]{64}$/);
});

test("commitment differs when seed differs", () => {
  const a = computeSamplingSeedCommitment({ seed: 42, provider: "openai" });
  const b = computeSamplingSeedCommitment({ seed: 43, provider: "openai" });
  assert.notEqual(a, b);
});

test("commitment differs when temperature differs", () => {
  const a = computeSamplingSeedCommitment({ temperature: 0, provider: "openai" });
  const b = computeSamplingSeedCommitment({ temperature: 0.7, provider: "openai" });
  assert.notEqual(a, b);
});

test("commitment differs when provider system_fingerprint differs", () => {
  const a = computeSamplingSeedCommitment({
    seed: 42, provider: "openai", system_fingerprint: "fp_a",
  });
  const b = computeSamplingSeedCommitment({
    seed: 42, provider: "openai", system_fingerprint: "fp_b",
  });
  assert.notEqual(a, b);
});

test("commitment is stable when field order in the call site changes (canonical serialize)", () => {
  const a = computeSamplingSeedCommitment({
    seed: 42, temperature: 0, provider: "openai", model_id: "gpt-5.2",
  });
  const b = computeSamplingSeedCommitment({
    model_id: "gpt-5.2", temperature: 0, provider: "openai", seed: 42,
  });
  assert.equal(a, b);
});

test("computeSamplingSeedCommitment accepts null system_fingerprint (Anthropic case)", () => {
  const hash = computeSamplingSeedCommitment({
    seed: null,
    temperature: 0,
    provider: "anthropic",
    model_id: "claude-sonnet-4-5-20250929",
    system_fingerprint: null,
  });
  assert.match(hash, /^[a-f0-9]{64}$/);
});


// ═════════════════════════════════════════════════════════════════
// Provider-specific deterministic sampling parameters
// ═════════════════════════════════════════════════════════════════

test("deterministicSamplingOptionsFor Anthropic sets temperature=0 only", () => {
  const opts = deterministicSamplingOptionsFor("anthropic");
  assert.equal(opts.temperature, 0);
  assert.ok(!("seed" in opts), "Anthropic does not accept seed");
});

test("deterministicSamplingOptionsFor OpenAI sets seed + temperature=0", () => {
  const opts = deterministicSamplingOptionsFor("openai");
  assert.equal(opts.temperature, 0);
  assert.equal(typeof opts.seed, "number");
});

test("deterministicSamplingOptionsFor GLM sets top_k=1 (GLM cannot pin seed)", () => {
  const opts = deterministicSamplingOptionsFor("glm");
  assert.equal(opts.temperature, 0);
  assert.equal(opts.top_k, 1);
});

test("deterministicSamplingOptionsFor unknown provider falls back to temperature=0", () => {
  const opts = deterministicSamplingOptionsFor("wat");
  assert.equal(opts.temperature, 0);
});


// ═════════════════════════════════════════════════════════════════
// commitFromProviderResponse convenience
// ═════════════════════════════════════════════════════════════════

test("commitFromProviderResponse extracts OpenAI system_fingerprint", () => {
  const hash = commitFromProviderResponse({
    provider: "openai",
    model_id: "gpt-5.2",
    sampling: { seed: 42, temperature: 0 },
    response: { system_fingerprint: "fp_abcd1234" },
  });
  const control = computeSamplingSeedCommitment({
    seed: 42,
    temperature: 0,
    provider: "openai",
    model_id: "gpt-5.2",
    system_fingerprint: "fp_abcd1234",
  });
  assert.equal(hash, control);
});

test("commitFromProviderResponse handles null response (Anthropic)", () => {
  const hash = commitFromProviderResponse({
    provider: "anthropic",
    model_id: "claude-sonnet-4-5-20250929",
    sampling: { temperature: 0 },
    response: null,
  });
  assert.match(hash, /^[a-f0-9]{64}$/);
});


// ═════════════════════════════════════════════════════════════════
// End-to-end: commitment binds into Ed25519 attestation payload
// ═════════════════════════════════════════════════════════════════

test("attestation with sampling_seed_commitment_sha256 verifies when commitment unchanged", () => {
  const request = { loan: "L-001" };
  const response = { verdict: "approve" };
  const commit = computeSamplingSeedCommitment({
    seed: 42, temperature: 0, provider: "openai", model_id: "gpt-5.2",
  });
  const attestation = buildAttestation({
    request, response,
    modelId: "openai/gpt-5.2",
    mode: "hmac-sha256",
    secret: "test-master",
    samplingSeedCommitmentSha256: commit,
  });
  assert.equal(attestation.sampling_seed_commitment_sha256, commit);
  const v = verifyAttestation(attestation, request, response, { secret: "test-master" });
  assert.equal(v.ok, true, `expected verified, got: ${v.reason}`);
});

test("attestation with sampling commitment FAILS verification if commitment tampered", () => {
  const request = { loan: "L-002" };
  const response = { verdict: "approve" };
  const commit = computeSamplingSeedCommitment({
    seed: 42, temperature: 0, provider: "openai", model_id: "gpt-5.2",
  });
  const attestation = buildAttestation({
    request, response,
    modelId: "openai/gpt-5.2",
    mode: "hmac-sha256",
    secret: "test-master",
    samplingSeedCommitmentSha256: commit,
  });
  // Tamper the commitment field post-hoc.
  const tampered = { ...attestation, sampling_seed_commitment_sha256: "0".repeat(64) };
  const v = verifyAttestation(tampered, request, response, { secret: "test-master" });
  assert.equal(v.ok, false, "tamper of sampling commitment must break verification");
});

test("attestations without sampling_seed_commitment_sha256 stay 100% back-compat (pre-v1.5.28 verifies)", () => {
  const request = { loan: "L-003" };
  const response = { verdict: "approve" };
  const attestation = buildAttestation({
    request, response,
    modelId: "openai/gpt-5.2",
    mode: "hmac-sha256",
    secret: "test-master",
    // no samplingSeedCommitmentSha256 → field absent from attestation
  });
  assert.ok(!("sampling_seed_commitment_sha256" in attestation));
  const v = verifyAttestation(attestation, request, response, { secret: "test-master" });
  assert.equal(v.ok, true);
});
