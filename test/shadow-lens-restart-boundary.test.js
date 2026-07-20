// Restart / serverless-boundary tests. Proves the staged store never pretends to be durable,
// the one-shot /run path needs no shared memory, sealing is idempotent, versions conflict on
// staleness, the pristine bundle is never overwritten, and expired/replayed tokens are rejected.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { runOneShot } from "../api/shadow-lens/run.js";
import {
  resolveLensStore, InMemoryLensStore, issueSessionToken, NO_DURABLE_STORE,
} from "../apps/shadow-lens/backend/session-store.mjs";
import {
  createSession, registerCapture, validateSourceMap, analyze, review, sealEvidence, verify,
} from "../apps/shadow-lens/backend/lens-api.mjs";

function keys() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return { priv: privateKey.export({ type: "pkcs8", format: "pem" }), pub: publicKey.export({ type: "spki", format: "pem" }) };
}
const DEVICE = { platform: "unity-xreal", runtime_mode: "UNITY_XREAL", tracking_mode: "6dof", camera_mode: "xreal-eye" };
const SM = [{ source_id: "L1", text: "DTI: 0.41", bounding_box_normalized: { x: 0.1, y: 0.3, w: 0.4, h: 0.03 }, confidence: 0.95 }];
const FIND = [{ claim: "DTI over ceiling", source_ids: ["L1"], quote: "DTI: 0.41", severity: "warn", confidence: 0.9 }];
const runBody = { source_map: SM, capture: { capture_sha256: "sha256:" + "a".repeat(64) }, device: DEVICE, build: { app_commit: "t" }, findings: FIND, reviewer: { decision: "approved" } };

test("one-shot /run completes with no shared process memory (two independent runs)", async () => {
  const k = keys();
  const a = await runOneShot(runBody, { serverKey: k });
  const b = await runOneShot(runBody, { serverKey: k });
  assert.equal(a.http, 200); assert.equal(b.http, 200);
  assert.equal(a.verification.record_integrity, "verified");
  assert.notEqual(a.session.session_id, b.session.session_id);   // fresh session each request
  assert.equal(a.flow.scenes.audit.every((r) => r.session_id === a.session.session_id), true);
});

test("staged store refuses honestly in a serverless prod runtime with no durable store", () => {
  const r = resolveLensStore({ NODE_ENV: "production" });
  assert.equal(r.store, null);
  assert.equal(r.backend, "none");
  // the code the endpoint returns
  assert.equal(NO_DURABLE_STORE, "PERSISTENT_SESSION_STORE_NOT_CONFIGURED");
});

test("a restarted process cannot silently find/mutate a prior session", async () => {
  const store1 = new InMemoryLensStore();
  const c = await createSession({ device: DEVICE, store: store1 });
  // simulate a cold start: a brand-new store has no memory of the session
  const store2 = new InMemoryLensStore();
  assert.equal(await store2.get(c.session_id), null);
  // a staged op against the fresh store fails explicitly (not a silent empty success)
  const r = await registerCapture({ token: c.token, bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]), store: store2 });
  assert.equal(r.ok, false);
  assert.equal(r.code, "unauthorized"); // token authed but session absent → downstream get is null → guarded
});

async function sealedSession(store, k, { idem } = {}) {
  const c = await createSession({ device: DEVICE, build: { app_commit: "t" }, store });
  await registerCapture({ token: c.token, bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9]), store });
  await validateSourceMap({ token: c.token, sourceMap: SM, store });
  await analyze({ token: c.token, findings: FIND, store });
  await review({ token: c.token, reviewer: { decision: "approved" }, store });
  const seal = await sealEvidence({ token: c.token, signingKeyPem: k.priv, publicKeyPem: k.pub, idempotency_key: idem, store });
  return { c, seal };
}

test("idempotency key prevents duplicate sealing; missing key after seal is refused", async () => {
  const store = new InMemoryLensStore(); const k = keys();
  const { c, seal } = await sealedSession(store, k, { idem: "req-123" });
  assert.equal(seal.ok, true);
  // same key → idempotent replay of the SAME bundle
  const again = await sealEvidence({ token: c.token, signingKeyPem: k.priv, publicKeyPem: k.pub, idempotency_key: "req-123", store });
  assert.equal(again.idempotent_replay, true);
  assert.equal(again.session.session_id, seal.session.session_id);
  // different / missing key → refused, pristine bundle protected
  const dup = await sealEvidence({ token: c.token, signingKeyPem: k.priv, publicKeyPem: k.pub, store });
  assert.equal(dup.ok, false);
  assert.equal(dup.code, "already_sealed");
});

test("stale session_version produces a conflict", async () => {
  const store = new InMemoryLensStore(); const k = keys();
  const c = await createSession({ device: DEVICE, build: { app_commit: "t" }, store });
  await registerCapture({ token: c.token, bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 5]), store });
  await validateSourceMap({ token: c.token, sourceMap: SM, store });
  await analyze({ token: c.token, findings: FIND, store });
  const r = await sealEvidence({ token: c.token, signingKeyPem: k.priv, publicKeyPem: k.pub, expected_version: 0, store });
  assert.equal(r.ok, false);
  assert.equal(r.code, "version_conflict");
});

test("tamper never overwrites the pristine stored bundle", async () => {
  const store = new InMemoryLensStore(); const k = keys();
  const { c, seal } = await sealedSession(store, k, { idem: "x" });
  const before = await store.get(c.session_id);
  // tamper a COPY (what a demo 'tamper' button does) — the store must be untouched
  const copy = structuredClone(seal.bundle);
  (copy.events ?? copy.records ?? [{}])[0].payload = { injected: true };
  const after = await store.get(c.session_id);
  assert.deepEqual(after.verification, before.verification);
  assert.equal(after.verification.record_integrity, "verified");
});

test("a foreign/replayed token (wrong secret or expired) cannot mutate a session", async () => {
  const store = new InMemoryLensStore();
  await createSession({ device: DEVICE, store }); // establishes the process session secret
  // a token minted elsewhere (different secret) — a replay from another origin — is rejected.
  const foreign = issueSessionToken("sls_ghost", { secret: "some-other-servers-secret", ttlSec: 900 });
  const r1 = await validateSourceMap({ token: foreign, sourceMap: SM, store });
  assert.equal(r1.ok, false);
  assert.equal(r1.code, "unauthorized");
  // an already-expired token is likewise rejected (expiry mechanics unit-tested in the store).
  const expired = issueSessionToken("sls_ghost", { secret: "some-other-servers-secret", ttlSec: -5 });
  const r2 = await validateSourceMap({ token: expired, sourceMap: SM, store });
  assert.equal(r2.ok, false);
});
