// test/verifier-error-format.test.js
// Drift-catcher for the verifier structured-error contract.
// Spec: docs/spec/verifier-error-format.md
//
// Every {reason} the verifier can emit must be a stable snake_case code
// from the source-of-truth list in the spec. If a new failure path is
// added to verifyBundle without updating this test AND the spec, this
// test breaks — loudly — so drift can't leak into M5's tamper caption.
//
// Also asserts that the browser verifier (demos/replay/verify-browser.js)
// stays parity with the Node reference — same triggering input produces
// the same {reason}.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import {
  createSession,
  appendEvent,
  sealSession,
  verifyBundle,
} from "../packages/attest-core/session.js";
import { verifyBundleInBrowser } from "../demos/replay/verify-browser.js";
import { tamperInPlace } from "../demos/replay/tamper.js";

function freshKeypair() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privatePem: privateKey.export({ type: "pkcs8", format: "pem" }),
    publicPem: publicKey.export({ type: "spki", format: "pem" }),
  };
}

function fixtureBundle(privatePem) {
  const s = createSession({
    agent: { name: "test-agent", version: "1.0" },
    models: [{ model_id: "test:model", provider: "test" }],
    environmentFingerprint: { os: "test", node_version: "test" },
    keyId: "test-key",
    privateKey: privatePem,
  });
  appendEvent(s, { event_type: "user_message", actor: "user", payload: { text: "hi" } });
  appendEvent(s, { event_type: "tool_call", actor: "agent", payload: { tool: "Write" } });
  appendEvent(s, { event_type: "tool_result", actor: "tool", payload: { ok: true } });
  return sealSession(s);
}

// ── shape assertions ──────────────────────────────────────────

function assertErrorShape(result, wantReason, wantSeq) {
  assert.equal(result.ok, false, `expected ok=false, got ${JSON.stringify(result)}`);
  assert.ok(result.error, "missing structured error");
  assert.equal(result.error.reason, wantReason);
  assert.equal(result.error.seq, wantSeq);
  assert.equal(typeof result.error.impact, "string");
  assert.ok(result.error.impact.length > 0, "impact must be non-empty");
  // Back-compat: legacy top-level `reason` mirrors error.reason.
  assert.equal(result.reason, wantReason);
  if (typeof wantSeq === "number") {
    assert.equal(result.failedSeq, wantSeq);
  } else {
    assert.equal(result.failedSeq, undefined);
  }
}


// ── each triggerable reason gets a case ───────────────────────

test("public_key_missing — verifier called without publicKey", () => {
  const { privatePem } = freshKeypair();
  const bundle = fixtureBundle(privatePem);
  const r = verifyBundle(bundle, {});
  assertErrorShape(r, "public_key_missing", null);
});

test("bundle_missing — verifier called with null/undefined bundle", () => {
  const { publicPem } = freshKeypair();
  assertErrorShape(verifyBundle(null, { publicKey: publicPem }), "bundle_missing", null);
  assertErrorShape(verifyBundle(undefined, { publicKey: publicPem }), "bundle_missing", null);
});

test("bundle_unsupported_version — bundle_version mismatch", () => {
  const { privatePem, publicPem } = freshKeypair();
  const bundle = fixtureBundle(privatePem);
  bundle.bundle_version = 99;
  const r = verifyBundle(bundle, { publicKey: publicPem });
  assertErrorShape(r, "bundle_unsupported_version", null);
});

test("events_not_array — bundle.events is not an array", () => {
  const { privatePem, publicPem } = freshKeypair();
  const bundle = fixtureBundle(privatePem);
  bundle.events = "not an array";
  const r = verifyBundle(bundle, { publicKey: publicPem });
  assertErrorShape(r, "events_not_array", null);
});

test("signatures_missing — bundle.signatures is empty", () => {
  const { privatePem, publicPem } = freshKeypair();
  const bundle = fixtureBundle(privatePem);
  bundle.signatures = [];
  const r = verifyBundle(bundle, { publicKey: publicPem });
  assertErrorShape(r, "signatures_missing", null);
});

