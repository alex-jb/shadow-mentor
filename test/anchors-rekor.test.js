// test/anchors-rekor.test.js
// v3 M3 sprint 3 — contract tests for Sigstore Rekor transparency-log adapter.
//
// Everything hermetic:
//   - Synthetic Rekor entry bodies (hashedrekord v0.0.1 shape).
//   - Synthetic 4-leaf Merkle tree for inclusion proof.
//   - Ephemeral ECDSA-P256 keypair to sign a synthetic SET.
//   - A live rekor.sigstore.dev smoke test is gated behind SHADOW_TEST_LIVE_REKOR.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createSign, generateKeyPairSync } from "node:crypto";

import {
  TRUST_LEVELS,
  trustLevelRank,
  buildRekorHashedrekordEntry,
  canonicalizeJson,
  extractRekorPayloadHash,
  rekorLeafHash,
  verifyInclusionProof,
  verifyRekorSet,
  verifyRekorAnchor,
} from "../packages/attest-core/anchors.js";
import {
  appendEvent,
  createSession,
  sealSession,
  verifyBundle,
} from "../packages/attest-core/session.js";

// ── canonicalizeJson ──────────────────────────────────────────

test("canonicalizeJson sorts object keys and preserves subset types", () => {
  const out = canonicalizeJson({ z: 1, a: "two", m: [3, 4], nested: { y: true, x: null } });
  assert.equal(out, '{"a":"two","m":[3,4],"nested":{"x":null,"y":true},"z":1}');
});

test("canonicalizeJson rejects non-integer numbers", () => {
  assert.throws(() => canonicalizeJson({ v: 1.5 }), /only integers/);
});

// ── buildRekorHashedrekordEntry ───────────────────────────────

test("buildRekorHashedrekordEntry produces a decodable body with expected payload hash", () => {
  const batchRootHex = "a".repeat(64);
  const { body, hashedrekord } = buildRekorHashedrekordEntry({
    batchRootHex,
    signatureBase64: "AAAA",
    publicKeyPem: "-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----\n",
  });
  assert.equal(hashedrekord.kind, "hashedrekord");
  const decoded = Buffer.from(body, "base64").toString("utf8");
  assert.match(decoded, /"algorithm":"sha256"/);
  const payload = extractRekorPayloadHash(body);
  assert.deepEqual(payload, { algorithm: "sha256", hex: batchRootHex });
});

test("buildRekorHashedrekordEntry rejects missing args", () => {
  assert.throws(
    () => buildRekorHashedrekordEntry({ batchRootHex: "aa", signatureBase64: "bb" }),
    /required/,
  );
});

// ── extractRekorPayloadHash ───────────────────────────────────

test("extractRekorPayloadHash returns null for non-hashedrekord body", () => {
  const body = Buffer.from(JSON.stringify({ kind: "other" }), "utf8").toString("base64");
  assert.equal(extractRekorPayloadHash(body), null);
});

test("extractRekorPayloadHash returns null for malformed base64", () => {
  assert.equal(extractRekorPayloadHash("!!!not-base64!!!"), null);
});

// ── rekorLeafHash + verifyInclusionProof ──────────────────────

test("rekorLeafHash produces 32-byte deterministic digest", () => {
  const body = Buffer.from("hello").toString("base64");
  const h1 = rekorLeafHash(body);
  const h2 = rekorLeafHash(body);
  assert.equal(h1.length, 32);
  assert.equal(h1.toString("hex"), h2.toString("hex"));
  // Manual check: SHA256(0x00 || "hello")
  const expected = createHash("sha256").update(Buffer.from([0x00])).update(Buffer.from("hello")).digest("hex");
  assert.equal(h1.toString("hex"), expected);
});

test("verifyInclusionProof accepts single-leaf tree with no siblings", () => {
  const body = Buffer.from("only").toString("base64");
  const leaf = rekorLeafHash(body);
  assert.ok(verifyInclusionProof({
    leafIndex: 0,
    treeSize: 1,
    hashesHex: [],
    expectedRootHex: leaf.toString("hex"),
    leafHash: leaf,
  }));
});

test("verifyInclusionProof rejects tampered root on single-leaf tree", () => {
  const leaf = rekorLeafHash(Buffer.from("only").toString("base64"));
  assert.equal(
    verifyInclusionProof({
      leafIndex: 0,
      treeSize: 1,
      hashesHex: [],
      expectedRootHex: "ff".repeat(32),
      leafHash: leaf,
    }),
    false,
  );
});

