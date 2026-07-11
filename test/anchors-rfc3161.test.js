// test/anchors-rfc3161.test.js
// v3 M3 sprint 1 — contract tests for RFC 3161 anchor primitives.
//
// Unit tests use synthesized DER byte-strings and never hit the network.
// The live-TSA smoke test at the bottom is skipped unless the env var
// SHADOW_TEST_LIVE_TSA is set — CI stays hermetic by default; a developer
// or release runner can flip the flag on to prove the real freetsa.org
// path works end-to-end.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";

import {
  TRUST_LEVELS,
  buildTimestampRequest,
  parseTimestampResponse,
  requestTimestamp,
  verifyRfc3161Anchor,
} from "../packages/attest-core/anchors.js";
import {
  appendEvent,
  createSession,
  sealSession,
  verifyBundle,
} from "../packages/attest-core/session.js";

// ── Deterministic RFC 3161 response synth ─────────────────────
//
// Build a minimal TimeStampResp DER byte-string that our parser can
// walk. Not a signed TSR (no CMS SignedData signature) — just enough
// structure that parseTimestampResponse() finds messageImprint + genTime.

function derLen(n) {
  if (n < 128) return Buffer.from([n]);
  const bytes = [];
  let x = n;
  while (x > 0) { bytes.unshift(x & 0xff); x >>>= 8; }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}
function tlv(tag, payload) {
  const p = Buffer.from(payload);
  return Buffer.concat([Buffer.from([tag]), derLen(p.length), p]);
}
function intBytes(n) {
  const bs = [];
  if (n === 0) bs.push(0);
  else {
    let x = n;
    while (x > 0) { bs.unshift(x & 0xff); x = Math.floor(x / 256); }
    if (bs[0] & 0x80) bs.unshift(0);
  }
  return Buffer.from(bs);
}
function oidBytes(oid) {
  const parts = oid.split(".").map(Number);
  const bs = [40 * parts[0] + parts[1]];
  for (let i = 2; i < parts.length; i++) {
    let v = parts[i];
    const chunk = [];
    do { chunk.unshift(v & 0x7f); v >>>= 7; } while (v > 0);
    for (let j = 0; j < chunk.length - 1; j++) chunk[j] |= 0x80;
    bs.push(...chunk);
  }
  return Buffer.from(bs);
}

const OID_SHA256 = "2.16.840.1.101.3.4.2.1";
const OID_SIGNED_DATA = "1.2.840.113549.1.7.2";
const OID_TSTINFO = "1.2.840.113549.1.9.16.1.4";

function synthesizeTimeStampResp({ messageImprintHex, genTimeString }) {
  const digest = Buffer.from(messageImprintHex, "hex");

  const messageImprint = tlv(0x30, Buffer.concat([
    tlv(0x30, Buffer.concat([tlv(0x06, oidBytes(OID_SHA256)), Buffer.from([0x05, 0x00])])),
    tlv(0x04, digest),
  ]));

  const tstInfo = tlv(0x30, Buffer.concat([
    tlv(0x02, intBytes(1)),                                  // version
    tlv(0x06, oidBytes("1.2.3.4.5")),                        // policy (dummy)
    messageImprint,
    tlv(0x02, intBytes(1)),                                  // serialNumber
    tlv(0x18, Buffer.from(genTimeString, "utf8")),           // genTime
  ]));

  // encapContentInfo: SEQUENCE { eContentType OID, eContent [0] EXPLICIT OCTET STRING }
  const encap = tlv(0x30, Buffer.concat([
    tlv(0x06, oidBytes(OID_TSTINFO)),
    tlv(0xa0, tlv(0x04, tstInfo)),
  ]));

  // SignedData: SEQUENCE { version INTEGER, digestAlgorithms SET,
  //   encapContentInfo SEQUENCE, ... } — we omit the signer info tail.
  const signedData = tlv(0x30, Buffer.concat([
    tlv(0x02, intBytes(3)),  // CMS version
    tlv(0x31, Buffer.from([])),
    encap,
  ]));

  // ContentInfo: SEQUENCE { contentType OID, content [0] EXPLICIT signedData }
  const contentInfo = tlv(0x30, Buffer.concat([
    tlv(0x06, oidBytes(OID_SIGNED_DATA)),
    tlv(0xa0, signedData),
  ]));

  // Top-level TimeStampResp SEQUENCE { PKIStatusInfo, timeStampToken }.
  const pkiStatus = tlv(0x30, tlv(0x02, intBytes(0)));  // status = granted
  return tlv(0x30, Buffer.concat([pkiStatus, contentInfo]));
}


