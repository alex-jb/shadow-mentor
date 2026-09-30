// Controlled native-hook fixtures; no Claude session or model API calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { actorFor, mapEvent, extractPayload, extractToolMetadata } from "../packages/adapter-claude-code/lib/mapping.js";
import { handleHookEvent } from "../packages/adapter-claude-code/lib/handler.js";
import { verifyBundle } from "../packages/attest-core/session.js";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

test("native permission hooks fit existing event types without claiming human approval", () => {
  assert.equal(mapEvent("PermissionRequest"), "tool_call");
  assert.equal(mapEvent("PermissionDenied"), "tool_error");
  assert.equal(actorFor("PermissionRequest"), "system");
  assert.equal(actorFor("PermissionDenied"), "system");
  assert.equal(mapEvent("PermissionEvaluated"), null);
});

test("PermissionRequest suggestions are not an applied allow decision or a call identifier", () => {
  const metadata = extractToolMetadata("PermissionRequest", {
    permission_mode: "default",
    tool_use_id: "UNSUPPORTED_REQUEST_ID",
    tool_name: "Bash",
    permission_suggestions: [{ type: "addRules", behavior: "allow" }],
    hookSpecificOutput: { decision: { behavior: "allow" } },
    permission_decision: "allow",
  });
  assert.equal(metadata.phase, "PERMISSION_REQUEST");
  assert.equal(metadata.tool_use_id, null, "native requests omit this field; do not fabricate correlation");
  assert.equal(metadata.permission_decision, "UNKNOWN");
  assert.equal(metadata.permission_evidence, "NOT_OBSERVED");
  assert.equal(metadata.decision_source, null);
  assert.equal(extractPayload("PermissionRequest", { tool_use_id: "UNSUPPORTED_REQUEST_ID" }).tool_use_id, null);
});

test("tool attempt, successful result, and execution error all leave permission unobserved", () => {
  for (const hook of ["PreToolUse", "PostToolUse", "PostToolUseFailure"]) {
    for (const mode of ["auto", "acceptEdits", "bypassPermissions", "default"]) {
      const metadata = extractToolMetadata(hook, {
        tool_name: "Read", tool_use_id: "toolu_shared", permission_mode: mode,
        tool_response: { success: true }, error: "error",
      });
      assert.equal(metadata.permission_decision, "UNKNOWN", `${hook}/${mode}`);
      assert.equal(metadata.tool_use_id, "toolu_shared");
      assert.equal(metadata.permission_mode, mode);
    }
  }
});

test("PermissionDenied retains provider denial and reason hash, including no-verdict denials", () => {
  for (const reason of ["[Irreversible Local Destruction]", "Classifier unavailable", "Auto mode could not evaluate this action and is blocking it for safety"]) {
    const metadata = extractToolMetadata("PermissionDenied", {
      tool_name: "Bash", tool_use_id: "toolu_denied", permission_mode: "auto", reason,
      tool_input: { command: "SECRET COMMAND" },
    });
    assert.equal(metadata.permission_decision, "DENIED");
    assert.equal(metadata.permission_evidence, "PROVIDER_DENIAL_HOOK");
    assert.equal(metadata.decision_source, "CLAUDE_CODE_AUTO_MODE");
    assert.equal(metadata.denial_reason_sha256, sha256(reason));
    assert.equal(metadata.tool_use_id, "toolu_denied");
    assert.equal(JSON.stringify(metadata).includes(reason), false);
    assert.equal(JSON.stringify(metadata).includes("SECRET COMMAND"), false);
  }
});

test("missing tool metadata remains null; unrelated hooks produce no projection", () => {
  const metadata = extractToolMetadata("PreToolUse", { tool_use_id: {}, tool_name: 42 });
  assert.equal(metadata.tool_use_id, null);
  assert.equal(metadata.tool, null);
  assert.equal(metadata.permission_mode, null);
  assert.equal(extractToolMetadata("SessionStart", {}), null);
  assert.equal(extractToolMetadata("PermissionDenied", {}).denial_reason_sha256, null);
});

test("denial hook with a conflicting explicit mode cannot establish an auto-mode denial", () => {
  const inconsistent = extractToolMetadata("PermissionDenied", { permission_mode: "default", reason: "Classifier unavailable" });
  assert.equal(inconsistent.provider_hook, "PermissionDenied");
  assert.equal(inconsistent.permission_decision, "UNKNOWN");
  assert.equal(inconsistent.permission_evidence, "NOT_OBSERVED");
  assert.equal(inconsistent.decision_source, null);
  assert.equal(inconsistent.permission_mode, "default");
  assert.equal(extractToolMetadata("PermissionDenied", {}).permission_decision, "DENIED");
});

test("native structured tool_response hashes distinguish output contents and ignore key order", () => {
  const original = extractPayload("PostToolUse", { tool_response: { stdout: "private alpha", stderr: "" } });
  const reordered = extractPayload("PostToolUse", { tool_response: { stderr: "", stdout: "private alpha" } });
  const changed = extractPayload("PostToolUse", { tool_response: { stdout: "private beta", stderr: "" } });
  assert.equal(original.output_sha256, sha256('{"stderr":"","stdout":"private alpha"}'));
  assert.equal(original.output_sha256, reordered.output_sha256);
  assert.notEqual(original.output_sha256, changed.output_sha256);
  assert.equal(JSON.stringify(original).includes("private alpha"), false);
});

