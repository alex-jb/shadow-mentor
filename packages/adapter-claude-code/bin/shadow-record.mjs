#!/usr/bin/env node
// packages/adapter-claude-code/bin/shadow-record.mjs
// ─────────────────────────────────────────────────────────────────
// Claude Code hook handler. Reads hook stdin JSON, maps to a Shadow
// evidence event, appends to a per-session store, seals into a signed
// bundle on SessionEnd.
//
// Invoked by Claude Code per-event via ~/.claude/settings.json:
//   {"hooks":{"PostToolUse":[{"matcher":"*","hooks":[
//     {"type":"command","command":"shadow-record hook PostToolUse"}
//   ]}]}}
//
// Non-blocking discipline: exit 0 always. Any adapter failure logs to
// ~/.shadow/adapter-errors.log and does not block the Claude Code session.
// A separate `SHADOW_ENFORCE=1` env flag (v0.3.0, not yet implemented)
// will opt into block-mode.
//
// Hook contract verified 2026-07-12 at code.claude.com/docs/en/hooks.
// ─────────────────────────────────────────────────────────────────

import { readFileSync, appendFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

import {
  createSession,
  appendEvent,
  sealSession,
  createFileStore,
} from "shadow-attest-core";

import { mapEvent, actorFor, extractPayload } from "../lib/mapping.js";

const SHADOW_DIR = process.env.SHADOW_DIR ?? join(homedir(), ".shadow");
const KEY_ID     = process.env.SHADOW_KEY_ID ?? "claude-code-local";

function logError(err) {
  try {
    const line = `${new Date().toISOString()} ${err.stack ?? err.message ?? String(err)}\n`;
    mkdirSync(SHADOW_DIR, { recursive: true });
    appendFileSync(join(SHADOW_DIR, "adapter-errors.log"), line);
  } catch {
    // If we can't even log, we don't want to crash the parent Claude Code.
  }
}

function loadPrivateKey() {
  const keyPath = join(SHADOW_DIR, "keys", "private.pem");
  if (!existsSync(keyPath)) {
    throw new Error(
      `no private key at ${keyPath}. Run 'shadow-record init' or set SHADOW_DIR.`,
    );
  }
  return readFileSync(keyPath, "utf8");
}

function usage() {
  process.stderr.write(
    "Usage: shadow-record hook <SessionStart|UserPromptSubmit|PreToolUse|PostToolUse|PostToolUseFailure|SubagentStop|Stop|PreCompact|SessionEnd>\n" +
      "       shadow-record init  (writes ~/.claude/settings.json hook config)\n",
  );
}

async function main() {
  const [, , cmd, eventName] = process.argv;

  if (cmd === "init") {
    // Delegate to init.mjs — deferred import so `hook` calls don't pay for it.
    const { runInit } = await import("./init.mjs");
    await runInit();
    process.exit(0);
  }

  if (cmd !== "hook" || !eventName) {
    usage();
    process.exit(2); // usage error
  }

  const shadowEventType = mapEvent(eventName);
  if (!shadowEventType) {
    // Unknown / not-supported event. Non-blocking: log + exit 0.
    logError(new Error(`unmapped hook event ${eventName}, ignoring`));
    process.exit(0);
  }

  // Read stdin JSON. Empty stdin is a possibility on some hook events
  // (e.g. SessionStart on startup); handle gracefully.
  let stdin = {};
  try {
    const raw = readFileSync(0, "utf8");
    if (raw.trim()) stdin = JSON.parse(raw);
  } catch (err) {
    logError(err);
    process.exit(0);
  }

  const sessionId = stdin.session_id ?? "unknown-session";
  const sessionDir = join(SHADOW_DIR, "sessions", sessionId);
  mkdirSync(sessionDir, { recursive: true });

  const store = createFileStore(sessionDir);
  let session;
  try {
    session = store.load();
  } catch {
    session = null;
  }

  if (!session) {
    // First hook this session — create the Shadow session and persist.
    const privateKey = loadPrivateKey();
    session = createSession({
      agent: {
        name: "claude-code",
        version: process.env.CLAUDE_CODE_VERSION ?? "unknown",
      },
      models: [
        {
          model_id: stdin.model ?? "unknown",
          provider: "anthropic",
        },
      ],
      environmentFingerprint: {
        os: `${process.platform}-${process.arch}`,
        node_version: process.version,
      },
      keyId: KEY_ID,
      privateKey,
    });
  }

  appendEvent(session, {
    event_type: shadowEventType,
    actor: actorFor(eventName),
    payload: extractPayload(eventName, stdin),
  });

  if (eventName === "SessionEnd") {
    const bundle = sealSession(session);
    writeFileSync(join(sessionDir, "bundle.json"), JSON.stringify(bundle, null, 2));
    try { store.clear(); } catch { /* noop */ }
  } else {
    store.save(session);
  }

  process.exit(0);
}

main().catch((err) => {
  logError(err);
  process.exit(0); // v0.1 discipline: never block Claude Code on adapter failure.
});