test("signatures_unsupported_algorithm — non-ed25519 algorithm", () => {
  const { privatePem, publicPem } = freshKeypair();
  const bundle = fixtureBundle(privatePem);
  bundle.signatures[0].algorithm = "ecdsa-p256";
  const r = verifyBundle(bundle, { publicKey: publicPem });
  assertErrorShape(r, "signatures_unsupported_algorithm", null);
});

test("seq_gap — event seq doesn't match its index", () => {
  const { privatePem, publicPem } = freshKeypair();
  const bundle = fixtureBundle(privatePem);
  bundle.events[1].seq = 42;
  const r = verifyBundle(bundle, { publicKey: publicPem });
  assertErrorShape(r, "seq_gap", 1);
});

test("prev_hash_mismatch — chain break from a tampered event", () => {
  const { privatePem, publicPem } = freshKeypair();
  const bundle = fixtureBundle(privatePem);
  // Tamper event 1 — its own_hash changes, so event 2's prev_hash no
  // longer matches → detected at seq 2.
  tamperInPlace(bundle, 1);
  const r = verifyBundle(bundle, { publicKey: publicPem });
  assertErrorShape(r, "prev_hash_mismatch", 2);
});

test("batch_root_mismatch — last event tampered", () => {
  const { privatePem, publicPem } = freshKeypair();
  const bundle = fixtureBundle(privatePem);
  // sealSession auto-appended session_end as the LAST event. Tamper it —
  // no downstream event to catch the break, so batch_root fails.
  tamperInPlace(bundle, bundle.events.length - 1);
  const r = verifyBundle(bundle, { publicKey: publicPem });
  assertErrorShape(r, "batch_root_mismatch", null);
});

test("signature_verification_failed — wrong public key", () => {
  const { privatePem } = freshKeypair();
  const { publicPem: wrongPem } = freshKeypair();
  const bundle = fixtureBundle(privatePem);
  const r = verifyBundle(bundle, { publicKey: wrongPem });
  assertErrorShape(r, "signature_verification_failed", null);
});


// ── browser + node parity: same reason code on every failure ──

const PARITY_SCENARIOS = [
  {
    name: "prev_hash_mismatch",
    mutate: (b) => { tamperInPlace(b, 1); },
    wantReason: "prev_hash_mismatch",
  },
  {
    name: "batch_root_mismatch",
    mutate: (b) => { tamperInPlace(b, b.events.length - 1); },
    wantReason: "batch_root_mismatch",
  },
  {
    name: "signatures_unsupported_algorithm",
    mutate: (b) => { b.signatures[0].algorithm = "ecdsa-p256"; },
    wantReason: "signatures_unsupported_algorithm",
  },
  {
    name: "bundle_unsupported_version",
    mutate: (b) => { b.bundle_version = 99; },
    wantReason: "bundle_unsupported_version",
  },
];

for (const s of PARITY_SCENARIOS) {
  test(`node + browser verifiers report identical reason for ${s.name}`, async () => {
    const { privatePem, publicPem } = freshKeypair();
    const bundle = fixtureBundle(privatePem);
    s.mutate(bundle);
    const nodeResult = verifyBundle(bundle, { publicKey: publicPem });
    const browserResult = await verifyBundleInBrowser(bundle, publicPem);
    assert.equal(nodeResult.error.reason, s.wantReason);
    assert.equal(browserResult.error.reason, s.wantReason);
    assert.equal(nodeResult.error.reason, browserResult.error.reason);
    assert.equal(nodeResult.error.seq, browserResult.error.seq);
  });
}


// ── legacy back-compat contract ─────────────────────────────

test("ok:true return shape unchanged — no `error` on success", async () => {
  const { privatePem, publicPem } = freshKeypair();
  const bundle = fixtureBundle(privatePem);
  const nodeR = verifyBundle(bundle, { publicKey: publicPem });
  const browserR = await verifyBundleInBrowser(bundle, publicPem);
  assert.equal(nodeR.ok, true);
  assert.equal(nodeR.error, undefined);
  assert.equal(browserR.ok, true);
  assert.equal(browserR.error, undefined);
});
