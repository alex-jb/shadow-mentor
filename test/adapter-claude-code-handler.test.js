// test/adapter-claude-code-handler.test.js
// v3 M2.1 — integration tests for @shadow/adapter-claude-code handler.
//
// Drives lib/handler.js with fixture stdin objects that mimic Claude
// Code hook payloads. No live Claude Code session needed. Verifies:
//   1. A full 5-event session (start → prompt → tool_call → tool_result → end)
//      lands as a signed bundle that verifies against the matching key.
//   2. The manual `sealSessionById` fallback produces a bundle equivalent
//      to what SessionEnd would have produced.
//   3. Session id mismatch between hooks lands events in the right JSONL.
//   4. Unmapped hook events (Notification, etc) are silently skipped.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync } from "node:crypto";

import {
  handleHookEvent,
  sealSessionById,
} from "../packages/adapter-claude-code/lib/handler.js";
import { verifyBundle } from "../packages/attest-core/session.js";

function freshShadowDir() {
  return mkdtempSync(join(tmpdir(), "shadow-adapter-test-"));
}

function freshKeypair() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privatePem: privateKey.export({ type: "pkcs8", format: "pem" }),
    publicPem: publicKey.export({ type: "spki", format: "pem" }),
  };
}

const SESSION_ID = "test-session-abc123";

function stdinFor(event, extras = {}) {
  return { session_id: SESSION_ID, model: "claude-sonnet-4-6", ...extras };
}

test("handleHookEvent — full 5-event session seals into a bundle that verifies", () => {
  const shadowDir = freshShadowDir();
  const { privatePem, publicPem } = freshKeypair();

  handleHookEvent({
    eventName: "SessionStart",
    stdin: stdinFor("SessionStart", { source: "startup", session_title: "unit test" }),
    shadowDir,
    privateKey: privatePem,
  });
  handleHookEvent({
    eventName: "UserPromptSubmit",
    stdin: stdinFor("UserPromptSubmit", {
      prompt_id: "p-1",
      prompt: "Please read foo.txt",
    }),
    shadowDir,
    privateKey: privatePem,
  });
  handleHookEvent({
    eventName: "PreToolUse",
    stdin: stdinFor("PreToolUse", {
      prompt_id: "p-1",
      tool_name: "Read",
      tool_input: { file_path: "/tmp/foo.txt" },
    }),
    shadowDir,
    privateKey: privatePem,
  });
  handleHookEvent({
    eventName: "PostToolUse",
    stdin: stdinFor("PostToolUse", {
      prompt_id: "p-1",
      tool_name: "Read",
      tool_output: "line 1\nline 2\n",
    }),
    shadowDir,
    privateKey: privatePem,
  });
  const finalResult = handleHookEvent({
    eventName: "SessionEnd",
    stdin: stdinFor("SessionEnd", { end_reason: "logout" }),
    shadowDir,
    privateKey: privatePem,
  });

  assert.equal(finalResult.skipped, undefined);
  assert.ok(finalResult.bundlePath, "SessionEnd must return a bundle path");
  assert.ok(existsSync(finalResult.bundlePath));

  const bundle = JSON.parse(readFileSync(finalResult.bundlePath, "utf8"));
  // start + prompt + tool_call + tool_result + session_end (auto or hook-emitted)
  assert.ok(bundle.events.length >= 5, `expected >=5 events, got ${bundle.events.length}`);
  const eventTypes = bundle.events.map((e) => e.event_type);
  assert.ok(eventTypes.includes("session_start"));
  assert.ok(eventTypes.includes("prompt"));
  assert.ok(eventTypes.includes("tool_call"));
  assert.ok(eventTypes.includes("tool_result"));
  assert.equal(eventTypes[eventTypes.length - 1], "session_end");

  const result = verifyBundle(bundle, { publicKey: publicPem });
  assert.equal(result.ok, true, result.reason);
});


test("sealSessionById — manual fallback produces a verifying bundle when SessionEnd never fired", () => {
  const shadowDir = freshShadowDir();
  const { privatePem, publicPem } = freshKeypair();

  // Simulate 4 hooks landing but SessionEnd getting dropped (Ctrl+D exit
  // before Claude Code got a chance to fire the hook).
  handleHookEvent({
    eventName: "SessionStart",
    stdin: stdinFor("SessionStart", { source: "startup" }),
    shadowDir,
    privateKey: privatePem,
  });
  handleHookEvent({
    eventName: "UserPromptSubmit",
    stdin: stdinFor("UserPromptSubmit", { prompt_id: "p-1", prompt: "hi" }),
    shadowDir,
    privateKey: privatePem,
  });
  handleHookEvent({
    eventName: "PreToolUse",
    stdin: stdinFor("PreToolUse", { prompt_id: "p-1", tool_name: "Grep", tool_input: {} }),
    shadowDir,
    privateKey: privatePem,
  });
  handleHookEvent({
    eventName: "PostToolUse",
    stdin: stdinFor("PostToolUse", { prompt_id: "p-1", tool_name: "Grep", tool_output: "0" }),
    shadowDir,
    privateKey: privatePem,
  });

  // No SessionEnd. Now the fallback runs.
  const result = sealSessionById({
    sessionId: SESSION_ID,
    shadowDir,
    privateKey: privatePem,
  });

  assert.ok(existsSync(result.bundlePath));
  const bundle = JSON.parse(readFileSync(result.bundlePath, "utf8"));
  // sealSession auto-appends session_end, so we still get one.
  const eventTypes = bundle.events.map((e) => e.event_type);
  assert.equal(eventTypes[eventTypes.length - 1], "session_end");

  const verify = verifyBundle(bundle, { publicKey: publicPem });
  assert.equal(verify.ok, true, verify.reason);
});


