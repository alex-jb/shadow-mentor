// Tests for reviewer_interaction — the CAAT-borrowed deepening of human_review from a
// binary approved-bool to the auditable interaction record, and its enforcement in the
// Banking Evidence Profile.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { REVIEWER_DECISIONS, validateReviewerInteraction, deriveReviewState } from "../lib/reviewer-interaction.js";
import { createSession, appendEvent, sealSession, verifyBundle } from "../packages/attest-core/session.js";
import { checkBankingProfileV1 } from "../lib/enforce-banking-profile.js";
import { computeDictionaryHash } from "../lib/enforce-reason-code-dictionary.js";

test("decisions enum is frozen", () => {
  assert.deepEqual([...REVIEWER_DECISIONS], ["approved", "modified", "rejected"]);
  assert.throws(() => REVIEWER_DECISIONS.push("x"));
});

test("validateReviewerInteraction: approved needs no rationale; modified/rejected DO (the CAAT rule)", () => {
  assert.equal(validateReviewerInteraction({ decision: "approved" }).valid, true);
  assert.equal(validateReviewerInteraction({ decision: "approved", reviewer_id: "u-9", review_duration_ms: 42000 }).valid, true);
  // override without a rationale → invalid
  assert.match(validateReviewerInteraction({ decision: "modified" }).errors.join(), /override_rationale is required/);
  assert.match(validateReviewerInteraction({ decision: "rejected", override_rationale: "  " }).errors.join(), /override_rationale is required/);
  // override WITH a rationale → valid
  assert.equal(validateReviewerInteraction({ decision: "modified", override_rationale: "lowered LTV cap for this sector", modified_fields: ["ltv_cap"] }).valid, true);
});

test("validateReviewerInteraction: field-type guards", () => {
  assert.match(validateReviewerInteraction({ decision: "nope" }).errors.join(), /decision must be one of/);
  assert.match(validateReviewerInteraction({ decision: "approved", review_duration_ms: -5 }).errors.join(), /review_duration_ms/);
  assert.match(validateReviewerInteraction({ decision: "approved", modified_fields: "ltv" }).errors.join(), /modified_fields must be an array/);
  assert.match(validateReviewerInteraction({ decision: "approved", reviewer_id: "" }).errors.join(), /reviewer_id/);
  assert.equal(validateReviewerInteraction(null).valid, false);
});

// ── profile integration ──────────────────────────────────────────────────────
function keys() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return { priv: privateKey.export({ type: "pkcs8", format: "pem" }), pub: publicKey.export({ type: "spki", format: "pem" }) };
}
function bundleWith(approvalPayload, k) {
  const s = createSession({
    agent: { name: "loan-council", version: "1.5" }, models: [{ model_id: "council-v1", provider: "anthropic" }],
    environmentFingerprint: { os: "linux", node_version: "v24" }, keyId: "k", privateKey: k.priv,
  });
  appendEvent(s, { event_type: "model_output", actor: "model", payload: { decision: "deny", reason_codes: ["AA01"] }, extensions: { dictionary_hash: computeDictionaryHash() } });
  appendEvent(s, { event_type: "human_approval", actor: "user", payload: approvalPayload });
  return sealSession(s);
}
const riStatus = (r) => r.fields.find((f) => f.id === "reviewer_interaction").status;

test("profile reviewer_interaction: unknown → present → missing across the three states", () => {
  const k = keys();
  const approval = { approved: true, reviewer_interaction: { decision: "approved", reviewer_id: "u-9", review_duration_ms: 42000 } };
  const bundle = bundleWith(approval, k);
  const verified = verifyBundle(bundle, { publicKey: k.pub });

  // no payloads → we did not verify it
  assert.equal(riStatus(checkBankingProfileV1(bundle, { verified })), "unknown");

  // valid interaction supplied → present
  const payloads = {};
  bundle.events.forEach((e) => { if (e.event_type === "human_approval") payloads[e.seq] = approval; });
  assert.equal(riStatus(checkBankingProfileV1(bundle, { verified, payloads })), "present");

  // an override with NO rationale supplied → missing (the CAAT rule enforced at the gate)
  const badApproval = { approved: false, reviewer_interaction: { decision: "rejected" } };
  const badBundle = bundleWith(badApproval, k);
  const badPayloads = {};
  badBundle.events.forEach((e) => { if (e.event_type === "human_approval") badPayloads[e.seq] = badApproval; });
  assert.equal(riStatus(checkBankingProfileV1(badBundle, { verified: verifyBundle(badBundle, { publicKey: k.pub }), payloads: badPayloads })), "missing");
});

