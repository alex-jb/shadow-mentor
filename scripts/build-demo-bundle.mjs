#!/usr/bin/env node
// scripts/build-demo-bundle.mjs
// Build a synthetic evidence bundle that showcases the M2.2 Phase 2
// win: header pins the REAL agent.version + model_id (not the "unknown"
// fallback from Phase 1). Used to seed docs/dogfood-evidence/ +
// demos/replay/data/ with a demo-ready bundle so Wednesday's demo can
// point at the header immediately and say "look, real model_id" —
// without needing Alex to open a live Claude session first.
//
// Every event is deterministic + realistic (real tool names + real
// timestamps + real model). Verifies with the shadow-verify CLI.
//
// Usage:
//   node scripts/build-demo-bundle.mjs [--out <dir>]
//
// By default writes to demos/replay/data/. Pass --out docs/dogfood-evidence/
// to also refresh the archive location.

import { generateKeyPairSync } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createSession,
  appendEvent,
  sealSession,
  verifyBundle,
} from "../packages/attest-core/session.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = { out: [join(ROOT, "demos/replay/data")] };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--out") args.out.push(argv[++i]);
  }
  return args;
}

const args = parseArgs(process.argv);

// Fixture timeline: mirrors a real Claude Code session doing a small
// coding task — read one file, run one Grep, edit one file. Enough
// events (~14) to show the timeline scroll + click + inspect flow
// without overwhelming an auditor.
const START = Date.parse("2026-07-13T14:00:00.000Z");

const FIXTURES = [
  {
    ev: {
      event_type: "session_start",
      actor: "system",
      payload: { source: "startup", model: "claude-opus-4-7", title: "M2.2 Phase 2 demo capture" },
      extensions: { discovered_agent_version: "2.1.116", discovered_model_id: "claude-opus-4-7" },
    },
    dt: 0,
  },
  {
    ev: {
      event_type: "prompt",
      actor: "user",
      payload: { prompt_id: "p-a1", prompt_sha256: "b0d5c1e78f5e42e19cabbe0f8c7a4c40c1e0b0c9b0a7d7a5f4c62b7a8f2e6b8d" },
      extensions: { discovered_agent_version: "2.1.116", discovered_model_id: "claude-opus-4-7", tool: null },
    },
    dt: 900,
  },
  {
    ev: {
      event_type: "tool_call",
      actor: "agent",
      payload: { prompt_id: "p-a1", tool: "Read", tool_input: { file_path: "/Users/demo/app/auth.js" } },
      extensions: { discovered_agent_version: "2.1.116", discovered_model_id: "claude-opus-4-7", tool: "Read" },
    },
    dt: 300,
  },
  {
    ev: {
      event_type: "tool_result",
      actor: "tool",
      payload: { prompt_id: "p-a1", tool: "Read", output_sha256: "5c9df3b47a10c72f9d21e0d92b3c5f0aa8c62a13b18ffef2c1e0d3b9a5f2c78e" },
      extensions: { discovered_agent_version: "2.1.116", discovered_model_id: "claude-opus-4-7", tool: "Read" },
    },
    dt: 200,
  },
  {
    ev: {
      event_type: "tool_call",
      actor: "agent",
      payload: { prompt_id: "p-a1", tool: "Grep", tool_input: { pattern: "verifyToken", output_mode: "content" } },
      extensions: { discovered_agent_version: "2.1.116", discovered_model_id: "claude-opus-4-7", tool: "Grep" },
    },
    dt: 350,
  },
  {
    ev: {
      event_type: "tool_result",
      actor: "tool",
      payload: { prompt_id: "p-a1", tool: "Grep", output_sha256: "72fb8477449fdd6e2c1c5b09a8f2b71c6e5da0f4d8b02c7ff3adb9c0a1e3d47c" },
      extensions: { discovered_agent_version: "2.1.116", discovered_model_id: "claude-opus-4-7", tool: "Grep" },
    },
    dt: 250,
  },
  {
    ev: {
      event_type: "tool_call",
      actor: "agent",
      payload: { prompt_id: "p-a1", tool: "Edit", tool_input: { file_path: "/Users/demo/app/auth.js", old_string: "return jwt.verify(token, key);", new_string: "return jwt.verify(token, key, { algorithms: ['RS256'] });" } },
      extensions: { discovered_agent_version: "2.1.116", discovered_model_id: "claude-opus-4-7", tool: "Edit" },
    },
    dt: 450,
  },
  {
    ev: {
      event_type: "tool_result",
      actor: "tool",
      payload: { prompt_id: "p-a1", tool: "Edit", output_sha256: "b2ce49e5ab1d0f7a3c4e6f8a2d5b9e1c7a0b2f4d6e8a3c5b7d9f1e3a5c7b9d1f" },
      extensions: { discovered_agent_version: "2.1.116", discovered_model_id: "claude-opus-4-7", tool: "Edit" },
    },
    dt: 200,
  },
  {
    ev: {
      event_type: "tool_call",
      actor: "agent",
      payload: { prompt_id: "p-a1", tool: "Bash", tool_input: { command: "npm test test/auth.test.js" } },
      extensions: { discovered_agent_version: "2.1.116", discovered_model_id: "claude-opus-4-7", tool: "Bash" },
    },
    dt: 500,
  },
  {
    ev: {
      event_type: "tool_result",
      actor: "tool",
      payload: { prompt_id: "p-a1", tool: "Bash", output_sha256: "16004fd82cc9a5b7d9f1e3a5c7b9d1f3e5a7c9b1d3f5e7a9c1b3d5f7e9a1c3b5" },
      extensions: { discovered_agent_version: "2.1.116", discovered_model_id: "claude-opus-4-7", tool: "Bash" },
    },
    dt: 3800,
  },
  {
    ev: {
      event_type: "turn_end",
      actor: "agent",
      payload: { prompt_id: "p-a1", last: "Locked the algorithm to RS256 on auth.js:47. Test suite green." },
      extensions: { discovered_agent_version: "2.1.116", discovered_model_id: "claude-opus-4-7", tool: null },
    },
    dt: 900,
  },
  {
    ev: {
      event_type: "session_end",
      actor: "system",
      payload: {
        end_reason: "logout",
        event_count: 11,
        session_duration_ms: 7850,
        discovered_model_id: "claude-opus-4-7",
        discovered_agent_version: "2.1.116",
      },
      extensions: { discovered_agent_version: "2.1.116", discovered_model_id: "claude-opus-4-7" },
    },
    dt: 100,
  },
];

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const privatePem = privateKey.export({ format: "pem", type: "pkcs8" });
const publicPem = publicKey.export({ format: "pem", type: "spki" });

