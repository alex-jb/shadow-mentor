// packages/adapter-claude-code/bin/init.mjs
// ─────────────────────────────────────────────────────────────────
// One-shot setup for `shadow-record init`. Writes the Claude Code hook
// configuration into ~/.claude/settings.json (or the operator-scoped
// location) and generates an Ed25519 keypair if one isn't present at
// ~/.shadow/keys/{private,public}.pem.
//
// Idempotent: existing hook entries for `shadow-record hook <event>` are
// left alone; other users of the same hook events are preserved. Keypair
// is never rotated by init — if you want a fresh key, delete the .pem
// files first (and be aware you'll invalidate old bundles).
// ─────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { generateKeyPairSync } from "node:crypto";

const HOOK_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "SubagentStop",
  "Stop",
  "PreCompact",
  "SessionEnd",
];

const CLAUDE_SETTINGS_PATH = process.env.CLAUDE_SETTINGS_PATH ??
  join(homedir(), ".claude", "settings.json");

const SHADOW_DIR = process.env.SHADOW_DIR ?? join(homedir(), ".shadow");

function ensureKeypair() {
  const keysDir = join(SHADOW_DIR, "keys");
  const privPath = join(keysDir, "private.pem");
  const pubPath  = join(keysDir, "public.pem");

  if (existsSync(privPath) && existsSync(pubPath)) {
    return { privPath, pubPath, created: false };
  }

  mkdirSync(keysDir, { recursive: true });
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privPem = privateKey.export({ format: "pem", type: "pkcs8" });
  const pubPem  = publicKey.export({ format: "pem", type: "spki" });
  writeFileSync(privPath, privPem, { mode: 0o600 });
  writeFileSync(pubPath, pubPem,  { mode: 0o644 });
  try { chmodSync(privPath, 0o600); chmodSync(pubPath, 0o644); } catch { /* noop */ }

  return { privPath, pubPath, created: true };
}

function loadSettings() {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, "utf8"));
  } catch (err) {
    throw new Error(
      `${CLAUDE_SETTINGS_PATH} is not valid JSON. Fix or move it before running init: ${err.message}`,
    );
  }
}

function wireHooks(settings) {
  settings.hooks = settings.hooks ?? {};
  let added = 0;
  let alreadyPresent = 0;

  for (const event of HOOK_EVENTS) {
    settings.hooks[event] = settings.hooks[event] ?? [];
    const wantCmd = `shadow-record hook ${event}`;

    // Look for an existing entry that already wires this exact command.
    const matched = settings.hooks[event].find((group) =>
      Array.isArray(group.hooks) &&
      group.hooks.some((h) => h.type === "command" && h.command === wantCmd),
    );
    if (matched) {
      alreadyPresent++;
      continue;
    }

    settings.hooks[event].push({
      matcher: "*",
      hooks: [{ type: "command", command: wantCmd, timeout: 30 }],
    });
    added++;
  }
  return { added, alreadyPresent };
}

export async function runInit() {
  mkdirSync(dirname(CLAUDE_SETTINGS_PATH), { recursive: true });

  const key = ensureKeypair();
  const settings = loadSettings();
  const { added, alreadyPresent } = wireHooks(settings);

  writeFileSync(
    CLAUDE_SETTINGS_PATH,
    JSON.stringify(settings, null, 2) + "\n",
    "utf8",
  );

  process.stdout.write(
    `shadow-record init complete\n` +
    `  keypair : ${key.privPath} (${key.created ? "generated" : "existing"})\n` +
    `  hooks   : ${added} added, ${alreadyPresent} already present (${HOOK_EVENTS.length} total)\n` +
    `  config  : ${CLAUDE_SETTINGS_PATH}\n` +
    `\n` +
    `Next: start a Claude Code session. Bundles land in ~/.shadow/sessions/<id>/bundle.json on SessionEnd.\n` +
    `Verify with: npx shadow-verify ~/.shadow/sessions/<id>/bundle.json --public-key ${key.pubPath}\n`,
  );
}

// Allow direct invocation: `node init.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  runInit().catch((err) => {
    process.stderr.write(`init failed: ${err.message}\n`);
    process.exit(1);
  });
}
