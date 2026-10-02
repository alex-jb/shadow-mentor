// Read-only capture observations over controlled synthetic artifacts.
// No Claude Code provider session, model call, private key file or network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, lstatSync, rmSync, existsSync, symlinkSync, readlinkSync, truncateSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSession, appendEvent, createFileStore } from "../packages/attest-core/index.js";
import { handleHookEvent, sealSessionById } from "../packages/adapter-claude-code/lib/handler.js";
import { inspectCaptureHealth } from "../packages/adapter-claude-code/lib/health.js";

const SESSION_ID = "synthetic-health-api-no-provider";
const SENTINEL = "PRIVATE_CAPTURE_CONTENT_MUST_NOT_BE_DISPLAYED";

function fixture(t) {
  const shadowDir = mkdtempSync(join(tmpdir(), "shadow-health-api-"));
  t.after(() => rmSync(shadowDir, { recursive: true, force: true }));
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const paths = {
    sessions: join(shadowDir, "sessions"),
    pending: join(shadowDir, "sessions", `${SESSION_ID}.pending.jsonl`),
    store: join(shadowDir, "sessions", `${SESSION_ID}.jsonl`),
    bundleDir: join(shadowDir, "sessions", SESSION_ID),
    bundle: join(shadowDir, "sessions", SESSION_ID, "bundle.json"),
    publicKey: join(shadowDir, "keys", "public.pem"),
    errorLog: join(shadowDir, "adapter-errors.log"),
  };
  const hook = (eventName, extras = {}) => handleHookEvent({
    eventName, shadowDir, privateKey: privatePem, keyId: "synthetic-health-key",
    stdin: { session_id: SESSION_ID, hook_event_name: eventName, ...extras },
  });
  const normal = () => {
    hook("SessionStart", { source: "startup" });
    hook("UserPromptSubmit", { prompt: SENTINEL });
    hook("SessionEnd", { reason: "other" });
  };
  const installPublicKey = () => {
    mkdirSync(join(shadowDir, "keys"), { recursive: true });
    writeFileSync(paths.publicKey, publicPem);
  };
  const inspect = (extra = {}) => inspectCaptureHealth({ shadowDir, sessionId: SESSION_ID, ...extra });
  return { shadowDir, privatePem, publicPem, paths, hook, normal, inspect, installPublicKey };
}

function snapshot(directory, prefix = "", out = []) {
  if (!existsSync(directory)) return out;
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name);
    const relative = `${prefix}${name}`;
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) out.push({ path: relative, target: readlinkSync(path), mtime: stat.mtimeMs });
    else if (stat.isDirectory()) {
      out.push({ path: relative, directory: true, mtime: stat.mtimeMs });
      snapshot(path, `${relative}/`, out);
    } else {
      out.push({ path: relative, sha256: createHash("sha256").update(readFileSync(path)).digest("hex"), mtime: stat.mtimeMs });
    }
  }
  return out;
}

function assertBoundary(report) {
  assert.equal(report.schema_version, "shadow-capture-health/v1");
  assert.equal(report.read_only, true);
  assert.equal(report.capture_completeness, "UNVERIFIED");
  assert.equal(report.provider_origin, "UNVERIFIED");
  assert.equal(report.resume_support, "UNSUPPORTED");
  assert.ok(Array.isArray(report.diagnostics));
  for (const code of report.diagnostics) assert.match(code, /^[A-Z0-9_]+$/);
  assert.ok(!JSON.stringify(report).includes(SENTINEL));
  assert.ok(!JSON.stringify(report).includes("PRIVATE KEY"));
}

const pendingRecord = () => ({ eventName: "SessionStart", stdin: { session_id: SESSION_ID, hook_event_name: "SessionStart", source: "resume", prompt: SENTINEL } });
const jsonl = (records) => records.map((record) => JSON.stringify(record)).join("\n") + "\n";

test("capture health observes an absent directory without creating capture artifacts or needing private keys", async (t) => {
  const f = fixture(t);
  const absent = join(f.shadowDir, "not-created");
  const before = snapshot(f.shadowDir);
  const report = await inspectCaptureHealth({ shadowDir: absent, sessionId: SESSION_ID });
  assertBoundary(report);
  assert.equal(report.health_state, "NO_CAPTURE_ARTIFACTS");
  assert.equal(report.observations.pending.present, false);
  assert.equal(report.observations.store.present, false);
  assert.equal(report.observations.bundle.verification, "NOT_PRESENT");
  assert.equal(existsSync(absent), false);
  assert.deepEqual(snapshot(f.shadowDir), before);
});

