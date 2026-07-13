// test/truncation-attack.test.js
//
// P0 · S1 · per docs/SHADOW_SECURITY_STANDARDS_BRIEF (2026-07-13).
//
// The known weakness: with plaintext events + tags, an attacker deletes
// events from the tail of the chain; the surviving prefix and its tags
// remain internally consistent, so a naive verifier returns green. The
// malicious activity was in the deleted tail.
//
// Shadow's current defense is `batch_root` — a Merkle root over the
// concatenated per-event hashes. If ANY event is removed, `batch_root`
// recomputes to a different value than the signed one. Below we
// exercise three truncation shapes and assert `verifyBundle` says NO.
//
// If any of these variants returns ok:true, that's a REAL BUG per
// brief §S1: stop and report, do NOT ship a rushed schema change 48h
// before Wed demo. Instead mark the specific assertion .skip with
// TODO(security): count-binding and file the finding.

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

function buildBundle(privatePem, eventCount = 10) {
  const s = createSession({
    agent: { name: "trunc-test", version: "1.0" },
    models: [{ model_id: "test:m", provider: "test" }],
    environmentFingerprint: { os: "test", node_version: "test" },
    keyId: "trunc",
    privateKey: privatePem,
  });
  for (let i = 0; i < eventCount; i++) {
    appendEvent(s, {
      event_type: "tool_call",
      actor: "agent",
      payload: { iter: i, tool: "Read" },
    });
  }
  return sealSession(s);
}


// ── Attack A · tail truncation ──────────────────────────────
// Chop the last K events. The batch_root recompute won't match the
// signed one; verifyBundle must return ok:false.

test("S1.A · truncating last event fails verify", () => {
  const { privatePem, publicPem } = freshKeypair();
  const bundle = buildBundle(privatePem, 10);
  const preCount = bundle.events.length;

  const attacker = JSON.parse(JSON.stringify(bundle));
  attacker.events.pop(); // remove last event
  assert.equal(attacker.events.length, preCount - 1);

  const r = verifyBundle(attacker, { publicKey: publicPem });
  assert.equal(r.ok, false,
    "REAL BUG if this is green: tail truncation slipped past verify. " +
    "Follow brief §S1 discipline: DO NOT rush schema change before Wed.");
  assert.ok(["batch_root_mismatch", "prev_hash_mismatch", "seq_gap"].includes(r.error?.reason),
    `expected structural failure code, got: ${r.error?.reason}`);
});

test("S1.A · truncating last 3 events fails verify", () => {
  const { privatePem, publicPem } = freshKeypair();
  const bundle = buildBundle(privatePem, 10);

  const attacker = JSON.parse(JSON.stringify(bundle));
  attacker.events.splice(-3, 3);

  const r = verifyBundle(attacker, { publicKey: publicPem });
  assert.equal(r.ok, false,
    "REAL BUG if green: 3-event tail truncation must be caught");
  // 3 events chopped → batch_root will be different since fewer event
  // hashes concatenated. Expect batch_root_mismatch or signature fail.
  assert.ok(
    r.error?.reason === "batch_root_mismatch" ||
    r.error?.reason === "signature_verification_failed",
    `expected batch_root_mismatch or signature_verification_failed, got: ${r.error?.reason}`,
  );
});

test("S1.A · truncating half the events fails verify", () => {
  const { privatePem, publicPem } = freshKeypair();
  const bundle = buildBundle(privatePem, 20);

  const attacker = JSON.parse(JSON.stringify(bundle));
  attacker.events.splice(10);  // keep first 10, drop last 10

  const r = verifyBundle(attacker, { publicKey: publicPem });
  assert.equal(r.ok, false, "REAL BUG if green: half-truncation must fail");
});


// ── Attack B · mid-chain truncation ─────────────────────────
// Delete some events in the middle. prev_hash pointers on the surviving
// downstream events will now be dangling — must be caught with a
// precise seq indicating where the break was detected.

