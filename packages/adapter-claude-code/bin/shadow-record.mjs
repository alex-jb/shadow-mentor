#!/usr/bin/env node
// packages/adapter-claude-code/bin/shadow-record.mjs
// ─────────────────────────────────────────────────────────────────
// Thin CLI shim over lib/handler.js.
//
// Subcommands:
//   shadow-record hook <EventName>            — Claude Code hook dispatch.
//                                                Reads hook stdin JSON.
//   shadow-record seal <session_id> [--partial] — Fallback seal when the
//                                                SessionEnd hook never
//                                                fired (crash, /exit
//                                                variant, network kill).
//   shadow-record init                        — Wire ~/.claude/settings.json
//                                                + generate ~/.shadow/keys/*.
//
// Non-blocking discipline for `hook`: exit 0 always. Any adapter failure
// logs to ~/.shadow/adapter-errors.log and never blocks the parent
// Claude Code session. `seal` and `init` are user-facing — they exit
// non-zero on failure and print the reason.
//
// Hook contract verified 2026-07-12 at code.claude.com/docs/en/hooks.

import { readFileSync, appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

import { handleHookEvent, sealSessionById } from "../lib/handler.js";

const SHADOW_DIR = process.env.SHADOW_DIR ?? join(homedir(), ".shadow");
const KEY_ID     = process.env.SHADOW_KEY_ID ?? "claude-code-local";

function logAdapterError(err) {
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
    "Usage:\n" +
    "  shadow-record hook <SessionStart|UserPromptSubmit|PreToolUse|PostToolUse|PostToolUseFailure|SubagentStop|Stop|PreCompact|SessionEnd>\n" +
    "  shadow-record seal <session_id> [--partial]\n" +
    "  shadow-record init\n",
  );
}

async function main() {
  const [, , cmd, arg1, ...rest] = process.argv;

  if (cmd === "init") {
    const { runInit } = await import("./init.mjs");
    await runInit();
    process.exit(0);
  }

  if (cmd === "seal") {
    if (!arg1) {
      process.stderr.write("shadow-record seal: session_id required\n");
      process.exit(2);
    }
    const partial = rest.includes("--partial");
    try {
      const privateKey = loadPrivateKey();
      const result = sealSessionById({
        sessionId: arg1,
        shadowDir: SHADOW_DIR,
        privateKey,
        partial,
      });
      process.stdout.write(
        `sealed session ${result.sessionId}\n` +
        `  bundle: ${result.bundlePath}\n` +
        `  events: ${result.bundle.events.length}\n`,
      );
      process.exit(0);
    } catch (err) {
      process.stderr.write(`seal failed: ${err.message}\n`);
      process.exit(1);
    }
  }

  if (cmd === "hook") {
    if (!arg1) {
      usage();
      process.exit(2);
    }
    let stdin = {};
    try {
      const raw = readFileSync(0, "utf8");
      if (raw.trim()) stdin = JSON.parse(raw);
    } catch (err) {
      logAdapterError(err);
      process.exit(0);
    }
    try {
      const privateKey = loadPrivateKey();
      handleHookEvent({
        eventName: arg1,
        stdin,
        shadowDir: SHADOW_DIR,
        privateKey,
        keyId: KEY_ID,
      });
    } catch (err) {
      logAdapterError(err);
    }
    process.exit(0);
  }

  usage();
  process.exit(2);
}

main().catch((err) => {
  logAdapterError(err);
  // Only `hook` should be non-blocking. If we got here from init/seal,
  // the sub-branch already exited. Any error here is a routing bug.
  process.exit(1);
});