test("verifyInclusionProof accepts a 4-leaf tree happy path", () => {
  const bodies = [0, 1, 2, 3].map((i) => Buffer.from(`leaf-${i}`).toString("base64"));
  const leaves = bodies.map(rekorLeafHash);
  const hashChildren = (l, r) =>
    createHash("sha256").update(Buffer.from([0x01])).update(l).update(r).digest();
  const n01 = hashChildren(leaves[0], leaves[1]);
  const n23 = hashChildren(leaves[2], leaves[3]);
  const root = hashChildren(n01, n23);

  // Inclusion proof for leaf 0: siblings [L1, N23]
  const ok0 = verifyInclusionProof({
    leafIndex: 0,
    treeSize: 4,
    hashesHex: [leaves[1].toString("hex"), n23.toString("hex")],
    expectedRootHex: root.toString("hex"),
    leafHash: leaves[0],
  });
  assert.ok(ok0);

  // Inclusion proof for leaf 3: siblings [L2, N01]
  const ok3 = verifyInclusionProof({
    leafIndex: 3,
    treeSize: 4,
    hashesHex: [leaves[2].toString("hex"), n01.toString("hex")],
    expectedRootHex: root.toString("hex"),
    leafHash: leaves[3],
  });
  assert.ok(ok3);
});

test("verifyInclusionProof rejects wrong sibling order (right treated as left)", () => {
  const bodies = [0, 1, 2, 3].map((i) => Buffer.from(`leaf-${i}`).toString("base64"));
  const leaves = bodies.map(rekorLeafHash);
  const hashChildren = (l, r) =>
    createHash("sha256").update(Buffer.from([0x01])).update(l).update(r).digest();
  const n01 = hashChildren(leaves[0], leaves[1]);
  const n23 = hashChildren(leaves[2], leaves[3]);
  const root = hashChildren(n01, n23);

  // Feed leaf 0's proof but claim leaf 1 index → produces wrong root.
  const bad = verifyInclusionProof({
    leafIndex: 1,
    treeSize: 4,
    hashesHex: [leaves[1].toString("hex"), n23.toString("hex")],
    expectedRootHex: root.toString("hex"),
    leafHash: leaves[0],
  });
  assert.equal(bad, false);
});

// ── verifyRekorSet ────────────────────────────────────────────

function synthSet(anchor, privKey) {
  const canonical = canonicalizeJson({
    body: anchor.body,
    integratedTime: anchor.integratedTime,
    logID: anchor.logID,
    logIndex: anchor.logIndex,
  });
  const signer = createSign("sha256");
  signer.update(canonical);
  signer.end();
  return signer.sign(privKey).toString("base64");
}

test("verifyRekorSet accepts signature from the paired public key", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const anchor = {
    body: Buffer.from(JSON.stringify({ kind: "hashedrekord" })).toString("base64"),
    integratedTime: 1720656000,
    logID: "c0d23d",
    logIndex: 12345,
  };
  anchor.signedEntryTimestamp = synthSet(anchor, privateKey);
  const pubPem = publicKey.export({ format: "pem", type: "spki" });
  const r = verifyRekorSet({ anchor, rekorPubKey: pubPem });
  assert.ok(r.ok, r.reason);
});

test("verifyRekorSet rejects a signature made with a different key", () => {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const { publicKey: otherPub } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const anchor = {
    body: "abcd",
    integratedTime: 1,
    logID: "aa",
    logIndex: 2,
  };
  anchor.signedEntryTimestamp = synthSet(anchor, privateKey);
  const r = verifyRekorSet({ anchor, rekorPubKey: otherPub.export({ format: "pem", type: "spki" }) });
  assert.equal(r.ok, false);
});

test("verifyRekorSet reports missing SET clearly", () => {
  const r = verifyRekorSet({ anchor: {}, rekorPubKey: "irrelevant" });
  assert.equal(r.ok, false);
  assert.match(r.reason, /missing signedEntryTimestamp/);
});

// ── verifyRekorAnchor structural ──────────────────────────────

test("verifyRekorAnchor structural: elevates to LOG_ANCHORED_STRUCTURAL on body-hash match", () => {
  const batchRoot = "b".repeat(64);
  const { body } = buildRekorHashedrekordEntry({
    batchRootHex: batchRoot,
    signatureBase64: "AA",
    publicKeyPem: "-----BEGIN PUBLIC KEY-----\nx\n-----END PUBLIC KEY-----\n",
  });
  const anchor = { kind: "rekor", body, logIndex: 1, integratedTime: 2, logID: "z" };
  const r = verifyRekorAnchor({ anchor, expectedBatchRootHex: batchRoot });
  assert.equal(r.ok, true);
  assert.equal(r.trustLevel, TRUST_LEVELS.LOG_ANCHORED_STRUCTURAL);
});