test("capture health counts buffered hooks without exposing original hook inputs or changing any bytes", async (t) => {
  const f = fixture(t);
  f.hook("SessionStart", { source: "startup" });
  f.hook("UserPromptSubmit", { prompt: SENTINEL });
  const before = snapshot(f.shadowDir);
  const report = await f.inspect();
  assertBoundary(report);
  assert.equal(report.health_state, "BUFFERED");
  assert.equal(report.observations.pending.present, true);
  assert.equal(report.observations.pending.valid, true);
  assert.equal(report.observations.pending.hook_count, 2);
  assert.equal(report.observations.store.present, false);
  assert.equal(report.observations.bundle.verification, "NOT_PRESENT");
  assert.deepEqual(snapshot(f.shadowDir), before);
});

test("capture health labels a materialized open store as structure-only rather than verified capture", async (t) => {
  const f = fixture(t);
  const session = createSession({
    agent: { name: "synthetic-health", version: SENTINEL },
    models: [{ model_id: SENTINEL, provider: null }],
    environmentFingerprint: { os: "controlled-test", node_version: "controlled-test" },
    privateKey: f.privatePem, keyId: "synthetic-health-key", sessionId: SESSION_ID,
    startedAtUtc: "2026-10-02T00:00:00.000Z", store: createFileStore({ path: f.paths.store }),
  });
  appendEvent(session, { event_type: "prompt", actor: "user", payload: { prompt: SENTINEL }, ts_utc: "2026-10-02T00:00:01.000Z" });
  const before = snapshot(f.shadowDir);
  const report = await f.inspect();
  assertBoundary(report);
  assert.equal(report.health_state, "OPEN_UNSEALED");
  assert.equal(report.observations.store.valid, true);
  assert.equal(report.observations.store.event_count, 1);
  assert.equal(report.observations.store.sealed, false);
  assert.equal(report.observations.store.validation, "STRUCTURE_ONLY");
  assert.equal(report.observations.bundle.termination, "NOT_SEALED");
  assert.deepEqual(snapshot(f.shadowDir), before);
});

test("capture health verifies a matching normal bundle with a public key only and keeps completeness unverified", async (t) => {
  const f = fixture(t);
  f.normal();
  f.installPublicKey();
  const before = snapshot(f.shadowDir);
  const report = await f.inspect();
  assertBoundary(report);
  assert.equal(report.health_state, "SEALED_VERIFIED");
  assert.equal(report.observations.bundle.verification, "VERIFIED");
  assert.equal(report.observations.bundle.event_count, 3);
  assert.equal(report.observations.bundle.termination, "RECORDED_SESSION_END");
  assert.equal(report.observations.store.event_count, 3);
  assert.equal(report.observations.store.sealed, true);
  assert.equal(report.observations.store.validation, "MATCHED_VERIFIED_BUNDLE");
  assert.equal(existsSync(join(f.shadowDir, "keys", "private.pem")), false);
  assert.deepEqual(snapshot(f.shadowDir), before);
});

test("capture health distinguishes a partial seal and a manually appended end from observed SessionEnd", async (t) => {
  for (const partial of [true, false]) {
    const f = fixture(t);
    f.hook("SessionStart", { source: "startup" });
    f.hook("UserPromptSubmit", { prompt: SENTINEL });
    sealSessionById({ sessionId: SESSION_ID, shadowDir: f.shadowDir, privateKey: f.privatePem, partial });
    const before = snapshot(f.shadowDir);
    const report = await f.inspect({ publicKeyPem: f.publicPem });
    assertBoundary(report);
    assert.equal(report.health_state, "SEALED_VERIFIED");
    assert.equal(report.observations.bundle.termination, partial ? "PARTIAL_SEAL" : "MANUAL_OR_UNOBSERVED_END");
    assert.equal(report.observations.store.validation, "MATCHED_VERIFIED_BUNDLE");
    assert.deepEqual(snapshot(f.shadowDir), before);
  }
});

test("capture health declines missing, wrong and private-only public keys without emitting key material", async (t) => {
  const f = fixture(t);
  f.normal();
  const missing = await f.inspect();
  assertBoundary(missing);
  assert.equal(missing.health_state, "SEALED_UNVERIFIABLE");
  assert.equal(missing.observations.bundle.verification, "UNVERIFIABLE");
  const wrongKey = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }).toString();
  const wrong = await f.inspect({ publicKeyPem: wrongKey });
  assertBoundary(wrong);
  assert.equal(wrong.health_state, "INVALID");
  assert.equal(wrong.observations.bundle.verification, "INVALID");
  const privateInput = await f.inspect({ publicKeyPem: f.privatePem });
  assertBoundary(privateInput);
  assert.notEqual(privateInput.health_state, "SEALED_VERIFIED");
  assert.ok(!JSON.stringify(privateInput).includes(f.privatePem));
});

