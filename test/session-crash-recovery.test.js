// test/session-crash-recovery.test.js
// v3 M1.2 acceptance criterion per docs/roadmap/SHADOW_V3_BRIEF.md:
//   "kill -9 mid-session leaves a verifiable partial bundle"
//
// We can't actually SIGKILL from a unit test, so we simulate the crash by
// dropping the in-memory session and re-reading from the durable store.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  appendEvent,
  createSession,
  recoverSession,
  sealPartialBundle,
  sealSession,
  verifyBundle,
} from "../packages/attest-core/session.js";
import {
  createFileStore,
  listSessionFiles,
} from "../packages/attest-core/store-file.js";

function tempDir() {
  return mkdtempSync(join(tmpdir(), "shadow-crash-recovery-"));
}

function testKeys() {
  return generateKeyPairSync("ed25519");
}


test("createFileStore writes and reads back lines", () => {
  const dir = tempDir();
  try {
    const store = createFileStore({ path: join(dir, "s1.jsonl") });
    store.appendLine(JSON.stringify({ kind: "header", n: 1 }));
    store.appendLine(JSON.stringify({ kind: "event", n: 2 }));
    const lines = store.readLines();
    assert.equal(lines.length, 2);
    assert.deepEqual(JSON.parse(lines[0]), { kind: "header", n: 1 });
    assert.deepEqual(JSON.parse(lines[1]), { kind: "event", n: 2 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


test("createFileStore returns [] when file doesn't exist yet", () => {
  const dir = tempDir();
  try {
    const store = createFileStore({ path: join(dir, "nonexistent.jsonl") });
    assert.deepEqual(store.readLines(), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


test("createSession with store writes header line synchronously", () => {
  const dir = tempDir();
  try {
    const { privateKey } = testKeys();
    const store = createFileStore({ path: join(dir, "s2.jsonl") });
    createSession({
      agent: { name: "test", version: "1.0" },
      models: [{ model_id: "m", provider: "test" }],
      environmentFingerprint: { os: "test", node_version: "test" },
      keyId: "k",
      privateKey,
      store,
    });
    const lines = store.readLines();
    assert.equal(lines.length, 1);
    const parsed = JSON.parse(lines[0]);
    assert.equal(parsed.kind, "header");
    assert.equal(parsed.header.agent.name, "test");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


test("appendEvent with store writes one event line per call", () => {
  const dir = tempDir();
  try {
    const { privateKey } = testKeys();
    const store = createFileStore({ path: join(dir, "s3.jsonl") });
    const s = createSession({
      agent: { name: "test", version: "1.0" },
      models: [{ model_id: "m", provider: "test" }],
      environmentFingerprint: { os: "test", node_version: "test" },
      keyId: "k",
      privateKey,
      store,
    });
    appendEvent(s, { event_type: "user_message", actor: "user", payload: { text: "a" } });
    appendEvent(s, { event_type: "user_message", actor: "user", payload: { text: "b" } });
    const lines = store.readLines();
    assert.equal(lines.length, 3); // header + 2 events
    assert.equal(JSON.parse(lines[1]).kind, "event");
    assert.equal(JSON.parse(lines[2]).kind, "event");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


test("sealSession with store writes seal line last", () => {
  const dir = tempDir();
  try {
    const { privateKey } = testKeys();
    const store = createFileStore({ path: join(dir, "s4.jsonl") });
    const s = createSession({
      agent: { name: "test", version: "1.0" },
      models: [{ model_id: "m", provider: "test" }],
      environmentFingerprint: { os: "test", node_version: "test" },
      keyId: "k",
      privateKey,
      store,
    });
    appendEvent(s, { event_type: "user_message", actor: "user", payload: {} });
    sealSession(s);
    const lines = store.readLines();
    // header + user_message + auto session_end + seal = 4 lines
    assert.equal(lines.length, 4);
    assert.equal(JSON.parse(lines[lines.length - 1]).kind, "seal");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


test("crash mid-session — recover, partial-seal, verify", () => {
  const dir = tempDir();
  try {
    const { publicKey, privateKey } = testKeys();
    const storePath = join(dir, "crashed.jsonl");

    // Phase 1: original process runs, appends 5 events, then "crashes"
    // (we simply drop the session reference).
    {
      const store = createFileStore({ path: storePath });
      const s = createSession({
        agent: { name: "test", version: "1.0" },
        models: [{ model_id: "m", provider: "test" }],
        environmentFingerprint: { os: "test", node_version: "test" },
        keyId: "prod-2026-Q3",
        privateKey,
        store,
      });
      for (let i = 0; i < 5; i++) {
        appendEvent(s, {
          event_type: "tool_call",
          actor: "agent",
          payload: { iter: i },
        });
      }
      // No sealSession call — simulates SIGKILL between event 5 and session_end.
    }

    // Phase 2: new process starts, recovers, seals partial.
    const store = createFileStore({ path: storePath });
    const recovered = recoverSession({ store, privateKey });
    assert.equal(recovered._sealed, false);
    assert.equal(recovered.events.length, 5);
    assert.equal(recovered.events[0].seq, 0);
    assert.equal(recovered.events[4].seq, 4);

    const bundle = sealPartialBundle(recovered);
    assert.equal(bundle.events.length, 5); // no auto session_end appended
    assert.equal(bundle.header.session_ended_at_utc, null);

    const result = verifyBundle(bundle, { publicKey });
    assert.equal(result.ok, true, result.reason);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


test("recoverSession on already-sealed store returns sealed session (sealSession throws)", () => {
  const dir = tempDir();
  try {
    const { publicKey, privateKey } = testKeys();
    const storePath = join(dir, "sealed.jsonl");

    {
      const store = createFileStore({ path: storePath });
      const s = createSession({
        agent: { name: "test", version: "1.0" },
        models: [{ model_id: "m", provider: "test" }],
        environmentFingerprint: { os: "test", node_version: "test" },
        keyId: "k",
        privateKey,
        store,
      });
      appendEvent(s, { event_type: "user_message", actor: "user", payload: {} });
      const bundle = sealSession(s);
      // Sanity: the seal from phase 1 verifies.
      assert.equal(verifyBundle(bundle, { publicKey }).ok, true);
    }

    const store = createFileStore({ path: storePath });
    const recovered = recoverSession({ store, privateKey });
    assert.equal(recovered._sealed, true);
    assert.throws(() => sealSession(recovered), /already sealed/);
    assert.throws(() => sealPartialBundle(recovered), /already sealed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


test("recoverSession throws on empty store", () => {
  const dir = tempDir();
  try {
    const { privateKey } = testKeys();
    const store = createFileStore({ path: join(dir, "empty.jsonl") });
    assert.throws(
      () => recoverSession({ store, privateKey }),
      /store is empty/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


test("recoverSession + resume: append more events, then seal, then verify", () => {
  const dir = tempDir();
  try {
    const { publicKey, privateKey } = testKeys();
    const storePath = join(dir, "resumed.jsonl");

    {
      const store = createFileStore({ path: storePath });
      const s = createSession({
        agent: { name: "test", version: "1.0" },
        models: [{ model_id: "m", provider: "test" }],
        environmentFingerprint: { os: "test", node_version: "test" },
        keyId: "k",
        privateKey,
        store,
      });
      appendEvent(s, { event_type: "user_message", actor: "user", payload: { text: "before crash" } });
      appendEvent(s, { event_type: "tool_call", actor: "agent", payload: { tool: "grep" } });
    }

    const store = createFileStore({ path: storePath });
    const recovered = recoverSession({ store, privateKey });
    assert.equal(recovered.events.length, 2);
    // Continue appending as if the process never crashed.
    appendEvent(recovered, {
      event_type: "tool_result",
      actor: "tool",
      payload: { output: "ok" },
    });
    const bundle = sealSession(recovered);
    // 2 pre-crash events + 1 resumed event + auto session_end = 4
    assert.equal(bundle.events.length, 4);
    assert.equal(verifyBundle(bundle, { publicKey }).ok, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


test("listSessionFiles enumerates orphan sessions for recovery discovery", () => {
  const dir = tempDir();
  try {
    createFileStore({ path: join(dir, "s-alpha.jsonl") }).appendLine("{}");
    createFileStore({ path: join(dir, "s-beta.jsonl") }).appendLine("{}");
    createFileStore({ path: join(dir, "s-gamma.jsonl") }).appendLine("{}");
    const files = listSessionFiles(dir);
    assert.equal(files.length, 3);
    const ids = files.map(f => f.sessionId).sort();
    assert.deepEqual(ids, ["s-alpha", "s-beta", "s-gamma"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
