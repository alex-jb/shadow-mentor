#!/usr/bin/env node
// scripts/gen-verify-html-fixture.mjs
//
// Generates a small evidence bundle + Ed25519 public key PEM so Alex can
// drag them into verify.html and confirm the offline verifier works
// end-to-end.
//
// Usage:
//   node scripts/gen-verify-html-fixture.mjs
//   # writes verify-fixtures/bundle.json + verify-fixtures/public.pem
//   # open verify.html, drag bundle.json in, paste public.pem contents

import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createSession,
  appendEvent,
  sealSession,
} from "../packages/attest-core/session.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(REPO_ROOT, "verify-fixtures");

mkdirSync(OUT_DIR, { recursive: true });

const { publicKey, privateKey } = generateKeyPairSync("ed25519");

const session = createSession({
  agent: { name: "verify-html-fixture", version: "1.0.0" },
  models: [{ model_id: "test:example", provider: "test" }],
  environmentFingerprint: { os: process.platform, node_version: process.version },
  keyId: "verify-html-fixture-key",
  privateKey,
});

appendEvent(session, {
  event_type: "user_message",
  actor: "user",
  payload: { text: "This is a fixture bundle for testing verify.html." },
});
appendEvent(session, {
  event_type: "tool_call",
  actor: "agent",
  payload: { tool: "grep", args: { pattern: "todo" } },
});
appendEvent(session, {
  event_type: "tool_result",
  actor: "tool",
  payload: { hits: 0 },
});

const bundle = sealSession(session);

const bundlePath = resolve(OUT_DIR, "bundle.json");
const publicPemPath = resolve(OUT_DIR, "public.pem");
const publicPem = publicKey.export({ type: "spki", format: "pem" });

writeFileSync(bundlePath, JSON.stringify(bundle, null, 2) + "\n");
writeFileSync(publicPemPath, publicPem);

console.log(`Fixture written:`);
console.log(`  bundle → ${bundlePath}`);
console.log(`  key    → ${publicPemPath}`);
console.log("");
console.log("To test verify.html end-to-end:");
console.log(`  open ${resolve(REPO_ROOT, "verify.html")}`);
console.log(`  drag ${bundlePath} into the drop zone`);
console.log(`  paste the contents of public.pem into the public-key textarea`);
console.log("  → should show green '✓ Bundle verified' with 4 events (3 appends + auto session_end)");
console.log("");
console.log("To test tamper detection:");
console.log(`  edit ${bundlePath} — change any character in an event's payload_hash`);
console.log("  re-drop → should show red '✗ Verification failed' with 'prev_hash mismatch'");
