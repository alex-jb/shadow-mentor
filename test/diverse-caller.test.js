// test/diverse-caller.test.js
// ──────────────────────────────────────────────────────────────────
// Pins the per-voice diverse-routing contract shipped 2026-07-03.
// Uses dependency-injected fake providers — no live LLM calls.

import { test } from "node:test";
import assert from "node:assert/strict";

import { callVoicesDiversely } from "../lib/diverse-caller.js";


// ─── Fake providers ────────────────────────────────────────────────

/** Fake caller that records what it was asked + returns canned text. */
function makeFakeCaller(providerName, model = "fake-model-1") {
  const calls = [];
  const caller = async ({ systemPrompt, userMessage, maxTokens }) => {
    calls.push({ systemPrompt, userMessage, maxTokens });
    return {
      text: `${providerName} says: ${systemPrompt.slice(0, 20)}`,
      model,
    };
  };
  caller.calls = calls;
  return caller;
}


/** Fake caller that throws. Simulates a provider being down. */
function makeThrowingCaller(message = "provider down") {
  return async () => {
    throw new Error(message);
  };
}


// ═══════════════════════════════════════════════════════════════
// Happy path — 3 voices routed to 3 providers
// ═══════════════════════════════════════════════════════════════

test("3 voices routed to 3 available providers", async () => {
  const anthropicCaller = makeFakeCaller("anthropic", "claude-sonnet-4-6");
  const glmCaller = makeFakeCaller("glm", "glm-5.2");
  const localCaller = makeFakeCaller("local", "phi-4-mini");

  const result = await callVoicesDiversely({
    prompts: {
      junior: "You are the junior credit analyst.",
      senior: "You are the senior credit officer.",
      third: "You are the compliance officer.",
    },
    userMessage: "Evaluate a $500K LBO loan.",
    availableProviders: ["anthropic", "glm", "local"],
    providerCallers: {
      anthropic: anthropicCaller,
      glm: glmCaller,
      local: localCaller,
    },
    seed: "test-seed-1",
  });

  // Diversity ceiling met
  assert.equal(result.providers_available_count, 3);
  assert.equal(result.unique_providers_used, 3);
  assert.equal(result.diversity_score, 1.0);

  // Every voice got a text response
  assert.ok(result.voice_results.junior.text);
  assert.ok(result.voice_results.senior.text);
  assert.ok(result.voice_results.third.text);

  // per_voice_models correctly stamped with provider/model
  assert.ok(result.per_voice_models.junior.includes("/"));
  assert.ok(result.per_voice_models.senior.includes("/"));
  assert.ok(result.per_voice_models.third.includes("/"));

  // At least 3 providers used → each provider called at least once
  const totalCalls = anthropicCaller.calls.length +
                     glmCaller.calls.length +
                     localCaller.calls.length;
  assert.equal(totalCalls, 3);
});


test("provider ceiling exposed when only 1 provider available", async () => {
  const anthropicCaller = makeFakeCaller("anthropic");

  const result = await callVoicesDiversely({
    prompts: {
      junior: "prompt-1",
      senior: "prompt-2",
      third: "prompt-3",
    },
    userMessage: "test",
    availableProviders: ["anthropic"],
    providerCallers: { anthropic: anthropicCaller },
  });

  // All 3 voices ran on anthropic → not actually diverse
  assert.equal(result.providers_available_count, 1);
  assert.equal(result.unique_providers_used, 1);
  // Every voice routed to anthropic
  assert.equal(result.voice_results.junior.provider, "anthropic");
  assert.equal(result.voice_results.senior.provider, "anthropic");
  assert.equal(result.voice_results.third.provider, "anthropic");
});


// ═══════════════════════════════════════════════════════════════
// Determinism
// ═══════════════════════════════════════════════════════════════

test("same seed → same assignment (reproducible for audit)", async () => {
  const setup = () => ({
    prompts: { a: "p1", b: "p2", c: "p3" },
    userMessage: "u",
    availableProviders: ["anthropic", "glm", "local"],
    providerCallers: {
      anthropic: makeFakeCaller("anthropic"),
      glm: makeFakeCaller("glm"),
      local: makeFakeCaller("local"),
    },
    seed: "reproduce-me",
  });

  const r1 = await callVoicesDiversely(setup());
  const r2 = await callVoicesDiversely(setup());
  assert.deepEqual(r1.assignment, r2.assignment);
});


// ═══════════════════════════════════════════════════════════════
// Failure handling
// ═══════════════════════════════════════════════════════════════

test("one provider throwing does NOT silently substitute another", async () => {
  // The whole point of diverse routing is defeated if a broken
  // anthropic call falls back to glm — we'd be back to single-
  // provider land without noticing. Instead, capture the error
  // per-voice so the caller can decide policy (retry / escalate
  // / accept-partial).
  const result = await callVoicesDiversely({
    prompts: { a: "p1", b: "p2" },
    userMessage: "u",
    availableProviders: ["anthropic", "glm"],
    providerCallers: {
      anthropic: makeThrowingCaller("anthropic-500"),
      glm: makeFakeCaller("glm"),
    },
    seed: "test",
  });
  // One voice got an error, one got a text
  const errored = Object.values(result.voice_results).filter((v) => v.error);
  const succeeded = Object.values(result.voice_results).filter((v) => v.text);
  assert.equal(errored.length, 1);
  assert.equal(succeeded.length, 1);
  // The error message is preserved for the caller
  assert.match(errored[0].error, /anthropic-500/);
});