test("TRUST_LEVELS enum is frozen with 4 members", () => {
  assert.equal(TRUST_LEVELS.SELF_SIGNED, "SELF_SIGNED");
  assert.equal(TRUST_LEVELS.TIME_ANCHORED_STRUCTURAL, "TIME_ANCHORED_STRUCTURAL");
  assert.equal(TRUST_LEVELS.TIME_ANCHORED, "TIME_ANCHORED");
  assert.equal(TRUST_LEVELS.LOG_ANCHORED, "LOG_ANCHORED");
  assert.ok(Object.isFrozen(TRUST_LEVELS));
});


test("buildTimestampRequest emits a DER SEQUENCE with the sha256 messageImprint", () => {
  const digestHex = "aa".repeat(32);
  const req = buildTimestampRequest({ digestHex });
  assert.equal(req[0], 0x30, "outer SEQUENCE");
  // Confirm the sha256 OID bytes appear (round-trip through our parser via
  // parseTimestampResponse is not applicable here; we just check the digest).
  assert.ok(req.includes(Buffer.from(digestHex, "hex")[0]));
  assert.ok(req.length > 32);
});


test("buildTimestampRequest rejects wrong-size digest", () => {
  assert.throws(
    () => buildTimestampRequest({ digestHex: "aa" }),
    /digest is/,
  );
});


test("parseTimestampResponse walks synthetic TSR + extracts messageImprint + genTime", () => {
  const digestHex = "bb".repeat(32);
  const resp = synthesizeTimeStampResp({
    messageImprintHex: digestHex,
    genTimeString: "20260710123456Z",
  });
  const parsed = parseTimestampResponse(resp);
  assert.equal(parsed.status.statusCode, 0);
  assert.ok(parsed.tstInfo);
  assert.equal(parsed.tstInfo.messageImprintAlgorithm, "sha256");
  assert.equal(parsed.tstInfo.messageImprintHash.toString("hex"), digestHex);
  assert.equal(parsed.tstInfo.genTimeIso, "2026-07-10T12:34:56Z");
});


test("verifyRfc3161Anchor accepts a matching messageImprint", () => {
  const batchRootHex = "cc".repeat(32);
  const imprint = createHash("sha256").update(Buffer.from(batchRootHex, "hex")).digest("hex");
  const respBytes = synthesizeTimeStampResp({
    messageImprintHex: imprint,
    genTimeString: "20260710120000Z",
  });
  const anchor = {
    kind: "rfc3161-tsa",
    batch_root: batchRootHex,
    anchor_ref: respBytes.toString("base64url"),
    anchored_at_utc: "2026-07-10T12:00:00Z",
  };
  const result = verifyRfc3161Anchor({ anchor, expectedBatchRootHex: batchRootHex });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.trustLevel, TRUST_LEVELS.TIME_ANCHORED_STRUCTURAL);
  assert.equal(result.genTimeIso, "2026-07-10T12:00:00Z");
});


test("verifyRfc3161Anchor rejects a mismatched messageImprint", () => {
  const batchRootHex = "cc".repeat(32);
  const otherHash = "dd".repeat(32);
  const respBytes = synthesizeTimeStampResp({
    messageImprintHex: otherHash,
    genTimeString: "20260710120000Z",
  });
  const anchor = {
    kind: "rfc3161-tsa",
    batch_root: batchRootHex,
    anchor_ref: respBytes.toString("base64url"),
    anchored_at_utc: "2026-07-10T12:00:00Z",
  };
  const result = verifyRfc3161Anchor({ anchor, expectedBatchRootHex: batchRootHex });
  assert.equal(result.ok, false);
  assert.match(result.reason, /messageImprint does not match/);
});


