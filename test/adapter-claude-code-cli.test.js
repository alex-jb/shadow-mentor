// Real CLI subprocesses, controlled hook inputs, ephemeral local keys.
// No Claude Code provider session, model invocation or tool execution.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateKeyPairSync } from "node:crypto";
import { spawnSync } from "node:child_process";
import { verifyBundle } from "../packages/attest-core/session.js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CLI = join(ROOT, "packages/adapter-claude-code/bin/shadow-record.mjs");
const PACKAGE_CLI = join(ROOT, "bin/shadow-audit-package.mjs");
const SESSION_ID = "synthetic-cli-test-no-provider";
const CONTENT_SENTINEL = "PRIVATE_HOOK_CONTENT_MUST_NOT_BE_LOGGED";

function fixture(t) {
  const shadowDir = mkdtempSync(join(tmpdir(), "shadow-cli-queue-"));
  t.after(() => rmSync(shadowDir, { recursive: true, force: true }));
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  mkdirSync(join(shadowDir, "keys"));
  // Private key exists only in this disposable local test directory.
  writeFileSync(join(shadowDir, "keys", "private.pem"), privateKey.export({ type: "pkcs8", format: "pem" }));
  const publicPem = publicKey.export({ type: "spki", format: "pem" });
  const publicKeyPath = join(shadowDir, "keys", "public.pem");
  writeFileSync(publicKeyPath, publicPem);
  const invokeScript = (script, args, input) => spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    // No inherited provider credentials or model configuration.
    env: { SHADOW_DIR: shadowDir, SHADOW_KEY_ID: "synthetic-cli-test" },
    input: input === undefined ? undefined : JSON.stringify(input),
    encoding: "utf8",
    timeout: 5000,
  });
  const invoke = (args, input) => invokeScript(CLI, args, input);
  const hook = (eventName, extras = {}) => invoke(["hook", eventName], {
    session_id: SESSION_ID, hook_event_name: eventName, ...extras,
  });
  return {
    shadowDir, invoke, hook,
    publicPem, publicKeyPath,
    runPackage: (args) => invokeScript(PACKAGE_CLI, args),
    pending: join(shadowDir, "sessions", `${SESSION_ID}.pending.jsonl`),
    store: join(shadowDir, "sessions", `${SESSION_ID}.jsonl`),
    bundle: join(shadowDir, "sessions", SESSION_ID, "bundle.json"),
  };
}

function corruptQueue(f) {
  const start = f.hook("SessionStart", { source: "startup" });
  assert.equal(start.error, undefined);
  assert.equal(start.status, 0);
  assert.ok(existsSync(f.pending));
  appendFileSync(f.pending, `{"eventName":"PreToolUse","stdin":"${CONTENT_SENTINEL}\n`);
  return readFileSync(f.pending);
}

test("hook CLI stays non-blocking while retaining corrupt pending evidence and logging no hook content", (t) => {
  const f = fixture(t);
  const before = corruptQueue(f);
  const result = f.hook("SessionEnd", { reason: "other" });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, "observer failure must not block the parent session");
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
  assert.deepEqual(readFileSync(f.pending), before);
  assert.equal(existsSync(f.store), false);
  assert.equal(existsSync(f.bundle), false);
  const log = readFileSync(join(f.shadowDir, "adapter-errors.log"), "utf8");
  assert.match(log, /pending/i);
  assert.ok(!log.includes(CONTENT_SENTINEL), "errors must not echo pending payload bytes");
});

test("manual seal CLI fails visibly rather than signing the remainder of a corrupt queue", (t) => {
  const f = fixture(t);
  const before = corruptQueue(f);
  const result = f.invoke(["seal", SESSION_ID]);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /seal failed:/);
  assert.match(result.stderr, /pending/i);
  assert.ok(!result.stderr.includes(CONTENT_SENTINEL));
  assert.deepEqual(readFileSync(f.pending), before);
  assert.equal(existsSync(f.store), false);
  assert.equal(existsSync(f.bundle), false);
});

test("valid controlled CLI hooks replay in order and export an independently verifying fixture package", (t) => {
  const f = fixture(t);
  for (const [event, extras] of [
    ["SessionStart", { source: "startup" }],
    ["UserPromptSubmit", { prompt: "synthetic offline capture check" }],
    ["SessionEnd", { reason: "other" }],
  ]) {
    const result = f.hook(event, extras);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
  }
  assert.equal(existsSync(f.pending), false);
  assert.equal(existsSync(join(f.shadowDir, "adapter-errors.log")), false);
  const bundle = JSON.parse(readFileSync(f.bundle, "utf8"));
  assert.deepEqual(bundle.events.map(event => event.event_type), ["session_start", "prompt", "session_end"]);
  assert.equal(bundle.header.session_id, SESSION_ID);
  assert.equal(bundle.header.models[0].model_id, "unknown");
  assert.equal(verifyBundle(bundle, { publicKey: f.publicPem }).ok, true);
  assert.ok(!readFileSync(f.bundle, "utf8").includes("PRIVATE KEY"));
  const packageDir = join(f.shadowDir, "package");
  const created = f.runPackage([
    "create", "--fixture", "banking", "--evidence", f.bundle,
    "--evidence-public-key", f.publicKeyPath, "--output-dir", packageDir,
    "--build-commit", "unknown", "--json",
  ]);
  assert.equal(created.error, undefined);
  assert.equal(created.status, 0, created.stderr);
  const packagedEvidence = readFileSync(join(packageDir, "evidence/evidence-bundle.json"));
  assert.deepEqual(packagedEvidence, readFileSync(f.bundle), "packaging must not reseal or rewrite capture evidence");
  assert.ok(!packagedEvidence.toString().includes("PRIVATE KEY"));
  const checked = f.runPackage(["verify", "--package", packageDir, "--json"]);
  assert.equal(checked.error, undefined);
  assert.equal(checked.status, 0, checked.stderr);
  const verification = JSON.parse(checked.stdout);
  assert.equal(verification.ok, true);
  assert.equal(verification.verdict, "VERIFIED_FIXTURE_KEY");
});