test("S1.B · deleting middle event fails with prev_hash_mismatch", () => {
  const { privatePem, publicPem } = freshKeypair();
  const bundle = buildBundle(privatePem, 8);

  const attacker = JSON.parse(JSON.stringify(bundle));
  // Delete event at index 3. Downstream events (which still have their
  // original prev_hash) now dangle because expectedPrev at index 3
  // will be the own-hash of event 2, but attacker.events[3] (which was
  // originally event 4) has prev_hash equal to the own-hash of
  // event 3 (which is now missing).
  attacker.events.splice(3, 1);
  // Update seq indices to be dense so we hit prev_hash_mismatch instead
  // of seq_gap — this mimics an attacker trying to hide the deletion.
  for (let i = 0; i < attacker.events.length; i++) {
    attacker.events[i].seq = i;
  }

  const r = verifyBundle(attacker, { publicKey: publicPem });
  assert.equal(r.ok, false,
    "REAL BUG if green: mid-chain deletion must be caught");
  assert.equal(r.error?.reason, "prev_hash_mismatch",
    `expected prev_hash_mismatch (chain break), got: ${r.error?.reason}`);
  // The break is detected at the first surviving downstream event.
  // After deleting original index 3 and reindexing, the new index 3
  // (originally index 4) is where the chain breaks.
  assert.equal(r.error?.seq, 3,
    `expected chain break detected at seq 3, got: ${r.error?.seq}`);
});

test("S1.B · deleting middle event without reindex fails with seq_gap", () => {
  const { privatePem, publicPem } = freshKeypair();
  const bundle = buildBundle(privatePem, 8);

  const attacker = JSON.parse(JSON.stringify(bundle));
  attacker.events.splice(3, 1);
  // Do NOT reindex seq — this is a lazier attacker.

  const r = verifyBundle(attacker, { publicKey: publicPem });
  assert.equal(r.ok, false, "REAL BUG if green");
  assert.equal(r.error?.reason, "seq_gap");
  assert.equal(r.error?.seq, 3, "seq_gap detected exactly at the hole");
});


// ── Attack C · empty-tail edge ──────────────────────────────
// Truncate to zero events after session_start.

test("S1.C · truncating to zero events fails gracefully (no crash)", () => {
  const { privatePem, publicPem } = freshKeypair();
  const bundle = buildBundle(privatePem, 5);

  const attacker = JSON.parse(JSON.stringify(bundle));
  attacker.events = [];

  let r;
  try {
    r = verifyBundle(attacker, { publicKey: publicPem });
  } catch (err) {
    assert.fail(`REAL BUG: crash on zero-event bundle: ${err.message}`);
  }
  assert.equal(r.ok, false,
    "REAL BUG if green: an empty event array must not verify");
  // batch_root of 0 concatenated hashes = sha256("") ≠ signed batch_root.
  assert.equal(r.error?.reason, "batch_root_mismatch",
    `expected batch_root_mismatch on empty events, got: ${r.error?.reason}`);
});


// ── Attack D · resigning after truncation (equivocation prep) ────
// Attacker with the private key could theoretically resign a truncated
// bundle. This test shows that WITHOUT the private key, the attacker's
// forged signature fails against the legitimate public key. This is
// what makes SELF_SIGNED at least survive an outsider attack.

test("S1.D · resigning with WRONG key fails verify (outsider defense)", () => {
  const { privatePem, publicPem } = freshKeypair();
  const bundle = buildBundle(privatePem, 8);

  // Attacker generates their OWN keypair and re-signs after truncation.
  const attacker = JSON.parse(JSON.stringify(bundle));
  attacker.events.splice(-2, 2);
  // Simulate the attacker computing a new batch_root over surviving
  // events + signing with THEIR key. In practice they'd have to also
  // update batch_root in the bundle; we simulate that by re-sealing
  // via a fresh session that uses attacker's key... but the verifier
  // will still be handed the original public key.
  const { privateKey: pk2 } = generateKeyPairSync("ed25519");
  const s2 = createSession({
    agent: { name: "trunc-test", version: "1.0" },
    models: [{ model_id: "test:m", provider: "test" }],
    environmentFingerprint: { os: "test", node_version: "test" },
    keyId: "trunc",
    privateKey: pk2.export({ type: "pkcs8", format: "pem" }),
  });
  for (let i = 0; i < 6; i++) {
    appendEvent(s2, { event_type: "tool_call", actor: "agent", payload: { iter: i, tool: "Read" } });
  }
  const attackerBundle = sealSession(s2);

  // Give the verifier the ORIGINAL public key.
  const r = verifyBundle(attackerBundle, { publicKey: publicPem });
  assert.equal(r.ok, false,
    "REAL BUG if green: attacker-re-signed bundle must not verify against legitimate key");
  assert.equal(r.error?.reason, "signature_verification_failed");
});
