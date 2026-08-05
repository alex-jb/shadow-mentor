// B4 — seal AT SIGN-OFF with a persistent key. The two-phase flow a real deployment uses:
// draft → officer edits the notice → sealAdverseAction seals the FINAL, signed-off record.
// Locks the load-bearing invariants: persistent key required; BOTH the AI-drafted original and
// the officer-edited final are sealed (the diff is evidence); the sign-off (or dispute) is
// recorded; and a post-seal plaintext edit still fails verification (B1 rebind).
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { sealAdverseAction } from "../lib/adverse-action-review.js";
import { verifyBundle } from "shadow-attest-core/session";

const DENIED = Object.freeze({
  application_id: "SL-2026-014", credit_score: 648, debt_to_income: 0.45, loan_to_value: 0.9,
  notice_language: "en",
  market_proxy_prices: [100, 101, 99, 102, 98, 103, 97, 104, 96, 105, 95, 106],
  collateral_positions: [], borrower_exposure_weights: { obligor_a: 0.5, obligor_b: 0.5 },
});
const APPROVED = Object.freeze({ application_id: "SL-2026-021", credit_score: 742, debt_to_income: 0.28, loan_to_value: 0.71,
  market_proxy_prices: [100, 100.2, 99.9, 100.1, 100, 99.95, 100.05, 100, 99.9, 100.1, 100, 100.05],
  collateral_positions: [], borrower_exposure_weights: { obligor_a: 0.5, obligor_b: 0.5 } });

function key() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return { priv: privateKey.export({ type: "pkcs8", format: "pem" }), pub: publicKey.export({ type: "spki", format: "pem" }) };
}

test("sealAdverseAction REFUSES to seal without a persistent key (no ephemeral for a signed-off record)", () => {
  assert.throws(() => sealAdverseAction(DENIED, { officer: "j.doe" }), /persistent Ed25519 private key is required/);
});

test("a signed-off record seals + independently verifies (both notice versions embedded)", () => {
  const k = key();
  const r = sealAdverseAction(DENIED, { privateKey: k.priv, keyId: "bank-2026-Q3", officer: "j.doe" });
  assert.equal(r.sealed, true);
  assert.equal(r.decision, "signed");
  assert.equal(r.ephemeralKey, false);
  assert.equal(r.verify, "verified", `self-check: ${r.verify}`);
  const v = verifyBundle(r.bundle, { publicKey: r.publicKeyPem });
  assert.equal(v.ok, true);
  assert.equal(v.sourceResolution, "VERIFIED");
  // both an ai_drafted_notices and an officer_final_notices event are sealed, plus the sign-off
  const kinds = r.bundle.events.map((e) => e.payload && e.payload.kind);
  assert.ok(kinds.includes("ai_drafted_notices"), "AI original must be sealed");
  assert.ok(kinds.includes("officer_final_notices"), "officer final must be sealed");
  const signoff = r.bundle.events.find((e) => e.payload && e.payload.kind === "sign_off");
  assert.ok(signoff, "a sign_off event must be sealed");
  assert.equal(signoff.payload.officer, "j.doe");
  assert.equal(signoff.payload.decision, "signed");
});

test("an officer edit is recorded as edited + both AI-original and edited final are sealed", () => {
  const k = key();
  const r = sealAdverseAction(DENIED, {
    privateKey: k.priv, officer: "j.doe",
    editedNotices: { AA01: "Your credit score is below our threshold. You may reapply after 90 days." },
  });
  assert.deepEqual(r.editedCodes, ["AA01"]);
  const aiAA01 = r.aiNotices.find((n) => n.code === "AA01");
  const offAA01 = r.officerNotices.find((n) => n.code === "AA01");
  const aiText = typeof aiAA01.notice === "string" ? aiAA01.notice : aiAA01.notice.text;
  const offText = typeof offAA01.notice === "string" ? offAA01.notice : offAA01.notice.text;
  assert.notEqual(aiText, offText, "the officer edit must differ from the AI draft");
  assert.match(offText, /reapply after 90 days/);
  // the AI original is still sealed verbatim — the delta is the exam-relevant evidence
  const aiEvent = r.bundle.events.find((e) => e.payload && e.payload.kind === "ai_drafted_notices");
  const sealedAiAA01 = aiEvent.payload.notices.find((n) => n.code === "AA01");
  const sealedAiText = typeof sealedAiAA01.notice === "string" ? sealedAiAA01.notice : sealedAiAA01.notice.text;
  assert.equal(sealedAiText, aiText, "the AI original must be sealed unchanged alongside the edit");
});

test("a dispute seals a 'disputed / returned to model team' record with the note (F3)", () => {
  const k = key();
  const r = sealAdverseAction(DENIED, { privateKey: k.priv, officer: "j.doe", decision: "disputed", disputeNote: "AA04 not substantiated for this obligor mix." });
  assert.equal(r.decision, "disputed");
  assert.equal(verifyBundle(r.bundle, { publicKey: r.publicKeyPem }).ok, true);
  const signoff = r.bundle.events.find((e) => e.payload && e.payload.kind === "sign_off");
  assert.equal(signoff.payload.decision, "disputed");
  assert.match(signoff.payload.dispute_note, /not substantiated/);
});

test("tampering the sealed officer notice after sign-off FAILS verification (B1 rebind holds here too)", () => {
  const k = key();
  const r = sealAdverseAction(DENIED, { privateKey: k.priv, officer: "j.doe" });
  const tampered = JSON.parse(JSON.stringify(r.bundle));
  const ev = tampered.events.find((e) => e.payload && e.payload.kind === "officer_final_notices");
  ev.payload.notices[0].edited = true;
  ev.payload.notices[0].notice = { text: "APPROVED — congratulations." }; // rewrite after signing
  assert.equal(verifyBundle(tampered, { publicKey: r.publicKeyPem }).ok, false);
});

test("an approved application seals nothing (sealed:false)", () => {
  const k = key();
  const r = sealAdverseAction(APPROVED, { privateKey: k.priv, officer: "j.doe" });
  assert.equal(r.approved, true);
  assert.equal(r.sealed, false);
  assert.equal(r.bundle, null);
});