test("verifyRekorAnchor structural: rejects body-hash mismatch", () => {
  const { body } = buildRekorHashedrekordEntry({
    batchRootHex: "c".repeat(64),
    signatureBase64: "AA",
    publicKeyPem: "-----BEGIN PUBLIC KEY-----\nx\n-----END PUBLIC KEY-----\n",
  });
  const anchor = { kind: "rekor", body };
  const r = verifyRekorAnchor({ anchor, expectedBatchRootHex: "d".repeat(64) });
  assert.equal(r.ok, false);
  assert.match(r.reason, /does not match batch_root/);
});

test("verifyRekorAnchor rejects wrong kind", () => {
  const r = verifyRekorAnchor({ anchor: { kind: "other" }, expectedBatchRootHex: "aa" });
  assert.equal(r.ok, false);
});

// ── verifyRekorAnchor full ────────────────────────────────────
//
// Full verification is the interesting path: we build a synthetic 1-leaf
// tree so the inclusion-proof math is trivial (leaf == root), sign a SET
// with an ephemeral key, and confirm the anchor elevates to LOG_ANCHORED.

function buildSyntheticFullAnchor(batchRootHex, privKey) {
  const { body } = buildRekorHashedrekordEntry({
    batchRootHex,
    signatureBase64: "AA",
    publicKeyPem: "-----BEGIN PUBLIC KEY-----\nx\n-----END PUBLIC KEY-----\n",
  });
  const leaf = rekorLeafHash(body);
  const anchor = {
    kind: "rekor",
    body,
    logIndex: 0,
    logID: "cafebabe",
    integratedTime: 1720656000,
    inclusionProof: {
      logIndex: 0,
      treeSize: 1,
      rootHash: leaf.toString("hex"),
      hashes: [],
    },
  };
  anchor.signedEntryTimestamp = synthSet(anchor, privKey);
  return anchor;
}

test("verifyRekorAnchor full: elevates to LOG_ANCHORED on inclusion + SET success", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const batchRoot = "e".repeat(64);
  const anchor = buildSyntheticFullAnchor(batchRoot, privateKey);
  const r = verifyRekorAnchor({
    anchor,
    expectedBatchRootHex: batchRoot,
    verifyFull: true,
    rekorPubKey: publicKey.export({ format: "pem", type: "spki" }),
  });
  assert.equal(r.ok, true);
  assert.equal(r.trustLevel, TRUST_LEVELS.LOG_ANCHORED);
  assert.equal(r.logIndex, 0);
});

test("verifyRekorAnchor full falls back with fullFailReason when rekorPubKey missing", () => {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const batchRoot = "1".repeat(64);
  const anchor = buildSyntheticFullAnchor(batchRoot, privateKey);
  const r = verifyRekorAnchor({
    anchor,
    expectedBatchRootHex: batchRoot,
    verifyFull: true,
  });
  assert.equal(r.trustLevel, TRUST_LEVELS.LOG_ANCHORED_STRUCTURAL);
  assert.match(r.fullFailReason, /rekorPubKey option required/);
});

test("verifyRekorAnchor full falls back when inclusion proof is corrupted", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const batchRoot = "2".repeat(64);
  const anchor = buildSyntheticFullAnchor(batchRoot, privateKey);
  anchor.inclusionProof.rootHash = "ff".repeat(32); // tamper
  const r = verifyRekorAnchor({
    anchor,
    expectedBatchRootHex: batchRoot,
    verifyFull: true,
    rekorPubKey: publicKey.export({ format: "pem", type: "spki" }),
  });
  assert.equal(r.trustLevel, TRUST_LEVELS.LOG_ANCHORED_STRUCTURAL);
  assert.match(r.fullFailReason, /inclusion proof/);
});

// ── verifyBundle wiring ───────────────────────────────────────

