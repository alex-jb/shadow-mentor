// test/replay-attack.test.js
//
// P0 · S3 · per docs/SHADOW_SECURITY_STANDARDS_BRIEF (2026-07-13).
//
// The known weakness: an attacker who obtained a valid old bundle
// (e.g. an "approve" verdict from three months ago) reuses it to
// impersonate a NEW decision today. The bundle is byte-for-byte
// valid, signature verifies, chain is intact. The system says green.
// The actual reality is stale.
//
// Shadow's `verifyBundle()` ALONE cannot detect replay — it is a
// pure function over bundle bytes. Replay is a distributed-systems
// property: two independent parties must not be able to submit the
// same signed evidence as two independent events.
//
// Shadow's defense-in-depth against replay:
//   1. Every session has a unique `session_id` (32-byte cryptographic
//      random). Callers MUST track seen session_ids and reject
//      duplicates. This is application-layer, not verifier-layer.
//   2. Every session carries `session_started_at_utc`. Callers MUST
//      compare against wall-clock and reject bundles older than a
//      caller-defined freshness window (e.g. 24 hours for loan
//      decisions, 1 hour for AML/KYC).
//   3. Both fields are part of the signed body, so an attacker who
//      tries to rewrite them breaks Ed25519 signature verification.
//
// Below we exercise the three replay shapes and assert:
//   (a) same bundle presented twice — verifyBundle returns ok:true both
//       times (this is CORRECT — the bundle IS valid). Deduplication
//       is caller's responsibility via session_id.
//   (b) attacker rewrites session_started_at_utc to look fresh — signature
//       must break.
//   (c) attacker rewrites session_id to a new value — signature must break.
//
// If any assertion below fails, that's a REAL BUG per brief §S3.
// Do NOT rush a fix pre-Wed demo. Mark .skip + TODO(security):
// replay-detection and file the finding.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import {
  createSession,
  appendEvent,
  sealSession,
  verifyBundle,
} from "../packages/attest-core/session.js";

function freshKeypair() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privatePem: privateKey.export({ type: "pkcs8", format: "pem" }),
    publicPem: publicKey.export({ type: "spki", format: "pem" }),
  };
}

function buildBundle(privatePem, opts = {}) {
  const s = createSession({
    agent: { name: "replay-test", version: "1.0" },
    models: [{ model_id: "test:m", provider: "test" }],
    environmentFingerprint: { os: "test", node_version: "test" },
    keyId: "replay",
    privateKey: privatePem,
    ...(opts.sessionId ? { sessionId: opts.sessionId } : {}),
    ...(opts.startedAtUtc ? { startedAtUtc: opts.startedAtUtc } : {}),
  });
  for (let i = 0; i < 5; i++) {
    appendEvent(s, {
      event_type: "tool_call",
      actor: "agent",
      payload: { iter: i, tool: "Read" },
    });
  }
  return sealSession(s);
}


// ── Attack A · replay same bundle twice ─────────────────────
// Byte-for-byte reuse. Verifier says OK both times. This is CORRECT
// behavior — the bundle IS valid. The application layer must dedupe
// by session_id.

test("S3.A · same bundle verifies twice (verifier cannot detect replay alone)", () => {
  const { privatePem, publicPem } = freshKeypair();
  const bundle = buildBundle(privatePem);

  const r1 = verifyBundle(bundle, { publicKey: publicPem });
  const r2 = verifyBundle(bundle, { publicKey: publicPem });

  assert.equal(r1.ok, true, "first presentation must verify");
  assert.equal(r2.ok, true, "second presentation must verify (bundle IS valid)");
  // verifyBundle does not return session_id; callers dedupe from bundle.header.session_id.
  assert.ok(bundle.header.session_id, "session_id must be present in header for caller-side dedup");
});

test("S3.A · caller-side dedup by session_id catches replay", () => {
  const { privatePem, publicPem } = freshKeypair();
  const bundleA = buildBundle(privatePem);
  const bundleB = buildBundle(privatePem);  // fresh session, different session_id

  assert.notEqual(bundleA.header.session_id, bundleB.header.session_id,
    "two independently-created sessions must have distinct session_ids");

  const r1 = verifyBundle(bundleA, { publicKey: publicPem });
  const r2 = verifyBundle(bundleA, { publicKey: publicPem });  // REPLAY
  const r3 = verifyBundle(bundleB, { publicKey: publicPem });  // new legit bundle

  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal(r3.ok, true);

  // Application-layer dedup pattern (documented for callers):
  const seenSessionIds = new Set();
  function acceptBundle(bundle, verifyResult) {
    if (!verifyResult.ok) return false;
    const sid = bundle.header.session_id;
    if (seenSessionIds.has(sid)) return false;
    seenSessionIds.add(sid);
    return true;
  }
  assert.equal(acceptBundle(bundleA, r1), true, "first bundle accepted");
  assert.equal(acceptBundle(bundleA, r2), false, "REPLAY REJECTED at caller layer via session_id set");
  assert.equal(acceptBundle(bundleB, r3), true, "legit fresh bundle accepted");
});