test("sealSessionById --partial marks session_ended_at_utc null", () => {
  const shadowDir = freshShadowDir();
  const { privatePem, publicPem } = freshKeypair();
  handleHookEvent({
    eventName: "SessionStart",
    stdin: stdinFor("SessionStart"),
    shadowDir,
    privateKey: privatePem,
  });
  handleHookEvent({
    eventName: "PreToolUse",
    stdin: stdinFor("PreToolUse", { tool_name: "Bash", tool_input: {} }),
    shadowDir,
    privateKey: privatePem,
  });

  const result = sealSessionById({
    sessionId: SESSION_ID,
    shadowDir,
    privateKey: privatePem,
    partial: true,
  });

  const bundle = JSON.parse(readFileSync(result.bundlePath, "utf8"));
  assert.equal(bundle.header.session_ended_at_utc, null);
  const verify = verifyBundle(bundle, { publicKey: publicPem });
  assert.equal(verify.ok, true, verify.reason);
});


test("sealSessionById is idempotent — running twice returns the same bundle", () => {
  const shadowDir = freshShadowDir();
  const { privatePem } = freshKeypair();
  handleHookEvent({
    eventName: "SessionStart",
    stdin: stdinFor("SessionStart"),
    shadowDir,
    privateKey: privatePem,
  });
  handleHookEvent({
    eventName: "SessionEnd",
    stdin: stdinFor("SessionEnd"),
    shadowDir,
    privateKey: privatePem,
  });

  // Bundle exists. Now call seal again — should reload the stored seal
  // and re-write bundle.json to the same content (batch_root stable).
  const b1 = JSON.parse(readFileSync(
    join(shadowDir, "sessions", SESSION_ID, "bundle.json"),
    "utf8",
  ));
  const result = sealSessionById({
    sessionId: SESSION_ID,
    shadowDir,
    privateKey: privatePem,
  });
  const b2 = JSON.parse(readFileSync(result.bundlePath, "utf8"));
  assert.equal(b1.batch_root, b2.batch_root);
});


test("handleHookEvent — unmapped events are skipped without error", () => {
  const shadowDir = freshShadowDir();
  const { privatePem } = freshKeypair();
  const result = handleHookEvent({
    eventName: "Notification",
    stdin: stdinFor("Notification"),
    shadowDir,
    privateKey: privatePem,
  });
  assert.equal(result.skipped, true);
  // No store file created.
  assert.equal(existsSync(join(shadowDir, "sessions", `${SESSION_ID}.jsonl`)), false);
});


test("handleHookEvent — events with different session_id land in separate pending queues", () => {
  const shadowDir = freshShadowDir();
  const { privatePem } = freshKeypair();
  // Phase 2 (2026-07-13): SessionStart with an empty (missing) transcript
  // defers materialization, so we look for the pending file rather than
  // the sealed store. session_id partitioning is what matters here.
  handleHookEvent({
    eventName: "SessionStart",
    stdin: { session_id: "sess-A", model: "claude-sonnet-4-6" },
    shadowDir,
    privateKey: privatePem,
  });
  handleHookEvent({
    eventName: "SessionStart",
    stdin: { session_id: "sess-B", model: "claude-sonnet-4-6" },
    shadowDir,
    privateKey: privatePem,
  });
  const aPending = join(shadowDir, "sessions", "sess-A.pending.jsonl");
  const bPending = join(shadowDir, "sessions", "sess-B.pending.jsonl");
  assert.ok(existsSync(aPending), "session A must have its own pending queue");
  assert.ok(existsSync(bPending), "session B must have its own pending queue");
  // Cross-partition sanity: neither session leaks into the other.
  assert.ok(!existsSync(join(shadowDir, "sessions", "sess-A.jsonl")));
  assert.ok(!existsSync(join(shadowDir, "sessions", "sess-B.jsonl")));
});


test("handleHookEvent — recovery works across process boundaries (simulated)", () => {
  const shadowDir = freshShadowDir();
  const { privatePem, publicPem } = freshKeypair();

  // Call 1: SessionStart lands.
  handleHookEvent({
    eventName: "SessionStart",
    stdin: stdinFor("SessionStart"),
    shadowDir,
    privateKey: privatePem,
  });

  // Call 2: UserPromptSubmit — different process would recover.
  handleHookEvent({
    eventName: "UserPromptSubmit",
    stdin: stdinFor("UserPromptSubmit", { prompt_id: "p", prompt: "hi" }),
    shadowDir,
    privateKey: privatePem,
  });

  // Seal from a "fresh" call.
  handleHookEvent({
    eventName: "SessionEnd",
    stdin: stdinFor("SessionEnd"),
    shadowDir,
    privateKey: privatePem,
  });

  const bundle = JSON.parse(readFileSync(
    join(shadowDir, "sessions", SESSION_ID, "bundle.json"),
    "utf8",
  ));
  assert.ok(bundle.events.length >= 3);
  const verify = verifyBundle(bundle, { publicKey: publicPem });
  assert.equal(verify.ok, true, verify.reason);
});
