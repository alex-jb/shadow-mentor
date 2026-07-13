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
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
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

/**
 * Resolve the absolute paths for `node` and `bin/shadow-record.mjs` so the
 * hook command works when Claude Code spawns it via `/bin/sh`, which does
 * NOT inherit the user's shell PATH. Without this, every hook silently
 * fails with `shadow-record: command not found`.
 */
function resolveHookCommand() {
  const scriptPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "shadow-record.mjs",
  );
  let nodePath = process.execPath;
  // If we can find `node` on PATH via `which`, prefer that (more portable
  // when this package is installed globally). Fall back to process.execPath.
  try {
    const which = execSync("command -v node", { encoding: "utf8" }).trim();
    if (which) nodePath = which;
  } catch { /* noop — fall back to process.execPath */ }
  return { nodePath, scriptPath };
}

function wireHooks(settings) {
  settings.hooks = settings.hooks ?? {};
  let added = 0;
  let alreadyPresent = 0;
  let upgraded = 0;

  const { nodePath, scriptPath } = resolveHookCommand();
  const cmdFor = (event) => `${nodePath} ${scriptPath} hook ${event}`;
  // Old-style bare `shadow-record hook X` — /bin/sh can't find this if the
  // binary isn't in /usr/local/bin. We rewrite these to the absolute form.
  const isLegacyBare = (c) => typeof c === "string" && c.startsWith("shadow-record ");

  for (const event of HOOK_EVENTS) {
    settings.hooks[event] = settings.hooks[event] ?? [];
    const wantCmd = cmdFor(event);

    // Existing hook with this exact absolute command — leave it alone.
    const matched = settings.hooks[event].find((group) =>
      Array.isArray(group.hooks) &&
      group.hooks.some((h) => h.type === "command" && h.command === wantCmd),
    );
    if (matched) {
      alreadyPresent++;
      continue;
    }

    // Existing legacy-bare hook — rewrite it in place so we don't leave a
    // duplicate. This is the "future users don't hit Alex's dogfood bug"
    // path.
    let didUpgrade = false;
    for (const group of settings.hooks[event]) {
      for (const h of group.hooks ?? []) {
        if (h.type === "command" && isLegacyBare(h.command) && h.command.includes(`hook ${event}`)) {
          h.command = wantCmd;
          didUpgrade = true;
          upgraded++;
          break;
        }
      }
      if (didUpgrade) break;
    }
    if (didUpgrade) continue;

    settings.hooks[event].push({
      matcher: "*",
      hooks: [{ type: "command", command: wantCmd, timeout: 30 }],
    });
    added++;
  }
  return { added, alreadyPresent, upgraded };
}

export async function runInit() {
  mkdirSync(dirname(CLAUDE_SETTINGS_PATH), { recursive: true });

  const key = ensureKeypair();
  const settings = loadSettings();
  const { added, alreadyPresent, upgraded } = wireHooks(settings);

  writeFileSync(
    CLAUDE_SETTINGS_PATH,
    JSON.stringify(settings, null, 2) + "\n",
    "utf8",
  );

  process.stdout.write(
    `shadow-record init complete\n` +
    `  keypair : ${key.privPath} (${key.created ? "generated" : "existing"})\n` +
    `  hooks   : ${added} added, ${upgraded} upgraded-to-abs-path, ${alreadyPresent} already present (${HOOK_EVENTS.length} total)\n` +
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