// ── Attack B · rewrite session_started_at_utc to look fresh ─
// Attacker takes an old valid bundle from three months ago and
// rewrites the timestamp to "now". Ed25519 signature must break
// because session_started_at_utc is part of the signed body.

test("S3.B · rewriting session_started_at_utc breaks signature", () => {
  const { privatePem, publicPem } = freshKeypair();
  // Create a bundle backdated three months ago.
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const oldBundle = buildBundle(privatePem, {
    startedAtUtc: threeMonthsAgo.toISOString(),
  });

  // Attacker rewrites timestamp to look like NOW.
  const attacker = JSON.parse(JSON.stringify(oldBundle));
  attacker.header.session_started_at_utc = new Date().toISOString();

  const r = verifyBundle(attacker, { publicKey: publicPem });
  assert.equal(r.ok, false,
    "REAL BUG if this is green: timestamp rewrite slipped past integrity check. " +
    "session_started_at_utc must be inside the signed body OR chain seed.");
  // Shadow has two independent defenses. Timestamp rewrite may fail at either.
  assert.ok(
    ["signature_verification_failed", "prev_hash_mismatch", "batch_root_mismatch"]
      .includes(r.error?.reason),
    `expected one of {signature_verification_failed, prev_hash_mismatch, batch_root_mismatch}, got: ${r.error?.reason}`,
  );
});


// ── Attack C · rewrite session_id to a new value ────────────
// Attacker takes an old valid bundle and rewrites session_id to a
// fresh random hex to evade caller-side dedup. Signature must break.

test("S3.C · rewriting session_id breaks signature", () => {
  const { privatePem, publicPem } = freshKeypair();
  const legitBundle = buildBundle(privatePem, { sessionId: "aa".repeat(32) });

  const attacker = JSON.parse(JSON.stringify(legitBundle));
  attacker.header.session_id = "bb".repeat(32);

  const r = verifyBundle(attacker, { publicKey: publicPem });
  assert.equal(r.ok, false,
    "REAL BUG if green: session_id rewrite slipped past integrity check. " +
    "session_id must be inside the signed body OR chain seed to prevent dedup evasion.");
  // session_id is used to seed the hash chain (see packages/attest-core/session.js
  // "Chain-seed hash" comment). Rewriting it breaks chain integrity BEFORE the
  // signature check ever runs. This is defense-in-depth: two independent
  // guarantees. Either failure mode is acceptable.
  assert.ok(
    ["signature_verification_failed", "prev_hash_mismatch", "batch_root_mismatch"]
      .includes(r.error?.reason),
    `expected one of {signature_verification_failed, prev_hash_mismatch, batch_root_mismatch}, got: ${r.error?.reason}`,
  );
});


// ── Freshness-window documentation ──────────────────────────
// verifyBundle does NOT enforce a freshness window because different
// verticals require different windows (loan decisions: 24 hours;
// AML/KYC: 1 hour; incident-response: 15 minutes). Callers implement
// their own maxAge check on session_started_at_utc.

test("S3 · verifyBundle exposes session_started_at_utc so callers can enforce freshness", () => {
  const { privatePem, publicPem } = freshKeypair();
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const oldBundle = buildBundle(privatePem, {
    startedAtUtc: twoDaysAgo.toISOString(),
  });

  const r = verifyBundle(oldBundle, { publicKey: publicPem });
  assert.equal(r.ok, true, "bundle is still cryptographically valid regardless of age");

  // Caller-side freshness gate pattern:
  const MAX_AGE_MS = 24 * 60 * 60 * 1000;  // loan decision: 24-hour window
  const bundleAge =
    Date.now() - new Date(oldBundle.header.session_started_at_utc).getTime();

  assert.ok(bundleAge > MAX_AGE_MS,
    "two-day-old bundle should be over the 24-hour freshness threshold");

  // What the caller MUST do:
  const accept = bundleAge <= MAX_AGE_MS;
  assert.equal(accept, false,
    "STALE REJECTED at caller layer: bundle age exceeds business freshness window");
});
