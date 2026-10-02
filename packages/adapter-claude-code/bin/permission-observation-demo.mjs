#!/usr/bin/env node
// Offline controlled hook-input demonstration. Does not start Claude,
// execute a tool, read a provider key, or make a model/network call.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { generateKeyPairSync } from "node:crypto";
import { handleHookEvent } from "../lib/handler.js";
import { verifyBundle } from "shadow-attest-core";

const args = process.argv.slice(2);
let outputDir;
let sessionId = "shadow-permission-synthetic-no-model-call";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--output-dir") outputDir = args[++i];
  else if (args[i] === "--session-id") sessionId = args[++i];
  else throw new Error(`unknown argument: ${args[i]}`);
}
if (!outputDir || !sessionId) throw new Error("--output-dir is required; --session-id must be nonempty");
if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(sessionId)) throw new Error("--session-id must be a safe local identifier");
outputDir = resolve(outputDir);
if (existsSync(outputDir)) throw new Error("output directory already exists; choose a new demonstration directory");
mkdirSync(outputDir, { recursive: true });

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const publicKeyPath = join(outputDir, "public.pem");
writeFileSync(publicKeyPath, publicKey.export({ type: "spki", format: "pem" }));
const hooks = [
  ["SessionStart", { source: "startup", session_title: "SYNTHETIC permission observation — no model call" }],
  ["PreToolUse", { permission_mode: "auto", tool_name: "Bash", tool_use_id: "toolu_synthetic_denied", tool_input: { command: "SYNTHETIC_COMMAND_NOT_EXECUTED" } }],
  ["PermissionRequest", { permission_mode: "auto", tool_name: "Bash", tool_input: { command: "SYNTHETIC_COMMAND_NOT_EXECUTED" }, permission_suggestions: [{ type: "addRules", behavior: "allow", rules: [{ toolName: "Bash" }], destination: "session" }] }],
  ["PermissionDenied", { permission_mode: "auto", tool_name: "Bash", tool_use_id: "toolu_synthetic_denied", reason: "Classifier unavailable" }],
  ["PreToolUse", { permission_mode: "bypassPermissions", tool_name: "Read", tool_use_id: "toolu_synthetic_result", tool_input: { file_path: "SYNTHETIC_FILE_NOT_READ" } }],
  ["PostToolUse", { permission_mode: "bypassPermissions", tool_name: "Read", tool_use_id: "toolu_synthetic_result", tool_response: { stdout: "SYNTHETIC_RESULT_NOT_FROM_A_TOOL", stderr: "" } }],
  ["SessionEnd", { end_reason: "synthetic-fixture-complete" }],
];
let result;
for (const [eventName, fields] of hooks) {
  result = handleHookEvent({
    eventName,
    stdin: {
      session_id: sessionId, hook_event_name: eventName,
      model: "SYNTHETIC_NO_MODEL_CALL", claude_code_version: "SYNTHETIC_NATIVE_HOOK_FIXTURE",
      ...fields,
    },
    shadowDir: outputDir,
    privateKey,
    keyId: "synthetic-permission-demo-local-key",
  });
}
const verified = verifyBundle(result.bundle, { publicKey });
if (!verified.ok) throw new Error(`controlled bundle failed local verification: ${verified.reason}`);
const boundary = {
  synthetic: true,
  model_calls: 0,
  provider_session: false,
  tools_executed: false,
  model_id: "SYNTHETIC_NO_MODEL_CALL",
  private_key_written: false,
  statement: "Synthetic native hook inputs signed by the actual local Shadow adapter. Demonstrates capture and verification only; no real provider, human approval, business decision, or regulatory compliance evidence.",
};
writeFileSync(join(outputDir, "DEMO_BOUNDARY.json"), JSON.stringify(boundary, null, 2) + "\n");
process.stdout.write(JSON.stringify({ ...boundary, bundle_path: result.bundlePath, public_key_path: publicKeyPath, event_count: result.bundle.events.length, verification: "SELF_SIGNED" }, null, 2) + "\n");
