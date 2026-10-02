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
//   shadow-record status <session_id> [--json] [--public-key <pem>]
//                                             — Read-only local observations.
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
import { inspectCaptureHealth, validHealthSessionId, captureHealthExitCode } from "../lib/health.js";

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
    "  shadow-record hook <SessionStart|UserPromptSubmit|PreToolUse|PermissionRequest|PermissionDenied|PostToolUse|PostToolUseFailure|SubagentStop|Stop|PreCompact|SessionEnd>\n" +
    "  shadow-record seal <session_id> [--partial]\n" +
    "  shadow-record init\n" +
    "  shadow-record status <session_id> [--json] [--public-key <pem>]\n",
  );
}

async function main() {
  const [, , cmd, arg1, ...rest] = process.argv;

  if (cmd === "status") {
    if (!validHealthSessionId(arg1)) {
      process.stderr.write("shadow-record status: a safe session_id is required\n"); process.exit(2);
    }
    let json = false, publicKeyPath = null;
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === "--json" && !json) json = true;
      else if (rest[i] === "--public-key" && publicKeyPath === null && rest[i + 1] && !rest[i + 1].startsWith("--"))
        publicKeyPath = rest[++i];
      else { process.stderr.write("shadow-record status: unsupported, duplicate or missing argument\n"); process.exit(2); }
    }
    // Status never reaches the signing-key loader or error-log writer.
    try {
      const report = inspectCaptureHealth({ shadowDir: SHADOW_DIR, sessionId: arg1, publicKeyPath });
      process.stdout.write(json ? JSON.stringify(report) + "\n" :
        `capture status: ${report.health_state}\n` +
        `pending hooks: ${report.observations.pending.hook_count ?? "unknown"}; stored events: ${report.observations.store.event_count ?? "unknown"}; bundle verification: ${report.observations.bundle.verification}\n` +
        "Capture completeness and provider origin are UNVERIFIED. Sealed-session resume is UNSUPPORTED.\n" +
        (report.diagnostics.length ? `diagnostics: ${report.diagnostics.join(", ")}\n` : ""));
      process.exit(captureHealthExitCode(report));
    } catch { process.stderr.write("shadow-record status: observation failed; no input content is emitted\n"); process.exit(1); }
  }

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
