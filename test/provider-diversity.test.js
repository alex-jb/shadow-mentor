// test/provider-diversity.test.js
// ──────────────────────────────────────────────────────────────────
// Pins the provider diversity contract shipped 2026-07-02.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  assignProvidersToVoices,
  detectAvailableProviders,
  diversityReport,
} from "../lib/provider-diversity.js";


// ═══════════════════════════════════════════════════════════════
// Diversity score math
// ═══════════════════════════════════════════════════════════════

test("3 voices, 3 providers → all 3 used → score = 1.0", () => {
  const r = assignProvidersToVoices(
    ["junior", "senior", "third"],
    ["anthropic", "glm", "local"],
    "seed-1",
  );
  assert.equal(r.diversity_score, 1.0);
  assert.equal(r.unique_providers_used, 3);
  assert.equal(r.providers_available_count, 3);
});


test("3 voices, 2 providers → both used → score = 1.0 (best given ceiling)", () => {
  const r = assignProvidersToVoices(
    ["junior", "senior", "third"],
    ["anthropic", "glm"],
    "seed-1",
  );
  assert.equal(r.diversity_score, 1.0);
  assert.equal(r.unique_providers_used, 2);
  assert.equal(r.providers_available_count, 2);
});


test("3 voices, 1 provider → all same → score = 1.0 (best given ceiling)", () => {
  const r = assignProvidersToVoices(
    ["junior", "senior", "third"],
    ["anthropic"],
    "seed-1",
  );
  assert.equal(r.diversity_score, 1.0);
  assert.equal(r.unique_providers_used, 1);
  assert.equal(r.providers_available_count, 1);
});


test("procurement sees when only 1 provider is available (ceiling exposure)", () => {
  // A bank auditor reading the response should be able to tell that
  // even though diversity_score=1.0, only 1 provider was available
  // — so the diversity defense isn't active in this deployment.
  const r = assignProvidersToVoices(
    ["junior", "senior", "third"],
    ["anthropic"],
    "seed-1",
  );
  assert.equal(r.providers_available_count, 1);
  assert.equal(r.unique_providers_used, 1);
  // Auditor's decision rule: if providers_available_count === 1,
  // the diversity defense isn't active regardless of score.
});


// ═══════════════════════════════════════════════════════════════
// Determinism
// ═══════════════════════════════════════════════════════════════

test("same seed produces same assignment (auditable)", () => {
  const a = assignProvidersToVoices(
    ["junior", "senior", "third"],
    ["anthropic", "glm", "local"],
    "seed-abc",
  );
  const b = assignProvidersToVoices(
    ["junior", "senior", "third"],
    ["anthropic", "glm", "local"],
    "seed-abc",
  );
  assert.deepEqual(a.assignment, b.assignment);
});


test("different seed may produce different assignment", () => {
  // With 3 providers and 3 voices there are 3! = 6 possible
  // assignments. Any two random seeds have 5/6 chance of differing
  // in at least one voice slot. Assert only that structure is same.
  const a = assignProvidersToVoices(
    ["junior", "senior", "third"],
    ["anthropic", "glm", "local"],
    "seed-A",
  );
  const b = assignProvidersToVoices(
    ["junior", "senior", "third"],
    ["anthropic", "glm", "local"],
    "seed-B",
  );
  assert.deepEqual(Object.keys(a.assignment), Object.keys(b.assignment));
  // Both must still maximize diversity
  assert.equal(a.diversity_score, 1.0);
  assert.equal(b.diversity_score, 1.0);
});


test("object seed is serialized stably", () => {
  const a = assignProvidersToVoices(
    ["junior", "senior", "third"],
    ["anthropic", "glm", "local"],
    { persona: "compliance", scenario: "lbo" },
  );
  const b = assignProvidersToVoices(
    ["junior", "senior", "third"],
    ["anthropic", "glm", "local"],
    { persona: "compliance", scenario: "lbo" },
  );
  assert.deepEqual(a.assignment, b.assignment);
});


// ═══════════════════════════════════════════════════════════════
// Guards
// ═══════════════════════════════════════════════════════════════

test("empty voices → empty assignment, score 0", () => {
  const r = assignProvidersToVoices([], ["anthropic"], "seed");
  assert.deepEqual(r.assignment, {});
  assert.equal(r.diversity_score, 0);
  assert.equal(r.assignment_method, "no_voices_v1");
});


test("no providers → nulls for each voice, score 0", () => {
  const r = assignProvidersToVoices(
    ["junior", "senior"], [], "seed",
  );
  assert.equal(r.assignment_method, "no_providers_v1");
  assert.equal(r.diversity_score, 0);
  assert.equal(r.assignment.junior, null);
  assert.equal(r.assignment.senior, null);
});


test("non-array voices returns empty", () => {
  const r = assignProvidersToVoices("not-an-array", ["anthropic"], "seed");
  assert.deepEqual(r.assignment, {});
});


test("non-string provider entries are filtered out", () => {
  const r = assignProvidersToVoices(
    ["junior", "senior", "third"],
    ["anthropic", null, undefined, "glm", 42, ""],
    "seed",
  );
  // Should have 2 valid providers → both used
  assert.equal(r.providers_available_count, 2);
  assert.equal(r.unique_providers_used, 2);
});


// ═══════════════════════════════════════════════════════════════
// detectAvailableProviders
// ═══════════════════════════════════════════════════════════════

test("detectAvailableProviders: no env → empty list", () => {
  const providers = detectAvailableProviders({});
  assert.deepEqual(providers, []);
});


test("detectAvailableProviders: ANTHROPIC_API_KEY → anthropic", () => {
  const providers = detectAvailableProviders({
    ANTHROPIC_API_KEY: "sk-test-key",
  });
  assert.deepEqual(providers, ["anthropic"]);
});


test("detectAvailableProviders: all three keys → all three", () => {
  const providers = detectAvailableProviders({
    ANTHROPIC_API_KEY: "sk-a",
    GLM_API_KEY: "sk-g",
    SHADOW_LOCAL_LLM_URL: "http://127.0.0.1:11434",
  });
  assert.deepEqual(providers.sort(), ["anthropic", "glm", "local"]);
});


test("detectAvailableProviders: OLLAMA_HOST also triggers local", () => {
  const providers = detectAvailableProviders({
    OLLAMA_HOST: "http://localhost:11434",
  });
  assert.ok(providers.includes("local"));
});


// ═══════════════════════════════════════════════════════════════
// Anti-amplification: every voice gets assigned
// ═══════════════════════════════════════════════════════════════

test("every voice gets a provider — nobody left null when providers > 0", () => {
  const r = assignProvidersToVoices(
    ["v1", "v2", "v3", "v4", "v5"],
    ["anthropic", "glm"],
    "seed",
  );
  for (const voice of ["v1", "v2", "v3", "v4", "v5"]) {
    assert.ok(r.assignment[voice], `voice ${voice} not assigned`);
  }
});


test("5 voices, 2 providers → both providers used at least once", () => {
  const r = assignProvidersToVoices(
    ["v1", "v2", "v3", "v4", "v5"],
    ["anthropic", "glm"],
    "seed",
  );
  const usedSet = new Set(Object.values(r.assignment));
  assert.equal(usedSet.size, 2);
});


test("diversityReport is an alias for assignProvidersToVoices", () => {
  const a = diversityReport(["v1", "v2"], ["anthropic", "glm"], "s");
  const b = assignProvidersToVoices(["v1", "v2"], ["anthropic", "glm"], "s");
  assert.deepEqual(a, b);
});
