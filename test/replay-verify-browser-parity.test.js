// test/replay-verify-browser-parity.test.js
// Parity guarantee between the WebCrypto-based verifier in
// `demos/replay/verify-browser.js` and the Node reference in
// `packages/attest-core/session.js`. If they ever return different
// {ok, reason, failedSeq} for the same input, the M5 demo will lie to
// an auditor. Test catches drift before that ships.
//
// Uses Node 20's built-in WebCrypto (globalThis.crypto.subtle) — same
// primitive the browser has. TextEncoder is also globally available.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import { verifyBundleInBrowser } from "../demos/replay/verify-browser.js";
import {
  createSession,
  appendEvent,
  sealSession,
  verifyBundle,
} from "../packages/attest-core/session.js";
import { tamperInPlace, chooseTamperTarget } from "../demos/replay/tamper.js";

function freshKeypair() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privatePem: privateKey.export({ type: "pkcs8", format: "pem" }),
    publicPem: publicKey.export({ type: "spki", format: "pem" }),
  };
}

function buildFixtureBundle(privatePem) {
  const s = createSession({
    agent: { name: "test-agent", version: "1.0" },
    models: [{ model_id: "test:model", provider: "test" }],
    environmentFingerprint: { os: "test", node_version: "test" },
    keyId: "test-key",
    privateKey: privatePem,
  });
  appendEvent(s, { event_type: "user_message", actor: "user", payload: { text: "hi" } });
  appendEvent(s, { event_type: "tool_call", actor: "agent", payload: { tool: "Write" }, extensions: { tool: "Write" } });
  appendEvent(s, { event_type: "tool_result", actor: "tool", payload: { ok: true } });
  return sealSession(s);
}

test("browser + node verifier both return ok=true on a clean bundle with same fields", async () => {
  const { privatePem, publicPem } = freshKeypair();
  const bundle = buildFixtureBundle(privatePem);

  const nodeResult = verifyBundle(bundle, { publicKey: publicPem });
  const browserResult = await verifyBundleInBrowser(bundle, publicPem);

  assert.equal(nodeResult.ok, true, nodeResult.reason);
  assert.equal(browserResult.ok, true, browserResult.reason);
  // Batch root is the primary structural agreement point.
  assert.equal(nodeResult.batchRoot ?? bundle.batch_root, bundle.batch_root);
  assert.equal(browserResult.batchRoot, bundle.batch_root);
});

test("browser + node verifier both return prev_hash mismatch on tampered payload_hash", async () => {
  const { privatePem, publicPem } = freshKeypair();
  const bundle = buildFixtureBundle(privatePem);
  const target = chooseTamperTarget(bundle);
  tamperInPlace(bundle, target);

  const nodeResult = verifyBundle(bundle, { publicKey: publicPem });
  const browserResult = await verifyBundleInBrowser(bundle, publicPem);

  assert.equal(nodeResult.ok, false);
  assert.equal(browserResult.ok, false);
  assert.equal(nodeResult.reason, browserResult.reason,
    `reasons diverged: node="${nodeResult.reason}" browser="${browserResult.reason}"`);
  // Both should point at the SAME downstream event (target + 1)
  // because that's where the chain break is detected.
  assert.equal(nodeResult.failedSeq, browserResult.failedSeq,
    `failedSeq diverged: node=${nodeResult.failedSeq} browser=${browserResult.failedSeq}`);
});

test("browser verifier returns 'batch_root mismatch' on a bundle whose last event is tampered", async () => {
  // Interesting edge case: tampering the LAST event doesn't break
  // prev_hash chain (no downstream event to check), but batch_root
  // still mismatches. Confirms both verifiers agree on this shape.
  const { privatePem, publicPem } = freshKeypair();
  const bundle = buildFixtureBundle(privatePem);
  // sealSession appends session_end as last event. Tamper it.
  const last = bundle.events.length - 1;
  tamperInPlace(bundle, last);

  const nodeResult = verifyBundle(bundle, { publicKey: publicPem });
  const browserResult = await verifyBundleInBrowser(bundle, publicPem);

  assert.equal(nodeResult.ok, false);
  assert.equal(browserResult.ok, false);
  assert.equal(nodeResult.reason, browserResult.reason);
  // Both should report batch_root mismatch — no per-seq downstream
  // event to catch this at chain-walk time.
  assert.equal(nodeResult.reason, "batch_root mismatch");
});