test("unavailable provider assigned → error captured, other voices continue", async () => {
  // If detectAvailableProviders reports glm but glm caller is
  // missing from the providerCallers map (misconfig at the wire-
  // in point), we capture "no caller for provider" rather than
  // crashing the whole request.
  const result = await callVoicesDiversely({
    prompts: { a: "p1", b: "p2" },
    userMessage: "u",
    availableProviders: ["anthropic", "glm"],
    providerCallers: {
      anthropic: makeFakeCaller("anthropic"),
      // glm caller missing
    },
    seed: "test",
  });
  const errored = Object.values(result.voice_results).filter((v) => v.error);
  const succeeded = Object.values(result.voice_results).filter((v) => v.text);
  assert.ok(errored.length + succeeded.length === 2);
  if (errored.length > 0) {
    assert.match(errored[0].error, /no caller for provider/);
  }
});


// ═══════════════════════════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════════════════════════

test("empty prompts → empty voice_results, score 0", async () => {
  const result = await callVoicesDiversely({
    prompts: {},
    userMessage: "u",
    availableProviders: ["anthropic"],
    providerCallers: { anthropic: makeFakeCaller("anthropic") },
  });
  assert.deepEqual(result.voice_results, {});
  assert.equal(result.diversity_score, 0);
});


test("no providers → every voice gets null provider + error", async () => {
  const result = await callVoicesDiversely({
    prompts: { a: "p1", b: "p2" },
    userMessage: "u",
    availableProviders: [],
    providerCallers: {},
  });
  for (const v of Object.values(result.voice_results)) {
    assert.equal(v.provider, null);
    assert.ok(v.error);
  }
});


test("systemPrompt is passed through to the assigned provider caller", async () => {
  // Sanity: the fake provider stores the systemPrompt it received.
  // Confirms the wire-through is correct (no cross-contamination
  // where senior's prompt lands on the junior provider's caller).
  const anthropic = makeFakeCaller("anthropic");
  const glm = makeFakeCaller("glm");
  await callVoicesDiversely({
    prompts: {
      junior: "SYSTEM-JUNIOR",
      senior: "SYSTEM-SENIOR",
    },
    userMessage: "u",
    availableProviders: ["anthropic", "glm"],
    providerCallers: { anthropic, glm },
    seed: "fixed",
  });
  // Total 2 calls across the two callers
  assert.equal(anthropic.calls.length + glm.calls.length, 2);
  // Every prompt used appeared exactly once
  const allPrompts = [
    ...anthropic.calls.map((c) => c.systemPrompt),
    ...glm.calls.map((c) => c.systemPrompt),
  ];
  assert.ok(allPrompts.includes("SYSTEM-JUNIOR"));
  assert.ok(allPrompts.includes("SYSTEM-SENIOR"));
});


// ═══════════════════════════════════════════════════════════════
// Anti-amplification claim: measurable diversity when triggered
// ═══════════════════════════════════════════════════════════════

test("with 2+ providers, at least 2 unique providers are used", async () => {
  const result = await callVoicesDiversely({
    prompts: { a: "p1", b: "p2", c: "p3" },
    userMessage: "u",
    availableProviders: ["anthropic", "glm"],
    providerCallers: {
      anthropic: makeFakeCaller("anthropic"),
      glm: makeFakeCaller("glm"),
    },
    seed: "anti-amp-test",
  });
  assert.ok(result.unique_providers_used >= 2,
    `expected ≥2 unique providers, got ${result.unique_providers_used}`);
});


test("procurement can distinguish 'diverse deployment' from 'single-provider deployment'", async () => {
  // Same seed + same voice names + different provider lists.
  // Auditor should see the ceiling clearly.
  const oneProviderResult = await callVoicesDiversely({
    prompts: { a: "p1", b: "p2", c: "p3" },
    userMessage: "u",
    availableProviders: ["anthropic"],
    providerCallers: { anthropic: makeFakeCaller("anthropic") },
    seed: "compare",
  });
  const threeProviderResult = await callVoicesDiversely({
    prompts: { a: "p1", b: "p2", c: "p3" },
    userMessage: "u",
    availableProviders: ["anthropic", "glm", "local"],
    providerCallers: {
      anthropic: makeFakeCaller("anthropic"),
      glm: makeFakeCaller("glm"),
      local: makeFakeCaller("local"),
    },
    seed: "compare",
  });
  assert.equal(oneProviderResult.providers_available_count, 1);
  assert.equal(threeProviderResult.providers_available_count, 3);
  assert.ok(threeProviderResult.unique_providers_used > oneProviderResult.unique_providers_used);
});