// ── FINDING-C1 regression: fail-closed multi-reviewer aggregation ──────────────

test("deriveReviewState: [approved, approved] -> approved", () => {
  const r = deriveReviewState([
    { decision: "approved", reviewer_id: "r1" },
    { decision: "approved", reviewer_id: "r2" },
  ]);
  assert.equal(r.status, "approved");
  assert.equal(r.reviewer_interaction.decision, "approved");
});

test("deriveReviewState: [approved, rejected] -> rejected, never approved", () => {
  const r = deriveReviewState([
    { decision: "approved", reviewer_id: "r1" },
    { decision: "rejected", reviewer_id: "r2", override_rationale: "risk too high" },
  ]);
  assert.notEqual(r.status, "approved");
  assert.equal(r.status, "rejected");
  assert.equal(r.reviewer_interaction.decision, "rejected");
});

test("deriveReviewState: [rejected, approved] -> same result as [approved, rejected]", () => {
  const a = deriveReviewState([
    { decision: "approved", reviewer_id: "r1" },
    { decision: "rejected", reviewer_id: "r2", override_rationale: "risk too high" },
  ]);
  const b = deriveReviewState([
    { decision: "rejected", reviewer_id: "r2", override_rationale: "risk too high" },
    { decision: "approved", reviewer_id: "r1" },
  ]);
  assert.equal(a.status, b.status);
  assert.equal(a.status, "rejected");
});

test("deriveReviewState: [approved, modified] -> modified", () => {
  const r = deriveReviewState([
    { decision: "approved", reviewer_id: "r1" },
    { decision: "modified", reviewer_id: "r2", override_rationale: "lower exposure", modified_fields: ["limit"] },
  ]);
  assert.equal(r.status, "modified");
  assert.equal(r.reviewer_interaction.decision, "modified");
});

test("deriveReviewState: [approved, missing] -> pending, never approved", () => {
  const r = deriveReviewState([
    { decision: "approved", reviewer_id: "r1" },
    {}, // missing decision
  ]);
  assert.notEqual(r.status, "approved");
  assert.equal(r.status, "pending");
});

test("deriveReviewState: malformed + approved -> fail closed, never approved", () => {
  const r = deriveReviewState([
    { decision: "approved", reviewer_id: "r1" },
    { decision: "nonsense", reviewer_id: "r2" },
  ]);
  assert.notEqual(r.status, "approved");
  assert.equal(r.status, "pending");
  assert.ok(r.conflict_evidence.length > 0);
});

test("deriveReviewState: empty / null -> pending", () => {
  assert.equal(deriveReviewState([]).status, "pending");
  assert.equal(deriveReviewState(null).status, "pending");
  assert.equal(deriveReviewState(undefined).status, "pending");
});

test("deriveReviewState: reversing reviewer order produces the same result", () => {
  const forward = deriveReviewState([
    { decision: "approved", reviewer_id: "r1" },
    { decision: "modified", reviewer_id: "r2", override_rationale: "x" },
    { decision: "rejected", reviewer_id: "r3", override_rationale: "y" },
  ]);
  const reversed = deriveReviewState([
    { decision: "rejected", reviewer_id: "r3", override_rationale: "y" },
    { decision: "modified", reviewer_id: "r2", override_rationale: "x" },
    { decision: "approved", reviewer_id: "r1" },
  ]);
  assert.equal(forward.status, reversed.status);
  assert.equal(forward.status, "rejected");
});

test("deriveReviewState: single approved -> approved", () => {
  const r = deriveReviewState([{ decision: "approved", reviewer_id: "r1" }]);
  assert.equal(r.status, "approved");
});

test("deriveReviewState: single rejected -> rejected", () => {
  const r = deriveReviewState([{ decision: "rejected", reviewer_id: "r1", override_rationale: "no" }]);
  assert.equal(r.status, "rejected");
});
