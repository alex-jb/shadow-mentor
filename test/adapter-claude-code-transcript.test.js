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

test("handleHookEvent — session_end payload carries discovered_model_id even if header was 'unknown'", () => {
  const shadowDir = freshShadowDir();
  const { privatePem, publicPem } = freshKeypair();
  const transcriptPath = join(shadowDir, "transcript.jsonl");

  // Fresh session: transcript exists but is empty at SessionStart.
  writeFileSync(transcriptPath, "");
  handleHookEvent({
    eventName: "SessionStart",
    stdin: { session_id: "sess-m22b", transcript_path: transcriptPath, source: "startup" },
    shadowDir,
    privateKey: privatePem,
  });

  // Now the transcript gets populated (simulates Claude Code writing assistant response).
  writeFileSync(transcriptPath,
    [JSON.stringify(REAL_SCHEMA_USER), JSON.stringify(REAL_SCHEMA_ASSISTANT)].join("\n"),
  );

  const result = handleHookEvent({
    eventName: "SessionEnd",
    stdin: { session_id: "sess-m22b", transcript_path: transcriptPath, end_reason: "logout" },
    shadowDir,
    privateKey: privatePem,
  });

  const bundle = JSON.parse(readFileSync(result.bundlePath, "utf8"));
  // Header still "unknown" — session was created before transcript had model.
  assert.equal(bundle.header.models[0].model_id, "unknown");
  // But session_end payload carries the discovery.
  const sessionEnd = bundle.events.find((e) => e.event_type === "session_end");
  assert.ok(sessionEnd, "expected session_end event");
  // payload is hashed but not embedded — we need to check via the extensions we set.
  // Extensions we DO embed inline on the event record.
  assert.equal(sessionEnd.extensions?.discovered_model_id, "claude-opus-4-7");
  assert.equal(sessionEnd.extensions?.discovered_agent_version, "2.1.116");

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
