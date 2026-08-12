// test/verify-html-parity.test.js
//
// Verifies that the browser-side WebCrypto verifier verify.html ships produces
// byte-for-byte the same batch_root as the Node session API, and that its
// signature + payload-rebind paths return the same ok/reject.
//
// The algorithm is NO LONGER hand-copied here. verify.html's matrix verifier is
// single-sourced in packages/attest-core/verify-bundle.browser.mjs
// (BROWSER_VERIFY_MATRIX_JS) and injected into verify.html by
// scripts/build-verify-html.mjs. This test evaluates that SAME source string in
// Node 20+'s WebCrypto (crypto.subtle / atob / TextEncoder are all globals), so
// it exercises the exact code verify.html runs — not a copy that can drift.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import {
  createSession,
  appendEvent,
  sealSession,
  verifyBundle as nodeVerify,
} from "../packages/attest-core/session.js";
import { BROWSER_VERIFY_MATRIX_JS } from "../packages/attest-core/verify-bundle.browser.mjs";

// Evaluate the single-source browser verifier and expose its verifyBundle. Runs
// in global scope, so crypto.subtle / atob / TextEncoder resolve to Node globals.
const { verifyBundle: webcryptoVerify } = new Function(
  BROWSER_VERIFY_MATRIX_JS + "\nreturn { verifyBundle };",
)();


// ── Test cases ──

function makeBundle() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const s = createSession({
    agent: { name: "parity-test", version: "1.0.0" },
    models: [{ model_id: "test:x", provider: "test" }],
    environmentFingerprint: { os: "test", node_version: process.version },
    keyId: "parity",
    privateKey,
  });
  appendEvent(s, { event_type: "user_message", actor: "user", payload: { text: "hi" } });
  appendEvent(s, { event_type: "tool_call", actor: "agent", payload: { tool: "grep" } });
  appendEvent(s, { event_type: "tool_result", actor: "tool", payload: { hits: 0 } });
  const bundle = sealSession(s);
  const publicPem = publicKey.export({ type: "spki", format: "pem" });
  return { bundle, publicPem, publicKey, privateKey };
}


test("verify.html algorithm accepts a valid bundle (parity with Node verify)", async () => {
  const { bundle, publicPem } = makeBundle();
  const nodeResult = nodeVerify(bundle, { publicKey: publicPem });
  assert.equal(nodeResult.ok, true, nodeResult.reason);

  const htmlResult = await webcryptoVerify(bundle, publicPem);
  assert.equal(htmlResult.ok, true, htmlResult.reason);
  assert.equal(htmlResult.batchRoot, bundle.batch_root);
});


test("verify.html algorithm rejects tampered payload_hash (parity)", async () => {
  const { bundle, publicPem } = makeBundle();
  bundle.events[1].payload_hash = "0".repeat(64);

  const nodeResult = nodeVerify(bundle, { publicKey: publicPem });
  const htmlResult = await webcryptoVerify(bundle, publicPem);

  assert.equal(nodeResult.ok, false);
  assert.equal(htmlResult.ok, false);
});


test("verify.html algorithm rejects wrong public key (parity)", async () => {
  const { bundle } = makeBundle();
  const other = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" });

  const nodeResult = nodeVerify(bundle, { publicKey: other });
  const htmlResult = await webcryptoVerify(bundle, other);

  assert.equal(nodeResult.ok, false);
  assert.equal(htmlResult.ok, false);
});


test("verify.html algorithm accepts a bundle with redacted payload_ref (parity)", async () => {
  const { bundle, publicPem } = makeBundle();
  bundle.events[1].payload_ref = null;

  const nodeResult = nodeVerify(bundle, { publicKey: publicPem });
  const htmlResult = await webcryptoVerify(bundle, publicPem);

  assert.equal(nodeResult.ok, true, nodeResult.reason);
  assert.equal(htmlResult.ok, true, htmlResult.reason);
});

