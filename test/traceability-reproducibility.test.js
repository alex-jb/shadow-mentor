// Contract tests for the reproducibility artifact — Claude Science shape
// (2026-06-30 Anthropic launch).
//
// The point: any regression that drops one of the six required fields
// (model / prompt_sha256 / message_history / generated_at_utc /
// env_signature / traceability_dict) fails CI before it hits a
// procurement audit. Same reason we contract-test the source-citation
// TRACEABILITY constant — a partial audit-trail is worse than none at
// all in a regulated deployment.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReproducibilityArtifact, TRACEABILITY } from "../lib/traceability.js";

test("builds an artifact with all six required top-level fields", () => {
  const artifact = buildReproducibilityArtifact({
    model: "anthropic/claude-sonnet-4-6",
    systemPrompt: "You are the Credit Fundamentals voice.",
    messageHistory: [
      { role: "user", content: "FICO 740 DTI 0.28, qualifying?" },
      { role: "assistant", content: "Meets Addendum A floor." },
    ],
    packageVersion: "1.2.0",
  });
  for (const key of [
    "model",
    "prompt_sha256",
    "message_history",
    "generated_at_utc",
    "env_signature",
    "traceability_dict",
  ]) {
    assert.ok(key in artifact, `missing required field: ${key}`);
  }
});

test("prompt_sha256 is a 64-char hex string when systemPrompt is supplied", () => {
  const a = buildReproducibilityArtifact({
    systemPrompt: "system prompt example",
    messageHistory: [],
  });
  assert.match(a.prompt_sha256, /^[0-9a-f]{64}$/);
});

test("same systemPrompt yields the same hash — determinism for audit replay", () => {
  const a1 = buildReproducibilityArtifact({
    systemPrompt: "identical prompt",
    messageHistory: [],
  });
  const a2 = buildReproducibilityArtifact({
    systemPrompt: "identical prompt",
    messageHistory: [],
  });
  assert.equal(a1.prompt_sha256, a2.prompt_sha256);
});

test("different systemPrompt yields different hash", () => {
  const a1 = buildReproducibilityArtifact({
    systemPrompt: "prompt A",
    messageHistory: [],
  });
  const a2 = buildReproducibilityArtifact({
    systemPrompt: "prompt B",
    messageHistory: [],
  });
  assert.notEqual(a1.prompt_sha256, a2.prompt_sha256);
});

test("prompt_sha256 is null when systemPrompt is absent (graceful degrade)", () => {
  const a = buildReproducibilityArtifact({ messageHistory: [] });
  assert.equal(a.prompt_sha256, null);
});

test("message_history preserves the caller's turn sequence verbatim", () => {
  const turns = [
    { role: "user", content: "Q1" },
    { role: "assistant", content: "A1" },
    { role: "user", content: "Q2 with unicode 🎯 and quotes \"here\"" },
    { role: "assistant", content: "A2" },
  ];
  const a = buildReproducibilityArtifact({ messageHistory: turns });
  assert.deepEqual(a.message_history, turns);
});

test("message_history defaults to [] when caller omits it — never undefined", () => {
  const a = buildReproducibilityArtifact({});
  assert.deepEqual(a.message_history, []);
});

test("generated_at_utc is ISO 8601 UTC when caller doesn't supply one", () => {
  const a = buildReproducibilityArtifact({});
  // ISO 8601 with Z suffix — the shape examiner audit chains expect
  assert.match(a.generated_at_utc, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
});

test("generated_at_utc uses caller-supplied value when given", () => {
  const a = buildReproducibilityArtifact({
    generatedAtUtc: "2026-07-02T15:30:00.000Z",
  });
  assert.equal(a.generated_at_utc, "2026-07-02T15:30:00.000Z");
});

test("env_signature has node + shadow_mentor version fields", () => {
  const a = buildReproducibilityArtifact({
    packageVersion: "1.2.0",
    nodeVersion: "v20.10.0",
  });
  assert.equal(a.env_signature.node, "v20.10.0");
  assert.equal(a.env_signature.shadow_mentor, "1.2.0");
});

test("env_signature defaults to detected node + 'unknown' package", () => {
  const a = buildReproducibilityArtifact({});
  assert.ok(a.env_signature.node.length > 0);
  assert.equal(a.env_signature.shadow_mentor, "unknown");
});

test("model defaults to 'unknown' rather than undefined", () => {
  const a = buildReproducibilityArtifact({});
  assert.equal(a.model, "unknown");
});

test("traceability_dict is the exact TRACEABILITY constant — not a copy", () => {
  // Preserving reference identity means downstream code can compare
  // strict-equal against TRACEABILITY without worrying about drift.
  const a = buildReproducibilityArtifact({});
  assert.equal(a.traceability_dict, TRACEABILITY);
});

test("full round-trip: artifact is JSON-serializable + parseable", () => {
  const artifact = buildReproducibilityArtifact({
    model: "anthropic/claude-sonnet-4-6",
    systemPrompt: "You are the Risk Officer voice.",
    messageHistory: [
      { role: "user", content: "LBO 4.4× leverage — Policy 4.3 applicable?" },
      { role: "assistant", content: "Escalate — outside Risk Appetite Note bounds." },
    ],
    generatedAtUtc: "2026-07-02T15:30:00.000Z",
    packageVersion: "1.2.0",
    nodeVersion: "v20.10.0",
  });
  const rehydrated = JSON.parse(JSON.stringify(artifact));
  assert.deepEqual(rehydrated.env_signature, {
    node: "v20.10.0",
    shadow_mentor: "1.2.0",
  });
  assert.equal(rehydrated.message_history.length, 2);
  assert.match(rehydrated.prompt_sha256, /^[0-9a-f]{64}$/);
});