const session = createSession({
  agent: { name: "claude-code", version: "2.1.116" },
  models: [{ model_id: "claude-opus-4-7", provider: "anthropic" }],
  environmentFingerprint: { os: "darwin-25.3.0", node_version: "v24.14.1" },
  keyId: "claude-code-local",
  privateKey: privatePem,
  sessionId: "phase2-demo-2026-07-13",
  startedAtUtc: new Date(START).toISOString(),
});

let t = START;
for (const f of FIXTURES) {
  t += f.dt;
  // sealSession auto-appends session_end; skip our fixture's session_end
  // and let sealSession handle it.
  if (f.ev.event_type === "session_end") {
    // Rely on sealSession; nothing to append here.
    continue;
  }
  appendEvent(session, {
    event_type: f.ev.event_type,
    actor: f.ev.actor,
    payload: f.ev.payload,
    extensions: f.ev.extensions,
    ts_utc: new Date(t).toISOString(),
  });
}

const bundle = sealSession(session, { endedAtUtc: new Date(t + 100).toISOString() });

const verify = verifyBundle(bundle, { publicKey: publicPem });
if (!verify.ok) {
  console.error("built bundle did not verify:", verify.error);
  process.exit(1);
}

for (const outDir of args.out) {
  mkdirSync(outDir, { recursive: true });
  const bundlePath = join(outDir, "demo-session.bundle.json");
  const pubPath = join(outDir, "demo-public-key.pem");
  writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));
  writeFileSync(pubPath, publicPem);
  console.log(`wrote ${bundlePath} (${bundle.events.length} events, batch_root=${bundle.batch_root.slice(0, 12)}…)`);
  console.log(`wrote ${pubPath}`);
}

console.log(`\n✓ Bundle verifies:  agent=claude-code@2.1.116  model=claude-opus-4-7`);
