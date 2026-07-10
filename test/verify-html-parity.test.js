// test/verify-html-parity.test.js
//
// Verifies that the browser-side WebCrypto algorithm inside verify.html
// produces byte-for-byte the same batch_root as the Node session API, and
// that its signature-verification path returns the same ok/reject.
//
// We can't headlessly load HTML in a unit test without adding jsdom /
// playwright, so this test re-implements the exact algorithm from
// verify.html's <script> block in Node 20+'s WebCrypto (crypto.subtle,
// exposed as globalThis.crypto since Node 20) and asserts parity against
// packages/attest-core/session.js.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import {
  createSession,
  appendEvent,
  sealSession,
  verifyBundle as nodeVerify,
} from "../packages/attest-core/session.js";

// ── Algorithm mirror of verify.html <script> block ──
function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + canonicalize(value[k])).join(",") + "}";
}

async function sha256Hex(bytes) {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function canonicalBytes(value) {
  return new TextEncoder().encode(canonicalize(value));
}

async function headerSeedHash(header) {
  const normalized = { ...header, session_ended_at_utc: null };
  return sha256Hex(canonicalBytes(normalized));
}

function signedShape(event) {
  const { payload_ref, ...rest } = event;
  return rest;
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function b64urlToBytes(s) {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - s.length % 4) % 4);
  const bin = Buffer.from(padded, "base64");
  return new Uint8Array(bin);
}

function pemToSpki(pem) {
  const cleaned = pem.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s+/g, "");
  return new Uint8Array(Buffer.from(cleaned, "base64")).buffer;
}

async function webcryptoVerify(bundle, publicKeyPem) {
  if (bundle.bundle_version !== 1) return { ok: false, reason: "bad version" };
  const seed = await headerSeedHash(bundle.header);
  let expectedPrev = seed;
  const eventHashes = [];
  for (let i = 0; i < bundle.events.length; i++) {
    const ev = bundle.events[i];
    if (ev.seq !== i) return { ok: false, reason: `seq gap ${i}` };
    if (ev.prev_hash !== expectedPrev) return { ok: false, reason: "prev_hash mismatch", failedSeq: i };
    const own = await sha256Hex(canonicalBytes(signedShape(ev)));
    eventHashes.push(own);
    expectedPrev = own;
  }
  const concat = new Uint8Array(eventHashes.length * 32);
  eventHashes.forEach((h, i) => concat.set(hexToBytes(h), i * 32));
  const batchRoot = await sha256Hex(concat);
  if (batchRoot !== bundle.batch_root) return { ok: false, reason: "batch_root mismatch" };
  const sig = bundle.signatures[0];
  const key = await globalThis.crypto.subtle.importKey(
    "spki",
    pemToSpki(publicKeyPem),
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  const sigOk = await globalThis.crypto.subtle.verify(
    { name: "Ed25519" },
    key,
    b64urlToBytes(sig.signature),
    hexToBytes(batchRoot),
  );
  if (!sigOk) return { ok: false, reason: "signature verification failed" };
  return { ok: true, batchRoot };
}


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