async function sealBundleWithRekorAnchor({ batchRootHex, anchorOverrides = {} } = {}) {
  // Build a minimal single-event bundle sealed with a fresh Ed25519 key.
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const s = createSession({
    agent: { name: "test", version: "0.0.0" },
    models: [{ model_id: "test:m", provider: "test" }],
    environmentFingerprint: { os: "test", node_version: "test" },
    keyId: "test",
    privateKey,
  });
  appendEvent(s, { event_type: "user_message", actor: "user", payload: {} });
  const bundle = sealSession(s);
  const actualBatchRoot = batchRootHex ?? bundle.batch_root;

  const { body } = buildRekorHashedrekordEntry({
    batchRootHex: actualBatchRoot,
    signatureBase64: "AA",
    publicKeyPem: "-----BEGIN PUBLIC KEY-----\nx\n-----END PUBLIC KEY-----\n",
  });
  const anchor = {
    kind: "rekor",
    body,
    logIndex: 0,
    logID: "beefdead",
    integratedTime: 1720656000,
    ...anchorOverrides,
  };
  bundle.external_anchors = [anchor];
  const pubPem = publicKey.export({ format: "pem", type: "spki" });
  return { bundle, publicKeyPem: pubPem };
}

test("verifyBundle checkAnchors:'structural' elevates to LOG_ANCHORED_STRUCTURAL for a rekor anchor", async () => {
  const { bundle, publicKeyPem } = await sealBundleWithRekorAnchor();
  const r = verifyBundle(bundle, { publicKey: publicKeyPem, checkAnchors: "structural" });
  assert.equal(r.ok, true);
  assert.equal(r.trustLevel, TRUST_LEVELS.LOG_ANCHORED_STRUCTURAL);
  assert.equal(r.anchors.length, 1);
  assert.equal(r.anchors[0].kind, "rekor");
});

test("verifyBundle checkAnchors:'full' elevates to LOG_ANCHORED with synth SET + inclusion", async () => {
  const { privateKey: rekorPriv, publicKey: rekorPub } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const { bundle, publicKeyPem } = await sealBundleWithRekorAnchor();
  // Reshape the anchor with a synthetic single-leaf tree + valid SET.
  const anchor = bundle.external_anchors[0];
  const leaf = rekorLeafHash(anchor.body);
  anchor.inclusionProof = {
    logIndex: 0,
    treeSize: 1,
    rootHash: leaf.toString("hex"),
    hashes: [],
  };
  anchor.signedEntryTimestamp = synthSet(anchor, rekorPriv);
  const r = verifyBundle(bundle, {
    publicKey: publicKeyPem,
    checkAnchors: "full",
    rekorPubKey: rekorPub.export({ format: "pem", type: "spki" }),
  });
  assert.equal(r.ok, true);
  assert.equal(r.trustLevel, TRUST_LEVELS.LOG_ANCHORED);
});

test("trustLevelRank orders SELF < TIME_STRUCTURAL < LOG_STRUCTURAL < TIME_ANCHORED < LOG_ANCHORED", () => {
  const order = [
    TRUST_LEVELS.SELF_SIGNED,
    TRUST_LEVELS.TIME_ANCHORED_STRUCTURAL,
    TRUST_LEVELS.LOG_ANCHORED_STRUCTURAL,
    TRUST_LEVELS.TIME_ANCHORED,
    TRUST_LEVELS.LOG_ANCHORED,
  ];
  for (let i = 1; i < order.length; i++) {
    assert.ok(trustLevelRank(order[i]) > trustLevelRank(order[i - 1]),
      `${order[i]} should outrank ${order[i - 1]}`);
  }
});

// ── Live Rekor smoke test (opt-in) ────────────────────────────

test("live rekor.sigstore.dev round-trip (SHADOW_TEST_LIVE_REKOR=1)", { skip: !process.env.SHADOW_TEST_LIVE_REKOR }, async () => {
  const { generateKeyPairSync: gk, sign: rawSign } = await import("node:crypto");
  const { privateKey, publicKey } = gk("ed25519");
  const batchRootHex = createHash("sha256").update("shadow-sprint3-smoke").digest("hex");
  const sig = rawSign(null, Buffer.from(batchRootHex, "hex"), privateKey).toString("base64");
  const { submitRekorEntry } = await import("../packages/attest-core/anchors.js");
  const anchor = await submitRekorEntry({
    batchRootHex,
    signatureBase64: sig,
    publicKeyPem: publicKey.export({ format: "pem", type: "spki" }),
  });
  assert.equal(anchor.kind, "rekor");
  assert.ok(anchor.uuid, "expected uuid");
  const structural = verifyRekorAnchor({ anchor, expectedBatchRootHex: batchRootHex });
  assert.equal(structural.trustLevel, TRUST_LEVELS.LOG_ANCHORED_STRUCTURAL);
});
