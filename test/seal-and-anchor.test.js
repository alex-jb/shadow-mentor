// Tests for sealAndAnchor() — the opt-in async convenience that seals a session
// and embeds external anchors for its batch_root in one call. Coverage is on the
// WIRING (seal → embed, batch_root unchanged, signature intact, error modes)
// using an injectable requestAnchor so it's fully offline; the real TSA/Rekor
// network paths are thin wrappers over requestTimestamp/submitRekorEntry, which
// have their own tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { createSession, appendEvent, sealSession, sealAndAnchor, verifyBundle } from "../packages/attest-core/session.js";

function mkSession() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const session = createSession({
    agent: { name: "claude-code", version: "1.2.3" },
    models: [{ model_id: "anthropic:claude-sonnet-4-6", provider: "anthropic" }],
    environmentFingerprint: { os: "darwin-25.3.0", node_version: "24.14.1" },
    keyId: "test-key",
    privateKey,
  });
  appendEvent(session, { event_type: "model_output", actor: "agent", payload: { text: "hi" } });
  session._testPublicKey = publicKey;
  return session;
}
const pub = (s) => s._testPublicKey;

const synthAnchor = (batchRootHex) => ({ kind: "custom-test", batch_root: batchRootHex, anchor_ref: "synthetic", anchored_at_utc: "2026-07-17T00:00:00.000Z" });

test("no anchor option → equivalent to sealSession (no external_anchors), bundle verifies", async () => {
  const s = mkSession();
  const bundle = await sealAndAnchor(s);
  assert.equal(bundle.external_anchors, undefined);
  assert.ok(bundle.batch_root && bundle.signatures.length === 1);
  assert.equal(verifyBundle(bundle, { publicKey: pub(s) }).ok, true);
});

test("requestAnchor → anchor embedded, batch_root unchanged, signature still valid", async () => {
  const s = mkSession();
  let seenRoot = null;
  const bundle = await sealAndAnchor(s, { requestAnchor: (root) => { seenRoot = root; return synthAnchor(root); } });
  assert.equal(seenRoot, bundle.batch_root);                       // anchor saw the real root
  assert.equal(bundle.external_anchors.length, 1);
  assert.equal(bundle.external_anchors[0].batch_root, bundle.batch_root);
  assert.equal(verifyBundle(bundle, { publicKey: pub(s) }).ok, true); // anchoring didn't corrupt the sealed bundle
});

test("requestAnchor may return an array → all embedded", async () => {
  const bundle = await sealAndAnchor(mkSession(), { requestAnchor: (r) => [synthAnchor(r), { ...synthAnchor(r), anchor_ref: "second" }] });
  assert.equal(bundle.external_anchors.length, 2);
});

test("anchor failure → throws by default (never a silently-unanchored bundle)", async () => {
  await assert.rejects(
    () => sealAndAnchor(mkSession(), { requestAnchor: () => { throw new Error("TSA down"); } }),
    /sealAndAnchor: custom anchor failed: TSA down/,
  );
});

test("bestEffortAnchors:true → failure recorded in anchor_errors, bundle still returned + valid", async () => {
  const s = mkSession();
  const bundle = await sealAndAnchor(s, { bestEffortAnchors: true, requestAnchor: () => { throw new Error("TSA down"); } });
  assert.equal(bundle.external_anchors, undefined);
  assert.equal(bundle.anchor_errors.length, 1);
  assert.equal(bundle.anchor_errors[0].anchor, "custom");
  assert.match(bundle.anchor_errors[0].reason, /TSA down/);
  assert.equal(verifyBundle(bundle, { publicKey: pub(s) }).ok, true);
});

test("double seal guarded — sealAndAnchor on an already-sealed session throws", async () => {
  const session = mkSession();
  sealSession(session);
  await assert.rejects(() => sealAndAnchor(session), /already sealed/);
});
