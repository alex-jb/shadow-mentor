// Read-only capture health through actual CLI subprocesses. Capture inputs
// are controlled synthetic hooks: no provider, model call or tool execution.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import {
  mkdtempSync, mkdirSync, writeFileSync, appendFileSync, readFileSync,
  readdirSync, lstatSync, existsSync, rmSync, statSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CLI = join(ROOT, "packages/adapter-claude-code/bin/shadow-record.mjs");
const SESSION_ID = "synthetic-health-cli-no-provider";
const RAW_SENTINEL = "RAW_HOOK_ERROR_CONTENT_MUST_NOT_BE_DISPLAYED";
const MODEL_SENTINEL = "synthetic-sensitive-model-identity-must-not-be-displayed";

function withFixture(callback, keys = true) {
  const parent = mkdtempSync(join(tmpdir(), "shadow-health-cli-"));
  try {
    const shadowDir = join(parent, "shadow");
    const privatePath = join(shadowDir, "keys", "private.pem");
    const publicPath = join(shadowDir, "keys", "public.pem");
    if (keys) {
      mkdirSync(dirname(privatePath), { recursive: true });
      const pair = generateKeyPairSync("ed25519");
      writeFileSync(privatePath, pair.privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
      writeFileSync(publicPath, pair.publicKey.export({ type: "spki", format: "pem" }));
      assert.equal(statSync(privatePath).mode & 0o777, 0o600);
    }
    const invoke = (args, input) => spawnSync(process.execPath, [CLI, ...args], {
      cwd: ROOT, env: { SHADOW_DIR: shadowDir }, encoding: "utf8", timeout: 5000,
      input: input === undefined ? undefined : JSON.stringify(input),
    });
    const hook = (eventName, extra = {}) => {
      const result = invoke(["hook", eventName], {
        session_id: SESSION_ID, hook_event_name: eventName, ...extra,
      });
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, "");
      assert.equal(result.stderr, "");
      return result;
    };
    const pendingPath = join(shadowDir, "sessions", `${SESSION_ID}.pending.jsonl`);
    const storePath = join(shadowDir, "sessions", `${SESSION_ID}.jsonl`);
    const bundlePath = join(shadowDir, "sessions", SESSION_ID, "bundle.json");
    return callback({ parent, shadowDir, privatePath, publicPath, invoke, hook,
      pendingPath, storePath, bundlePath });
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}

function snapshot(root) {
  const entries = new Map();
  if (!existsSync(root)) return entries;
  const walk = (path, relative = "") => {
    const stat = lstatSync(path);
    const kind = stat.isDirectory() ? "directory" : "file";
    entries.set(relative, { kind, mode: stat.mode & 0o777, mtimeMs: stat.mtimeMs,
      bytes: kind === "file" ? readFileSync(path) : null });
    if (kind === "directory") {
      for (const name of readdirSync(path).sort()) {
        walk(join(path, name), relative ? `${relative}/${name}` : name);
      }
    }
  };
  walk(root);
  return entries;
}

function unchanged(root, before) {
  const after = snapshot(root);
  assert.deepEqual([...after.keys()], [...before.keys()], "status changed filesystem entries");
  for (const [path, entry] of before) {
    const actual = after.get(path);
    assert.equal(actual.kind, entry.kind, `status changed entry kind: ${path}`);
    assert.equal(actual.mode, entry.mode, `status changed file mode: ${path}`);
    assert.equal(actual.mtimeMs, entry.mtimeMs, `status changed modification time: ${path}`);
    if (entry.bytes) assert.ok(entry.bytes.equals(actual.bytes), `status changed bytes: ${path}`);
  }
}

function noPrivateDisplay(f, result) {
  const output = result.stdout + result.stderr;
  for (const value of [RAW_SENTINEL, MODEL_SENTINEL, f.parent, f.shadowDir]) {
    assert.ok(!output.includes(value), "status must not expose raw contents, model identity or filesystem paths");
  }
  assert.doesNotMatch(output, /PRIVATE KEY|-----BEGIN|"header"\s*:|"payload"\s*:|"models"\s*:/);
}

function statusJson(f, expectedCode, extra = []) {
  const before = snapshot(f.parent);
  const result = f.invoke(["status", SESSION_ID, "--json", ...extra]);
  assert.equal(result.error, undefined);
  assert.equal(result.status, expectedCode, result.stderr);
  assert.equal(result.stderr, "");
  noPrivateDisplay(f, result);
  const report = JSON.parse(result.stdout);
  assert.equal(report.schema_version, "shadow-capture-health/v1");
  assert.equal(report.read_only, true);
  assert.equal(report.capture_completeness, "UNVERIFIED");
  assert.equal(report.provider_origin, "UNVERIFIED");
  assert.equal(report.resume_support, "UNSUPPORTED");
  assert.equal(report.snapshot_consistency, "BEST_EFFORT_LOCAL_READ");
  assert.ok(report.diagnostics.every((code) => typeof code === "string" && /^[A-Z][A-Z0-9_]*$/.test(code)),
    "diagnostics must contain codes rather than raw parser errors");
  unchanged(f.parent, before);
  return report;
}

function textStatus(f, expectedCode, state) {
  const before = snapshot(f.parent);
  const result = f.invoke(["status", SESSION_ID]);
  assert.equal(result.error, undefined);
  assert.equal(result.status, expectedCode, result.stderr);
  assert.equal(result.stderr, "");
  assert.ok(result.stdout.includes(state));
  assert.match(result.stdout, /Capture completeness and provider origin are UNVERIFIED/);
  assert.match(result.stdout, /resume is UNSUPPORTED/);
  noPrivateDisplay(f, result);
  unchanged(f.parent, before);
}

function sealedCapture(f, ending = "normal") {
  f.hook("SessionStart", { source: "startup" });
  f.hook("UserPromptSubmit", { prompt: RAW_SENTINEL });
  if (ending === "normal") f.hook("SessionEnd", { reason: "other" });
  else {
    const result = f.invoke(["seal", SESSION_ID, ...(ending === "partial" ? ["--partial"] : [])]);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
  }
  assert.equal(existsSync(f.bundlePath), true);
  assert.equal(existsSync(f.pendingPath), false);
}

test("status of a missing capture exits 1 without creating SHADOW_DIR, sessions, keys or error logs", () => withFixture((f) => {
  assert.equal(existsSync(f.shadowDir), false);
  const report = statusJson(f, 1);
  assert.equal(report.health_state, "NO_CAPTURE_ARTIFACTS");
  assert.equal(report.observations.pending.present, false);
  assert.equal(report.observations.store.present, false);
  assert.equal(report.observations.bundle.present, false);
  textStatus(f, 1, "NO_CAPTURE_ARTIFACTS");
  assert.equal(existsSync(f.shadowDir), false);
}, false));

test("buffered and open capture status works without a private key and never prints transcript model identity or hook payload", () => {
  withFixture((f) => {
    f.hook("SessionStart", { source: "startup" });
    f.hook("UserPromptSubmit", { prompt: RAW_SENTINEL });
    rmSync(f.privatePath);
    const report = statusJson(f, 0);
    assert.equal(report.health_state, "BUFFERED");
    assert.equal(report.observations.pending.valid, true);
    assert.equal(report.observations.pending.hook_count, 2);
    assert.equal(report.observations.store.present, false);
    textStatus(f, 0, "BUFFERED");
  });
  withFixture((f) => {
    const transcript = join(f.parent, "synthetic-transcript.jsonl");
    writeFileSync(transcript, JSON.stringify({ version: "synthetic-no-provider",
      type: "assistant", message: { model: MODEL_SENTINEL } }) + "\n");
    f.hook("SessionStart", { source: "startup", transcript_path: transcript });
    f.hook("UserPromptSubmit", { prompt: RAW_SENTINEL, transcript_path: transcript });
    assert.equal(existsSync(f.storePath), true);
    rmSync(f.privatePath);
    const report = statusJson(f, 0);
    assert.equal(report.health_state, "OPEN_UNSEALED");
    assert.equal(report.observations.store.valid, true);
    assert.equal(report.observations.store.sealed, false);
    assert.equal(report.observations.store.event_count, 2);
    assert.equal(report.observations.store.validation, "STRUCTURE_ONLY");
    textStatus(f, 0, "OPEN_UNSEALED");
  });
});

test("normal, manual and partial synthetic CLI bundles verify using only the public key after the private key is deleted", () => {
  const terminations = {
    normal: "RECORDED_SESSION_END",
    manual: "MANUAL_OR_UNOBSERVED_END",
    partial: "PARTIAL_SEAL",
  };
  for (const [ending, termination] of Object.entries(terminations)) {
    withFixture((f) => {
      sealedCapture(f, ending);
      rmSync(f.privatePath);
      const report = statusJson(f, 0);
      assert.equal(report.health_state, "SEALED_VERIFIED");
      assert.equal(report.observations.bundle.verification, "VERIFIED");
      assert.equal(report.observations.bundle.termination, termination);
      assert.equal(report.observations.store.sealed, true);
      assert.equal(report.observations.store.validation, "MATCHED_VERIFIED_BUNDLE");
      assert.equal(report.observations.bundle.event_count, report.observations.store.event_count);
      textStatus(f, 0, "SEALED_VERIFIED");
      assert.equal(existsSync(f.privatePath), false);
    });
  }
});

test("corrupt pending input remains byte-exact and global raw error lines are reported only as unattributed metadata", () => withFixture((f) => {
  f.hook("SessionStart", { source: "startup", prompt: RAW_SENTINEL });
  appendFileSync(f.pendingPath, `{"eventName":"PreToolUse","stdin":"${RAW_SENTINEL}\n`);
  const errorPath = join(f.shadowDir, "adapter-errors.log");
  const rawError = `Error: ${RAW_SENTINEL} ${f.parent}\nstack line with ${MODEL_SENTINEL}\n`;
  writeFileSync(errorPath, rawError);
  rmSync(f.privatePath);
  const report = statusJson(f, 1);
  assert.equal(report.health_state, "INVALID");
  assert.equal(report.observations.pending.present, true);
  assert.equal(report.observations.pending.valid, false);
  assert.equal(report.observations.adapter_error_log.present, true);
  assert.equal(report.observations.adapter_error_log.byte_size, Buffer.byteLength(rawError));
  assert.equal(report.observations.adapter_error_log.scope, "GLOBAL_UNATTRIBUTED");
  textStatus(f, 1, "INVALID");
}));

test("sealed captures with missing or wrong public keys fail read-only without displaying public or private PEM contents", () => {
  withFixture((f) => {
    sealedCapture(f);
    rmSync(f.privatePath);
    rmSync(f.publicPath);
    const report = statusJson(f, 1);
    assert.equal(report.health_state, "SEALED_UNVERIFIABLE");
    assert.equal(report.observations.bundle.verification, "UNVERIFIABLE");
    textStatus(f, 1, "SEALED_UNVERIFIABLE");
  });
  withFixture((f) => {
    sealedCapture(f);
    const pair = generateKeyPairSync("ed25519");
    const externalPublic = join(f.parent, "external-wrong-public.pem");
    writeFileSync(externalPublic, pair.publicKey.export({ type: "spki", format: "pem" }));
    const privateAsPublic = join(f.parent, "private-as-public.pem");
    writeFileSync(privateAsPublic, pair.privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
    rmSync(f.privatePath);
    for (const keyPath of [externalPublic, privateAsPublic]) {
      const report = statusJson(f, 1, ["--public-key", keyPath]);
      assert.notEqual(report.health_state, "SEALED_VERIFIED");
      assert.notEqual(report.observations.bundle.verification, "VERIFIED");
    }
  });
});

test("sealed-plus-pending and missing sealed artifacts exit 1 without repairing or deleting capture inputs", () => {
  for (const mismatch of ["pending", "missing-bundle", "missing-store"]) {
    withFixture((f) => {
      sealedCapture(f);
      rmSync(f.privatePath);
      if (mismatch === "pending") {
        writeFileSync(f.pendingPath, JSON.stringify({ eventName: "SessionStart",
          stdin: { session_id: SESSION_ID, hook_event_name: "SessionStart", prompt: RAW_SENTINEL } }) + "\n");
      } else rmSync(mismatch === "missing-bundle" ? f.bundlePath : f.storePath);
      const report = statusJson(f, 1);
      assert.equal(report.health_state, "INCONSISTENT");
      textStatus(f, 1, "INCONSISTENT");
    });
  }
});

test("status rejects missing IDs, path-unsafe IDs, unknown flags, duplicate flags and missing option values without filesystem writes", () => withFixture((f) => {
  const before = snapshot(f.parent);
  for (const args of [
    ["status"], ["status", "../escape"], ["status", "/absolute"],
    ["status", "session/child"], ["status", "session\\child"], ["status", ".."],
    ["status", SESSION_ID, "--partial"], ["status", SESSION_ID, "--json", "--json"],
    ["status", SESSION_ID, "--public-key"], ["status", SESSION_ID, "--public-key", "--json"],
    ["status", SESSION_ID, "unexpected-positional"],
  ]) {
    const result = f.invoke(args);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 2, `invalid status args accepted: ${JSON.stringify(args)}`);
    assert.equal(result.stdout, "");
    noPrivateDisplay(f, result);
    unchanged(f.parent, before);
  }
  assert.equal(existsSync(f.shadowDir), false);
}, false));