// The EMBEDDED-payload path — the one the adverse-action wedge actually produces
// (embedPayloads:true), which no parity test previously exercised (A#4). A plaintext
// edit leaves the chain intact and must be caught only by the payload→hash rebind.
test("verify.html verifier rebinds an EMBEDDED-payload bundle + localizes a plaintext edit (parity with Node)", async () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const s = createSession({
    agent: { name: "parity", version: "1.0.0" }, models: [],
    environmentFingerprint: { os: "test", node_version: process.version },
    keyId: "parity", privateKey, embedPayloads: true,
  });
  appendEvent(s, { event_type: "model_output", actor: "model", payload: { kind: "council_verdict", final_verdict: "block" } });
  const bundle = sealSession(s);
  const pub = publicKey.export({ type: "spki", format: "pem" });

  assert.equal((await webcryptoVerify(bundle, pub)).ok, true, "clean embedded bundle must verify");
  assert.equal(nodeVerify(bundle, { publicKey: pub }).ok, true);

  const t = JSON.parse(JSON.stringify(bundle));
  const ev = t.events.find((e) => e.payload && e.payload.kind === "council_verdict");
  ev.payload.final_verdict = "approve"; // plaintext flip, hash + chain untouched
  const html = await webcryptoVerify(t, pub);
  const node = nodeVerify(t, { publicKey: pub });
  assert.equal(html.ok, false, "plaintext edit must FAIL in the verify.html algorithm");
  assert.equal(html.reason, "payload_hash_mismatch");
  assert.equal(node.ok, false);
});

// PARTIAL source-resolution cross-impl: a bundle where SOME events carry inline
// plaintext and others are hash-only. Both verifiers ACCEPT it (ok parity holds),
// but they label source-resolution differently — and both are safe: the Node
// verifier reports PARTIAL; the browser matrix conservatively reports NOT_PRESENT
// (it only claims VERIFIED when EVERY event's plaintext was present + rebound, so
// it never over-claims). This test pins that intentional divergence.
test("PARTIAL-embed bundle: both accept; Node=PARTIAL, browser matrix=NOT_PRESENT (both safe)", async () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const s = createSession({
    agent: { name: "parity", version: "1.0.0" }, models: [],
    environmentFingerprint: { os: "test", node_version: process.version },
    keyId: "parity", privateKey, embedPayloads: true,
  });
  appendEvent(s, { event_type: "user_message", actor: "user", payload: { text: "a" } });
  appendEvent(s, { event_type: "model_output", actor: "model", payload: { v: "block" } });
  const bundle = sealSession(s);
  const pub = publicKey.export({ type: "spki", format: "pem" });

  // Strip ONE event's inline payload (keep its payload_hash) → partial coverage.
  const partial = JSON.parse(JSON.stringify(bundle));
  delete partial.events[0].payload;

  const node = nodeVerify(partial, { publicKey: pub });
  const html = await webcryptoVerify(partial, pub);
  assert.equal(node.ok, true, node.reason);
  assert.equal(html.ok, true, html.reason);
  assert.equal(node.sourceResolution, "PARTIAL");
  assert.equal(html.matrix.source_resolution, "NOT_PRESENT");
});

// Pin the load-bearing rebind lines in the SHIPPED verify.html output. verify.html's
// verifier is now build-generated from the shared module (scripts/build-verify-html.mjs);
// these assertions confirm the generated file still carries the payload rebind, and the
// separate build --check drift gate (test/verify-html-build-drift.test.js) confirms it is
// in sync with the module source.
test("verify.html source still carries the payload rebind (drift guard)", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { resolve, dirname } = await import("node:path");
  const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "..", "verify.html"), "utf8");
  assert.match(src, /const signedShape=e=>\{const\{payload_ref,payload,\.\.\.r\}=e/, "signedShape must strip BOTH payload_ref and payload");
  assert.match(src, /ev\.payload_hash/, "must reference payload_hash for the rebind");
  assert.match(src, /payload_hash_mismatch/, "must fail with payload_hash_mismatch on a plaintext edit");
});