test("capture health rejects corrupt pending records while retaining every original queue byte", async (t) => {
  const variants = [
    Buffer.from(`{"${SENTINEL}":`), Buffer.from([0xff]),
    Buffer.from(jsonl([null])),
    Buffer.from(jsonl([{ eventName: "UnknownHook", stdin: { session_id: SESSION_ID } }])),
    Buffer.from(jsonl([{ eventName: "SessionStart", stdin: { session_id: "another-session", hook_event_name: "SessionStart" } }])),
    Buffer.from(jsonl([{ eventName: "SessionStart", stdin: { session_id: SESSION_ID, hook_event_name: "SessionEnd" } }])),
  ];
  for (const bytes of variants) {
    const f = fixture(t);
    mkdirSync(f.paths.sessions);
    writeFileSync(f.paths.pending, bytes);
    const before = snapshot(f.shadowDir);
    const report = await f.inspect();
    assertBoundary(report);
    assert.equal(report.health_state, "INVALID");
    assert.equal(report.observations.pending.valid, false);
    assert.deepEqual(readFileSync(f.paths.pending), bytes);
    assert.deepEqual(snapshot(f.shadowDir), before);
  }
});

test("capture health rejects malformed, duplicate and unsupported store records instead of ignoring them", async (t) => {
  const golden = fixture(t);
  golden.normal();
  const records = readFileSync(golden.paths.store, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  const header = records.find((record) => record.kind === "header");
  const event = records.find((record) => record.kind === "event");
  const seal = records.find((record) => record.kind === "seal");
  const variants = [
    Buffer.from(`{"${SENTINEL}":`), Buffer.from([0xff]),
    Buffer.from(jsonl([header, header, event, seal])),
    Buffer.from(jsonl([header, event, seal, seal])),
    Buffer.from(jsonl([header, event, seal, event])),
    Buffer.from(jsonl([header, { kind: "future-unknown", payload: SENTINEL }])),
    Buffer.from(jsonl([event, seal])),
  ];
  for (const bytes of variants) {
    const f = fixture(t);
    mkdirSync(f.paths.sessions);
    writeFileSync(f.paths.store, bytes);
    const before = snapshot(f.shadowDir);
    const report = await f.inspect();
    assertBoundary(report);
    assert.equal(report.health_state, "INVALID");
    assert.equal(report.observations.store.valid, false);
    assert.deepEqual(snapshot(f.shadowDir), before);
  }
});

test("capture health flags sealed pending hooks, missing artifact counterparts and divergent store events as inconsistent", async (t) => {
  for (const mutate of [
    (f) => writeFileSync(f.paths.pending, jsonl([pendingRecord()])),
    (f) => rmSync(f.paths.bundle),
    (f) => rmSync(f.paths.store),
    (f) => {
      const records = readFileSync(f.paths.store, "utf8").trim().split("\n").map((line) => JSON.parse(line));
      records.find((record) => record.kind === "event").event.actor = "system";
      writeFileSync(f.paths.store, jsonl(records));
    },
  ]) {
    const f = fixture(t);
    f.normal();
    f.installPublicKey();
    mutate(f);
    const before = snapshot(f.shadowDir);
    const report = await f.inspect();
    assertBoundary(report);
    assert.equal(report.health_state, "INCONSISTENT");
    assert.deepEqual(snapshot(f.shadowDir), before);
  }
});

test("capture health cannot verify tampered or malformed bundle bytes from a previously signed session", async (t) => {
  for (const mutate of [
    (f) => writeFileSync(f.paths.bundle, `{"${SENTINEL}":`),
    (f) => writeFileSync(f.paths.bundle, Buffer.from([0xff])),
    (f) => {
      const bundle = JSON.parse(readFileSync(f.paths.bundle, "utf8"));
      bundle.signatures[0].signature = "invalid-signature";
      writeFileSync(f.paths.bundle, JSON.stringify(bundle));
    },
  ]) {
    const f = fixture(t);
    f.normal();
    f.installPublicKey();
    mutate(f);
    const before = snapshot(f.shadowDir);
    const report = await f.inspect();
    assertBoundary(report);
    assert.equal(report.health_state, "INVALID");
    assert.equal(report.observations.bundle.verification, "INVALID");
    assert.deepEqual(snapshot(f.shadowDir), before);
  }
});

test("capture health rejects oversized capture artifacts without truncating or repairing the original files", async (t) => {
  for (const field of ["pending", "store", "bundle"]) {
    const f = fixture(t);
    f.normal();
    f.installPublicKey();
    writeFileSync(f.paths[field], SENTINEL);
    truncateSync(f.paths[field], 16 * 1024 * 1024 + 1);
    const before = snapshot(f.shadowDir);
    const report = await f.inspect();
    assertBoundary(report);
    assert.equal(report.health_state, "INVALID");
    assert.ok(report.diagnostics.includes("ARTIFACT_TOO_LARGE"));
    assert.equal(lstatSync(f.paths[field]).size, 16 * 1024 * 1024 + 1);
    assert.deepEqual(snapshot(f.shadowDir), before);
  }
});

test("capture health identifies malformed verifier-shaped bundles as invalid artifacts rather than unavailable public keys", async (t) => {
  for (const mutate of [
    (bundle) => { bundle.events[0] = null; },
    (bundle) => { bundle.signatures[0] = null; },
    (bundle) => { bundle.header = null; },
    (bundle) => { bundle.header.schema_versions = null; },
  ]) {
    const f = fixture(t);
    f.normal();
    f.installPublicKey();
    const bundle = JSON.parse(readFileSync(f.paths.bundle, "utf8"));
    mutate(bundle);
    writeFileSync(f.paths.bundle, JSON.stringify(bundle));
    const before = snapshot(f.shadowDir);
    const report = await f.inspect();
    assertBoundary(report);
    assert.equal(report.health_state, "INVALID");
    assert.equal(report.observations.bundle.verification, "INVALID");
    assert.ok(!report.diagnostics.includes("PUBLIC_KEY_UNAVAILABLE"));
    assert.deepEqual(snapshot(f.shadowDir), before);
  }
});

test("capture health rejects unsafe session IDs and symlinked files or intermediate capture directories", async (t) => {
  const f = fixture(t);
  for (const sessionId of ["", ".", "..", "../escape", "/absolute", "nested/session", "nested\\session", "line\ncontrol"]) {
    const before = snapshot(f.shadowDir);
    assert.throws(() => f.inspect({ sessionId }), (error) => {
      assert.equal(error.code, "HEALTH_INPUT_INVALID");
      assert.equal(error.message, "HEALTH_INPUT_INVALID");
      return true;
    });
    assert.deepEqual(snapshot(f.shadowDir), before);
  }
  for (const linkParent of [false, true]) {
    const linked = fixture(t);
    const outside = join(linked.shadowDir, "outside");
    mkdirSync(outside);
    writeFileSync(join(outside, `${SESSION_ID}.pending.jsonl`), jsonl([pendingRecord()]));
    if (linkParent) symlinkSync(outside, linked.paths.sessions, "dir");
    else {
      mkdirSync(linked.paths.sessions);
      symlinkSync(join(outside, `${SESSION_ID}.pending.jsonl`), linked.paths.pending);
    }
    const before = snapshot(linked.shadowDir);
    const report = await linked.inspect();
    assertBoundary(report);
    assert.equal(report.health_state, "INVALID");
    assert.deepEqual(snapshot(linked.shadowDir), before);
  }
  const rootLinked = fixture(t);
  rootLinked.normal();
  rootLinked.installPublicKey();
  const alias = join(rootLinked.shadowDir, "root-alias");
  symlinkSync(rootLinked.shadowDir, alias, "dir");
  const before = snapshot(rootLinked.shadowDir);
  const report = await rootLinked.inspect({ shadowDir: alias });
  assertBoundary(report);
  assert.equal(report.health_state, "INVALID");
  assert.deepEqual(snapshot(rootLinked.shadowDir), before);
});

test("capture health reports global unattributed error history without reading or attributing its sensitive contents", async (t) => {
  const f = fixture(t);
  f.normal();
  f.installPublicKey();
  const errorBytes = Buffer.from(`2026-10-02T00:00:00.000Z Error: ${SENTINEL}\n/Users/private/raw-input\n`);
  writeFileSync(f.paths.errorLog, errorBytes);
  const before = snapshot(f.shadowDir);
  const report = await f.inspect();
  assertBoundary(report);
  assert.equal(report.health_state, "SEALED_VERIFIED");
  assert.deepEqual(report.observations.adapter_error_log, {
    present: true, byte_size: errorBytes.length, scope: "GLOBAL_UNATTRIBUTED",
  });
  assert.ok(!JSON.stringify(report).includes("/Users/private/raw-input"));
  assert.deepEqual(snapshot(f.shadowDir), before);
});
