// Tests for the adverse-action wedge (lib/adverse-action-review.js): the one
// function CLI + API both call. Locks the load-bearing product invariants:
//   1. a denied application yields §1002.9(b)(2) reason codes + a signed bundle;
//   2. that bundle INDEPENDENTLY verifies with the returned public key;
//   3. a real tamper (payload_hash / truncate / wrong key) makes it FAIL;
//   4. an approved application produces no adverse-action notice.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { reviewAdverseAction } from "../lib/adverse-action-review.js";
import { verifyBundle } from "shadow-attest-core/session";

const DENIED = Object.freeze({
  application_id: "SL-2026-014",
  credit_score: 648, debt_to_income: 0.45, loan_to_value: 0.90,
  notice_language: "en",
  market_proxy_prices: [100, 101, 99, 102, 98, 103, 97, 104, 96, 105, 95, 106],
  collateral_positions: [],
  borrower_exposure_weights: { obligor_a: 0.5, obligor_b: 0.5 },
});
const APPROVED = Object.freeze({
  application_id: "SL-2026-021",
  credit_score: 742, debt_to_income: 0.28, loan_to_value: 0.71,
  market_proxy_prices: [100, 100.2, 99.9, 100.1, 100, 99.95, 100.05, 100, 99.9, 100.1, 100, 100.05],
  collateral_positions: [],
  borrower_exposure_weights: { obligor_a: 0.5, obligor_b: 0.5 },
});

test("a denied application yields a block verdict + AA reason codes + notices", () => {
  const r = reviewAdverseAction(DENIED);
  assert.equal(r.approved, false);
  assert.equal(r.verdict, "block");
  assert.ok(r.adverseActionCodes.length >= 1, "expected at least one adverse-action code");
  assert.ok(r.notices.length >= 1, "expected at least one drafted notice");
  // every notice must be grounded (no bare error) and carry the ECOA rights language
  for (const n of r.notices) {
    assert.ok(!n.error, `notice ${n.code} failed to draft: ${n.error}`);
    const txt = typeof n.notice === "string" ? n.notice : (n.notice.text || JSON.stringify(n.notice));
    assert.match(txt, /Equal Credit Opportunity Act/i, `${n.code} notice missing ECOA rights block`);
  }
});

test("the produced bundle INDEPENDENTLY verifies with the returned public key", () => {
  const r = reviewAdverseAction(DENIED);
  assert.equal(r.verify, "verified", `self-check: ${r.verify}`);
  const v = verifyBundle(r.bundle, { publicKey: r.publicKeyPem });
  assert.equal(v.ok, true, `independent verify failed: ${v.reason}`);
});

test("editing a sealed payload_hash makes the bundle FAIL (tamper caught)", () => {
  const r = reviewAdverseAction(DENIED);
  const tampered = JSON.parse(JSON.stringify(r.bundle));
  tampered.events[1].payload_hash = "0".repeat(64);
  assert.equal(verifyBundle(tampered, { publicKey: r.publicKeyPem }).ok, false);
});

// B1 — the whole product thesis. Previously UNDETECTABLE: the plaintext wasn't in
// the bundle, so flipping the displayed verdict left verification GREEN. Now the
// payload is embedded + rebound to its signed hash, so this must FAIL.
test("editing the sealed PLAINTEXT verdict (hash left intact) makes the bundle FAIL", () => {
  const r = reviewAdverseAction(DENIED);
  const tampered = JSON.parse(JSON.stringify(r.bundle));
  const ev = tampered.events.find((e) => e.payload && e.payload.kind === "council_verdict");
  assert.ok(ev, "council_verdict payload must be embedded in the bundle");
  assert.equal(ev.payload.final_verdict, "block");
  ev.payload.final_verdict = "approve"; // flip BLOCK→APPROVE, leave payload_hash intact
  const v = verifyBundle(tampered, { publicKey: r.publicKeyPem });
  assert.equal(v.ok, false, "a plaintext edit that leaves the hash intact must FAIL");
  assert.equal(v.reason, "payload_hash_mismatch");
});

test("the wedge bundle is self-contained — verify reports source_resolution VERIFIED", () => {
  const r = reviewAdverseAction(DENIED);
  const v = verifyBundle(r.bundle, { publicKey: r.publicKeyPem });
  assert.equal(v.ok, true);
  assert.equal(v.sourceResolution, "VERIFIED", "every event's plaintext must rebind to its hash");
});

// B4 — draft mode returns the reasons + notices UNSIGNED (no eager seal, no ephemeral key);
// sealing happens on a later call with the final notices + a persistent key.
test("draft mode returns notices but no sealed bundle", () => {
  const r = reviewAdverseAction(DENIED, { draft: true });
  assert.equal(r.draft, true);
  assert.equal(r.verify, "draft");
  assert.equal(r.bundle, null);
  assert.equal(r.publicKeyPem, null);
  assert.equal(r.ephemeralKey, false);
  assert.ok(r.notices.length >= 1, "draft still surfaces the reason-coded notices to review");
});

// B2 — a real LOS record missing a ratio must yield a legible error, not a
// `Cannot read properties of undefined (reading 'toFixed')` crash.
test("a missing required ratio yields a legible error, not a crash", () => {
  assert.throws(
    () => reviewAdverseAction({ application_id: "X", credit_score: 648, loan_to_value: 0.9 }),
    /missing required field 'debt_to_income'/,
  );
});

test("truncating the chain makes the bundle FAIL", () => {
  const r = reviewAdverseAction(DENIED);
  const truncated = JSON.parse(JSON.stringify(r.bundle));
  truncated.events = truncated.events.slice(0, -1);
  assert.equal(verifyBundle(truncated, { publicKey: r.publicKeyPem }).ok, false);
});

test("a WRONG public key makes verification FAIL", () => {
  const r = reviewAdverseAction(DENIED);
  const { publicKey } = generateKeyPairSync("ed25519");
  const wrong = publicKey.export({ type: "spki", format: "pem" });
  assert.equal(verifyBundle(r.bundle, { publicKey: wrong }).ok, false);
});

test("a persistent key produces a bundle verifiable by its matching public key", () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  const pk = privateKey.export({ type: "pkcs8", format: "pem" });
  const r = reviewAdverseAction(DENIED, { privateKey: pk, keyId: "bank-2026-Q3" });
  assert.equal(r.ephemeralKey, false);
  assert.equal(verifyBundle(r.bundle, { publicKey: r.publicKeyPem }).ok, true);
});

test("an approved application produces NO adverse-action notice", () => {
  const r = reviewAdverseAction(APPROVED);
  assert.equal(r.approved, true);
  assert.equal(r.verdict, "approve");
  assert.equal(r.notices.length, 0);
  assert.equal(r.bundle, null);
});

test("the examiner report names the decision + the Reg B / §1002.9(b)(2) section", () => {
  const r = reviewAdverseAction(DENIED);
  assert.match(r.report, /Decision:\*\*\s*BLOCK/);
  assert.match(r.report, /1002\.9\(b\)\(2\)/);
  assert.match(r.report, /SL-2026-014/);
});