test("native output takes precedence, including null, while legacy output hashes remain compatible", () => {
  assert.equal(extractPayload("PostToolUse", { tool_response: null, tool_output: "legacy" }).output_sha256, sha256("null"));
  assert.equal(extractPayload("PostToolUse", { tool_output: "legacy" }).output_sha256, sha256("legacy"));
  assert.equal(extractToolMetadata("PostToolUse", { tool_response: {} }).output_hash_encoding, "CANONICAL_JSON");
  assert.equal(extractToolMetadata("PostToolUse", { tool_response: {} }).output_sha256, sha256("{}"));
  assert.equal(extractToolMetadata("PostToolUse", { tool_output: "legacy" }).output_hash_encoding, "UTF8_STRING");
  const missing = extractToolMetadata("PostToolUse", {});
  assert.equal(missing.output_source, null);
  assert.equal(missing.output_hash_encoding, "MISSING");
  assert.equal(missing.output_sha256, null);
});

test("native JSON responses with fractional numbers use the shared general canonicalizer", () => {
  const stdin = { tool_response: { score: 0.75, ratio: 0.3, cost_usd: 0.001 } };
  const expected = sha256('{"cost_usd":0.001,"ratio":0.3,"score":0.75}');
  assert.equal(extractPayload("PostToolUse", stdin).output_sha256, expected);
  assert.equal(extractToolMetadata("PostToolUse", stdin).output_sha256, expected);
});

test("signed and recovered hook session preserves deny and unknown metadata; tampering fails verification", (t) => {
  const shadowDir = mkdtempSync(join(tmpdir(), "shadow-permission-test-"));
  t.after(() => rmSync(shadowDir, { recursive: true, force: true }));
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const sessionId = "controlled-permission-session";
  const hooks = [
    ["SessionStart", { source: "startup" }],
    ["PreToolUse", { tool_name: "Bash", tool_use_id: "toolu_denied", tool_input: { command: "private command" } }],
    ["PermissionRequest", { tool_name: "Bash", permission_suggestions: [{ behavior: "allow" }] }],
    ["PermissionDenied", { tool_name: "Bash", tool_use_id: "toolu_denied", permission_mode: "auto", reason: "Classifier unavailable" }],
    ["PreToolUse", { tool_name: "Read", tool_use_id: "toolu_result", permission_mode: "bypassPermissions" }],
    ["PostToolUse", { tool_name: "Read", tool_use_id: "toolu_result", tool_response: { stdout: "private result" } }],
    ["SessionEnd", {}],
  ];
  let result;
  for (const [eventName, fields] of hooks) {
    result = handleHookEvent({ eventName, stdin: { session_id: sessionId, hook_event_name: eventName, ...fields }, shadowDir, privateKey });
  }
  const bundle = JSON.parse(readFileSync(result.bundlePath, "utf8"));
  assert.equal(verifyBundle(bundle, { publicKey }).ok, true);
  assert.equal(bundle.events.some((event) => event.event_type === "human_approval"), false);
  const request = bundle.events.find((event) => event.extensions.claude_code?.provider_hook === "PermissionRequest");
  assert.equal(request.extensions.claude_code.tool_use_id, null);
  const denial = bundle.events.find((event) => event.extensions.claude_code?.provider_hook === "PermissionDenied");
  assert.equal(denial.extensions.claude_code.permission_decision, "DENIED");
  assert.equal(denial.actor, "system");
  const resultEvent = bundle.events.find((event) => event.extensions.claude_code?.provider_hook === "PostToolUse");
  assert.equal(resultEvent.extensions.claude_code.permission_decision, "UNKNOWN");
  assert.equal(JSON.stringify(bundle).includes("private command"), false);
  assert.equal(JSON.stringify(bundle).includes("private result"), false);
  denial.extensions.claude_code.permission_decision = "ALLOWED";
  assert.equal(verifyBundle(bundle, { publicKey }).ok, false);
});

test("a routed event cannot reinterpret a different hook input as a provider denial", (t) => {
  const shadowDir = mkdtempSync(join(tmpdir(), "shadow-hook-mismatch-"));
  t.after(() => rmSync(shadowDir, { recursive: true, force: true }));
  const { privateKey } = generateKeyPairSync("ed25519");
  assert.throws(() => handleHookEvent({
    eventName: "PermissionDenied", stdin: { session_id: "mismatch", hook_event_name: "PreToolUse" }, shadowDir, privateKey,
  }), /hook_event_name does not match/);
});

test("init wires permission observers idempotently and preserves an existing decision hook", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "shadow-permission-init-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const settingsPath = join(dir, "settings.json");
  const existing = { matcher: "Bash", hooks: [{ type: "command", command: "existing-policy-hook" }] };
  writeFileSync(settingsPath, JSON.stringify({ hooks: { PermissionRequest: [existing] } }));
  const env = { ...process.env, SHADOW_DIR: join(dir, "shadow"), CLAUDE_SETTINGS_PATH: settingsPath };
  const init = () => spawnSync(process.execPath, ["packages/adapter-claude-code/bin/shadow-record.mjs", "init"], { env, encoding: "utf8" });
  const first = init();
  assert.equal(first.status, 0, first.stderr);
  const before = readFileSync(settingsPath, "utf8");
  const settings = JSON.parse(before);
  assert.deepEqual(settings.hooks.PermissionRequest[0], existing);
  assert.equal(settings.hooks.PermissionRequest.length, 2);
  assert.equal(settings.hooks.PermissionDenied.length, 1);
  assert.equal(init().status, 0);
  assert.equal(readFileSync(settingsPath, "utf8"), before);
  const denialHook = spawnSync(process.execPath, ["packages/adapter-claude-code/bin/shadow-record.mjs", "hook", "PermissionDenied"], {
    env, encoding: "utf8", input: JSON.stringify({ session_id: "cli-denial", hook_event_name: "PermissionDenied", tool_name: "Bash", reason: "Classifier unavailable" }),
  });
  assert.equal(denialHook.status, 0);
  assert.equal(denialHook.stdout, "", "observer must not emit a decision or retry permission");
});