test("verifyRfc3161Anchor rejects wrong anchor kind", () => {
  const result = verifyRfc3161Anchor({
    anchor: { kind: "sigstore-rekor" },
    expectedBatchRootHex: "aa".repeat(32),
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /wrong kind/);
});


test("verifyRfc3161Anchor rejects mismatched batch_root claim in the anchor", () => {
  const result = verifyRfc3161Anchor({
    anchor: {
      kind: "rfc3161-tsa",
      batch_root: "aa".repeat(32),
      anchor_ref: "AAAA",
    },
    expectedBatchRootHex: "bb".repeat(32),
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /batch_root does not match/);
});


test("verifyBundle without checkAnchors defaults to SELF_SIGNED", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const s = createSession({
    agent: { name: "test", version: "1.0" },
    models: [{ model_id: "test:m", provider: "test" }],
    environmentFingerprint: { os: "test", node_version: "test" },
    keyId: "test",
    privateKey,
  });
  appendEvent(s, { event_type: "user_message", actor: "user", payload: {} });
  const bundle = sealSession(s);
  const result = verifyBundle(bundle, { publicKey });
  assert.equal(result.ok, true);
  assert.equal(result.trustLevel, TRUST_LEVELS.SELF_SIGNED);
});


test("verifyBundle with checkAnchors elevates to TIME_ANCHORED_STRUCTURAL when an RFC 3161 anchor matches", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const s = createSession({
    agent: { name: "test", version: "1.0" },
    models: [{ model_id: "test:m", provider: "test" }],
    environmentFingerprint: { os: "test", node_version: "test" },
    keyId: "test",
    privateKey,
  });
  appendEvent(s, { event_type: "user_message", actor: "user", payload: {} });
  const bundle = sealSession(s);

  const imprint = createHash("sha256").update(Buffer.from(bundle.batch_root, "hex")).digest("hex");
  const respBytes = synthesizeTimeStampResp({
    messageImprintHex: imprint,
    genTimeString: "20260710120000Z",
  });
  bundle.external_anchors = [{
    kind: "rfc3161-tsa",
    batch_root: bundle.batch_root,
    anchor_ref: respBytes.toString("base64url"),
    anchored_at_utc: "2026-07-10T12:00:00Z",
  }];

  const result = verifyBundle(bundle, { publicKey, checkAnchors: true });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.trustLevel, TRUST_LEVELS.TIME_ANCHORED_STRUCTURAL);
  assert.equal(result.anchors.length, 1);
  assert.equal(result.anchors[0].ok, true);
});


test("verifyBundle with checkAnchors reports SELF_SIGNED when no anchor verifies", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const s = createSession({
    agent: { name: "test", version: "1.0" },
    models: [{ model_id: "test:m", provider: "test" }],
    environmentFingerprint: { os: "test", node_version: "test" },
    keyId: "test",
    privateKey,
  });
  appendEvent(s, { event_type: "user_message", actor: "user", payload: {} });
  const bundle = sealSession(s);

  bundle.external_anchors = [{
    kind: "sigstore-rekor",  // not yet supported in sprint 1
    batch_root: bundle.batch_root,
    anchor_ref: "placeholder",
  }];

  const result = verifyBundle(bundle, { publicKey, checkAnchors: true });
  assert.equal(result.ok, true);
  assert.equal(result.trustLevel, TRUST_LEVELS.SELF_SIGNED);
  assert.equal(result.anchors[0].ok, false);
  assert.match(result.anchors[0].reason, /not yet supported/);
});


// ── Live TSA smoke test — env-gated to keep CI hermetic ─────
//
// Set SHADOW_TEST_LIVE_TSA=1 to run. The test asserts that a real
// freetsa.org TSA response round-trips through our parser + verifier.

test(
  "requestTimestamp against freetsa.org produces a verifiable anchor (live)",
  { skip: !process.env.SHADOW_TEST_LIVE_TSA },
  async () => {
    const batchRootHex = "e3".repeat(32);
    const anchor = await requestTimestamp({
      batchRootHex,
      tsaUrl: "https://freetsa.org/tsr",
      timeoutMs: 20000,
    });
    assert.equal(anchor.kind, "rfc3161-tsa");
    assert.equal(anchor.batch_root, batchRootHex);
    assert.ok(anchor.anchor_ref.length > 100);
    assert.match(anchor.anchored_at_utc, /^\d{4}-\d{2}-\d{2}T/);

    const verify = verifyRfc3161Anchor({ anchor, expectedBatchRootHex: batchRootHex });
    assert.equal(verify.ok, true, verify.reason);
    assert.equal(verify.trustLevel, TRUST_LEVELS.TIME_ANCHORED_STRUCTURAL);
  },
);
