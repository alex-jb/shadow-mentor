// test/shadow-verify-cli.test.js
// Contract tests for the shadow-verify CLI (bin/shadow-verify.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createSession,
  appendEvent,
  sealSession,
} from "../packages/attest-core/session.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, "..", "bin", "shadow-verify.mjs");

function withFixture(fn) {
  const dir = mkdtempSync(join(tmpdir(), "shadow-verify-cli-"));
  try {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const s = createSession({
      agent: { name: "cli-test", version: "1.0.0" },
      models: [{ model_id: "test:m", provider: "test" }],
      environmentFingerprint: { os: "test", node_version: process.version },
      keyId: "cli-test-key",
      privateKey,
    });
    appendEvent(s, { event_type: "user_message", actor: "user", payload: { text: "hi" } });
    appendEvent(s, { event_type: "tool_call", actor: "agent", payload: { tool: "grep" } });
    const bundle = sealSession(s);

    const bundlePath = join(dir, "bundle.json");
    const pubPath = join(dir, "public.pem");
    writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));
    writeFileSync(pubPath, publicKey.export({ type: "spki", format: "pem" }));
    return fn({ dir, bundle, bundlePath, pubPath });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", ...options });
}


test("shadow-verify --help prints usage + exits 0", () => {
  const r = runCli(["--help"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Usage: shadow-verify/);
});


test("shadow-verify with no args exits 2", () => {
  const r = runCli([]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /missing <bundle.json>/);
});


test("shadow-verify with missing --public-key exits 2", () => {
  const r = runCli(["some-bundle.json"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /missing --public-key/);
});


test("shadow-verify with unknown flag exits 2", () => {
  const r = runCli(["--bogus"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown flag/);
});


test("shadow-verify with nonexistent bundle exits 3", () => {
  const r = runCli(["/nonexistent/bundle.json", "--public-key", "/nonexistent/key.pem"]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /failed to read\/parse bundle/);
});


test("shadow-verify happy path prints ✓ and exits 0", () => {
  withFixture(({ bundlePath, pubPath }) => {
    const r = runCli([bundlePath, "--public-key", pubPath]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /✓ Bundle verified/);
    assert.match(r.stdout, /agent\s+:\s+cli-test@1\.0\.0/);
    assert.match(r.stdout, /trust\s+:\s+SELF_SIGNED/);
  });
});


test("shadow-verify --json emits a single JSON line with ok:true and exits 0", () => {
  withFixture(({ bundlePath, pubPath }) => {
    const r = runCli([bundlePath, "--public-key", pubPath, "--json"]);
    assert.equal(r.status, 0, r.stderr);
    const parsed = JSON.parse(r.stdout.trim());
    assert.equal(parsed.ok, true);
    assert.equal(parsed.key_id, "cli-test-key");
    assert.equal(parsed.event_count, 3); // 2 appends + auto session_end
  });
});


test("shadow-verify on tampered bundle exits 1 and reports failedSeq in --json", () => {
  withFixture(({ dir, bundle, bundlePath, pubPath }) => {
    bundle.events[0].payload_hash = "0".repeat(64);
    writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));

    const r = runCli([bundlePath, "--public-key", pubPath, "--json"]);
    assert.equal(r.status, 1);
    const parsed = JSON.parse(r.stdout.trim());
    assert.equal(parsed.ok, false);
    assert.equal(parsed.failedSeq, 1);
  });
});


test("shadow-verify on wrong public key exits 1 with signature-failed reason", () => {
  withFixture(({ dir, bundlePath, pubPath }) => {
    const other = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" });
    const otherPath = join(dir, "other.pem");
    writeFileSync(otherPath, other);

    const r = runCli([bundlePath, "--public-key", otherPath]);
    assert.equal(r.status, 1);
    // Post M5 verifier-error-format port (2026-07-13): CLI now prints
    // the structured error triple, so we grep for the snake_case code.
    assert.match(r.stderr, /signature_verification_failed/);
  });
});
