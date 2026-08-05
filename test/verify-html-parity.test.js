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
  // Match verify.html: both payload_ref AND inline payload are excluded from the signed
  // shape (payload_hash is the authenticator; the payload is rebound separately).
  const { payload_ref, payload, ...rest } = event;
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
    // Rebind inline plaintext to its signed payload_hash (matches verify.html) — catches a
    // plaintext edit that leaves the chain intact.
    if (ev.payload !== undefined && ev.payload !== null) {
      const rehash = await sha256Hex(canonicalBytes(ev.payload));
      if (rehash !== ev.payload_hash) return { ok: false, reason: "payload_hash_mismatch", failedSeq: i };
    }
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

// Guard against silent drift: verify.html hand-maintains its inline verifier (not yet
// build-generated from the shared module), so pin the load-bearing rebind lines directly.
test("verify.html source still carries the payload rebind (drift guard)", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { resolve, dirname } = await import("node:path");
  const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "..", "verify.html"), "utf8");
  assert.match(src, /const signedShape=e=>\{const\{payload_ref,payload,\.\.\.r\}=e/, "signedShape must strip BOTH payload_ref and payload");
  assert.match(src, /ev\.payload_hash/, "must reference payload_hash for the rebind");
  assert.match(src, /payload_hash_mismatch/, "must fail with payload_hash_mismatch on a plaintext edit");
});
