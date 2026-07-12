// test/adapter-claude-code-mapping.test.js
// v3 M2.1 — unit tests for @shadow/adapter-claude-code mapping.
//
// Tests the pure functions in packages/adapter-claude-code/lib/mapping.js
// (mapEvent, actorFor, extractPayload). These do not require a live
// Claude Code session — that validation Alex does per rule 11.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  mapEvent,
  actorFor,
  extractPayload,
} from "../packages/adapter-claude-code/lib/mapping.js";

const sha256 = (s) => createHash("sha256").update(String(s ?? "")).digest("hex");

// ── mapEvent ──────────────────────────────────────────────────

test("mapEvent maps every documented hook event to a Shadow event type", () => {
  assert.equal(mapEvent("SessionStart"),       "session_start");
  assert.equal(mapEvent("UserPromptSubmit"),   "prompt");
  assert.equal(mapEvent("PreToolUse"),         "tool_call");
  assert.equal(mapEvent("PostToolUse"),        "tool_result");
  assert.equal(mapEvent("PostToolUseFailure"), "tool_error");
  assert.equal(mapEvent("SubagentStop"),       "subagent_stop");
  assert.equal(mapEvent("Stop"),               "turn_end");
  assert.equal(mapEvent("PreCompact"),         "pre_compact");
  assert.equal(mapEvent("SessionEnd"),         "session_end");
});

test("mapEvent returns null for unknown events (Notification, TeammateIdle, etc)", () => {
  assert.equal(mapEvent("Notification"), null);
  assert.equal(mapEvent("TeammateIdle"), null);
  assert.equal(mapEvent(""), null);
  assert.equal(mapEvent(undefined), null);
});

// ── actorFor ──────────────────────────────────────────────────

test("actorFor tags UserPromptSubmit as user, everything else as agent", () => {
  assert.equal(actorFor("UserPromptSubmit"), "user");
  assert.equal(actorFor("SessionStart"), "agent");
  assert.equal(actorFor("PreToolUse"), "agent");
  assert.equal(actorFor("PostToolUse"), "agent");
  assert.equal(actorFor("Stop"), "agent");
});

// ── extractPayload ─────────────────────────────────────────────

test("extractPayload for SessionStart captures source + model + title", () => {
  const p = extractPayload("SessionStart", {
    source: "startup",
    model: "claude-sonnet-5",
    session_title: "Refactor auth",
  });
  assert.deepEqual(p, { source: "startup", model: "claude-sonnet-5", title: "Refactor auth" });
});

test("extractPayload for UserPromptSubmit hashes prompt + preserves prompt_id", () => {
  const p = extractPayload("UserPromptSubmit", {
    prompt_id: "prompt-uuid-123",
    prompt: "Please refactor the auth module.",
  });
  assert.equal(p.prompt_id, "prompt-uuid-123");
  assert.equal(p.prompt_sha256, sha256("Please refactor the auth module."));
});

test("extractPayload never stores raw prompt text — only hash", () => {
  const p = extractPayload("UserPromptSubmit", { prompt_id: "x", prompt: "secret business info" });
  // Explicit guarantee: raw prompt does not appear anywhere in the payload.
  const serialized = JSON.stringify(p);
  assert.equal(serialized.includes("secret business info"), false);
  assert.equal(serialized.includes(sha256("secret business info")), true);
});

test("extractPayload for PreToolUse preserves tool_name + tool_input verbatim", () => {
  const p = extractPayload("PreToolUse", {
    prompt_id: "p",
    tool_name: "Read",
    tool_input: { file_path: "/tmp/a.txt", limit: 100 },
  });
  assert.equal(p.tool, "Read");
  assert.deepEqual(p.tool_input, { file_path: "/tmp/a.txt", limit: 100 });
});

test("extractPayload for PostToolUse hashes tool_output — no raw output stored", () => {
  const p = extractPayload("PostToolUse", {
    prompt_id: "p",
    tool_name: "Read",
    tool_output: "line 1\nline 2\nsensitive line 3\n",
  });
  assert.equal(p.tool, "Read");
  assert.equal(p.output_sha256, sha256("line 1\nline 2\nsensitive line 3\n"));
  assert.equal(JSON.stringify(p).includes("sensitive line 3"), false);
});

test("extractPayload for PostToolUseFailure captures error string, not tool_output", () => {
  const p = extractPayload("PostToolUseFailure", {
    prompt_id: "p",
    tool_name: "Write",
    error: "ENOENT: no such file or directory",
  });
  assert.equal(p.tool, "Write");
  assert.equal(p.error, "ENOENT: no such file or directory");
  assert.equal(p.output_sha256, undefined);
});

test("extractPayload for SubagentStop captures agent_type + agent_id + last message", () => {
  const p = extractPayload("SubagentStop", {
    agent_type: "explore",
    agent_id: "subagent-abc",
    last_assistant_message: "Found 3 candidates in src/auth/",
  });
  assert.deepEqual(p, {
    agent_type: "explore",
    agent_id: "subagent-abc",
    last: "Found 3 candidates in src/auth/",
  });
});

test("extractPayload for Stop captures last assistant message", () => {
  const p = extractPayload("Stop", {
    prompt_id: "p",
    last_assistant_message: "Done. All tests pass.",
  });
  assert.equal(p.last, "Done. All tests pass.");
  assert.equal(p.prompt_id, "p");
});

test("extractPayload for PreCompact is deliberately empty (never blocks)", () => {
  assert.deepEqual(extractPayload("PreCompact", {}), {});
});

test("extractPayload for SessionEnd captures end_reason", () => {
  const p = extractPayload("SessionEnd", { end_reason: "logout" });
  assert.equal(p.end_reason, "logout");
});

test("extractPayload handles missing fields gracefully — nulls, not throws", () => {
  // If Anthropic silently adds/removes fields, adapter should not crash.
  const p = extractPayload("SessionStart", {});
  assert.deepEqual(p, { source: null, model: null, title: null });
  const q = extractPayload("PostToolUse", {});
  assert.equal(q.tool, null);
  assert.equal(q.output_sha256, sha256("")); // hash of empty string, not crash
});

test("extractPayload returns empty object for unknown events", () => {
  assert.deepEqual(extractPayload("SomeNewHookEventAnthropicWillAdd", { data: 1 }), {});
});

// ── Regression: schema-version drift catcher ──────────────────
//
// If Anthropic adds a new hook event and we ship an adapter that
// ignores it (returns null from mapEvent), the SessionEnd bundle
// will be missing evidence for those turns. This test doesn't fix
// that, but it makes the coverage decision visible.

test("regression: 9 events currently mapped (Alex updates when Anthropic changes surface)", () => {
  const documented = [
    "SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse",
    "PostToolUseFailure", "SubagentStop", "Stop", "PreCompact", "SessionEnd",
  ];
  for (const e of documented) {
    assert.notEqual(mapEvent(e), null, `event ${e} must be mapped`);
  }
});
