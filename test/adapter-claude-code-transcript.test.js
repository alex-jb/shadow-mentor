// test/adapter-claude-code-transcript.test.js
// v3 M2.2 — adapter reads Claude Code transcript JSONL to pin real
// agent.version + model_id in the sealed bundle header.
//
// Fixture-driven: no live Claude Code needed. We build a fake transcript
// with the shape verified 2026-07-13 against a real
// ~/.claude/projects/*/*.jsonl file and drive the handler with it.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync } from "node:crypto";

import {
  handleHookEvent,
} from "../packages/adapter-claude-code/lib/handler.js";
import { enrichFromTranscript } from "../packages/adapter-claude-code/lib/transcript.js";
import { verifyBundle } from "../packages/attest-core/session.js";

function freshShadowDir() {
  return mkdtempSync(join(tmpdir(), "shadow-adapter-m22-"));
}
function freshKeypair() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privatePem: privateKey.export({ type: "pkcs8", format: "pem" }),
    publicPem: publicKey.export({ type: "spki", format: "pem" }),
  };
}

function writeFixtureTranscript(dir, name, lines) {
  const path = join(dir, name);
  writeFileSync(path, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  return path;
}

const REAL_SCHEMA_ASSISTANT = {
  parentUuid: "abc",
  isSidechain: false,
  type: "assistant",
  message: {
    id: "msg_01",
    type: "message",
    role: "assistant",
    model: "claude-opus-4-7",
    content: [{ type: "text", text: "hi" }],
    stop_reason: "end_turn",
  },
  uuid: "u1",
  timestamp: "2026-07-13T13:45:09.930Z",
  sessionId: "sess-m22",
  version: "2.1.116",
  gitBranch: "master",
};

const REAL_SCHEMA_USER = {
  type: "user",
  message: { role: "user", content: "read foo.txt" },
  uuid: "u0",
  timestamp: "2026-07-13T13:45:00.000Z",
  sessionId: "sess-m22",
  version: "2.1.116",
};


// ── unit: enrichFromTranscript ─────────────────────────────

test("enrichFromTranscript returns nulls on missing path", () => {
  assert.deepEqual(
    enrichFromTranscript(undefined),
    { agentVersion: null, modelId: null },
  );
  assert.deepEqual(
    enrichFromTranscript("/nonexistent/nowhere.jsonl"),
    { agentVersion: null, modelId: null },
  );
});

test("enrichFromTranscript pulls agent.version + assistant model from real-shape lines", () => {
  const dir = freshShadowDir();
  const path = writeFixtureTranscript(dir, "t.jsonl", [
    REAL_SCHEMA_USER,
    REAL_SCHEMA_ASSISTANT,
  ]);
  const result = enrichFromTranscript(path);
  assert.equal(result.agentVersion, "2.1.116");
  assert.equal(result.modelId, "claude-opus-4-7");
});

test("enrichFromTranscript picks the LATEST assistant model when session switched mid-flight", () => {
  const dir = freshShadowDir();
  const path = writeFixtureTranscript(dir, "t.jsonl", [
    REAL_SCHEMA_USER,
    { ...REAL_SCHEMA_ASSISTANT, uuid: "u1", message: { ...REAL_SCHEMA_ASSISTANT.message, model: "claude-sonnet-4-6" } },
    { ...REAL_SCHEMA_ASSISTANT, uuid: "u2", timestamp: "2026-07-13T13:46:00.000Z", message: { ...REAL_SCHEMA_ASSISTANT.message, model: "claude-opus-4-7" } },
  ]);
  const result = enrichFromTranscript(path);
  assert.equal(result.modelId, "claude-opus-4-7", "should pick last (latest) assistant model");
});

test("enrichFromTranscript survives malformed lines without throwing", () => {
  const dir = freshShadowDir();
  const path = join(dir, "t.jsonl");
  writeFileSync(
    path,
    [
      JSON.stringify(REAL_SCHEMA_ASSISTANT),
      "{ garbage not-json",
      "",
      JSON.stringify(REAL_SCHEMA_USER),
    ].join("\n"),
  );
  // Just asserts no throw + picks correct values regardless of the bad line.
  const result = enrichFromTranscript(path);
  assert.equal(result.agentVersion, "2.1.116");
  assert.equal(result.modelId, "claude-opus-4-7");
});

test("enrichFromTranscript returns nulls when transcript has no assistant messages", () => {
  const dir = freshShadowDir();
  const path = writeFixtureTranscript(dir, "t.jsonl", [
    REAL_SCHEMA_USER,
    { type: "attachment", version: "2.1.116" }, // system/hook line only
  ]);
  const result = enrichFromTranscript(path);
  assert.equal(result.agentVersion, "2.1.116");
  assert.equal(result.modelId, null);
});


// ── integration: handleHookEvent uses transcript for header ─────────

test("handleHookEvent — SessionStart with populated transcript pins real model + version in header", () => {
  const shadowDir = freshShadowDir();
  const { privatePem, publicPem } = freshKeypair();
  const transcriptPath = writeFixtureTranscript(shadowDir, "transcript.jsonl", [
    REAL_SCHEMA_USER,
    REAL_SCHEMA_ASSISTANT,
  ]);

  handleHookEvent({
    eventName: "SessionStart",
    stdin: { session_id: "sess-m22", transcript_path: transcriptPath, source: "resume" },
    shadowDir,
    privateKey: privatePem,
  });
  const result = handleHookEvent({
    eventName: "SessionEnd",
    stdin: { session_id: "sess-m22", transcript_path: transcriptPath, end_reason: "logout" },
    shadowDir,
    privateKey: privatePem,
  });

  const bundle = JSON.parse(readFileSync(result.bundlePath, "utf8"));
  assert.equal(bundle.header.agent.version, "2.1.116");
  assert.equal(bundle.header.models[0].model_id, "claude-opus-4-7");
  const verify = verifyBundle(bundle, { publicKey: publicPem });
  assert.equal(verify.ok, true, verify.reason);
});

test("Phase 2: SessionStart with empty transcript is deferred, materialized when a later hook finds a model", () => {
  const shadowDir = freshShadowDir();
  const { privatePem, publicPem } = freshKeypair();
  const transcriptPath = join(shadowDir, "transcript.jsonl");
  const sessionId = "sess-m22b";

  // Fresh session: transcript exists but is empty at SessionStart.
  writeFileSync(transcriptPath, "");
  const r1 = handleHookEvent({
    eventName: "SessionStart",
    stdin: { session_id: sessionId, transcript_path: transcriptPath, source: "startup" },
    shadowDir,
    privateKey: privatePem,
  });
  // Deferred — no store yet.
  assert.equal(r1.skipped, true);
  assert.match(r1.reason, /buffered/);
  assert.ok(existsSync(join(shadowDir, "sessions", `${sessionId}.pending.jsonl`)),
    "expected pending queue while deferred");
  assert.ok(!existsSync(join(shadowDir, "sessions", `${sessionId}.jsonl`)),
    "sealed store must NOT exist yet");

  // Now the transcript gets populated (simulates Claude Code writing assistant response).
  writeFileSync(transcriptPath,
    [JSON.stringify(REAL_SCHEMA_USER), JSON.stringify(REAL_SCHEMA_ASSISTANT)].join("\n"),
  );

  // Next hook triggers materialization + replay of the buffered SessionStart.
  handleHookEvent({
    eventName: "PostToolUse",
    stdin: { session_id: sessionId, transcript_path: transcriptPath, tool_name: "Read", tool_output: "hi" },
    shadowDir,
    privateKey: privatePem,
  });
  assert.ok(existsSync(join(shadowDir, "sessions", `${sessionId}.jsonl`)),
    "store must exist after materialization");
  assert.ok(!existsSync(join(shadowDir, "sessions", `${sessionId}.pending.jsonl`)),
    "pending queue must be cleared after replay");

  const result = handleHookEvent({
    eventName: "SessionEnd",
    stdin: { session_id: sessionId, transcript_path: transcriptPath, end_reason: "logout" },
    shadowDir,
    privateKey: privatePem,
  });

  const bundle = JSON.parse(readFileSync(result.bundlePath, "utf8"));
  // Phase 2 win: header now pins the real model (was "unknown" pre-Phase-2).
  assert.equal(bundle.header.models[0].model_id, "claude-opus-4-7");
  assert.equal(bundle.header.agent.version, "2.1.116");

  // Replay preserved the SessionStart event before the current PostToolUse + SessionEnd.
  const eventTypes = bundle.events.map((e) => e.event_type);
  assert.equal(eventTypes[0], "session_start", "SessionStart must be first (replayed)");
  assert.ok(eventTypes.includes("tool_result"));
  assert.equal(eventTypes[eventTypes.length - 1], "session_end");

  const verify = verifyBundle(bundle, { publicKey: publicPem });
  assert.equal(verify.ok, true, verify.reason);
});

test("Phase 2: SessionEnd force-materializes even if transcript never yields a model (fallback)", () => {
  const shadowDir = freshShadowDir();
  const { privatePem, publicPem } = freshKeypair();
  const transcriptPath = join(shadowDir, "transcript.jsonl");
  const sessionId = "sess-m22c";
  writeFileSync(transcriptPath, ""); // transcript stays empty the whole time

  handleHookEvent({
    eventName: "SessionStart",
    stdin: { session_id: sessionId, transcript_path: transcriptPath, source: "startup" },
    shadowDir,
    privateKey: privatePem,
  });
  handleHookEvent({
    eventName: "PreToolUse",
    stdin: { session_id: sessionId, transcript_path: transcriptPath, tool_name: "Bash", tool_input: {} },
    shadowDir,
    privateKey: privatePem,
  });
  // Both above deferred to pending. SessionEnd force-materializes.
  const result = handleHookEvent({
    eventName: "SessionEnd",
    stdin: { session_id: sessionId, transcript_path: transcriptPath, end_reason: "logout" },
    shadowDir,
    privateKey: privatePem,
  });

  const bundle = JSON.parse(readFileSync(result.bundlePath, "utf8"));
  // Truly-fresh session with no model discovery — header is "unknown".
  assert.equal(bundle.header.models[0].model_id, "unknown");
  // But the pending events still replay in order, then SessionEnd caps.
  const eventTypes = bundle.events.map((e) => e.event_type);
  assert.equal(eventTypes[0], "session_start");
  assert.ok(eventTypes.includes("tool_call"));
  assert.equal(eventTypes[eventTypes.length - 1], "session_end");
  const verify = verifyBundle(bundle, { publicKey: publicPem });
  assert.equal(verify.ok, true, verify.reason);
});

test("handleHookEvent — missing transcript_path falls back cleanly to 'unknown'", () => {
  const shadowDir = freshShadowDir();
  const { privatePem, publicPem } = freshKeypair();
  handleHookEvent({
    eventName: "SessionStart",
    stdin: { session_id: "sess-m22c" }, // no transcript_path
    shadowDir,
    privateKey: privatePem,
  });
  const result = handleHookEvent({
    eventName: "SessionEnd",
    stdin: { session_id: "sess-m22c", end_reason: "logout" },
    shadowDir,
    privateKey: privatePem,
  });
  const bundle = JSON.parse(readFileSync(result.bundlePath, "utf8"));
  assert.equal(bundle.header.agent.version, "unknown");
  assert.equal(bundle.header.models[0].model_id, "unknown");
  const verify = verifyBundle(bundle, { publicKey: publicPem });
  assert.equal(verify.ok, true, verify.reason);
});
