// test/banking-profile.test.js
// The Banking Evidence Profile v1 conformance checker: a purpose-built credit
// decision bundle conforms; a bare bundle does not; required_on_adverse is
// enforced only when the decision is known-adverse (via payloads); reason-code
// count is bounded; and the profile spec itself is well-formed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { createSession, appendEvent, sealSession, verifyBundle } from "../packages/attest-core/session.js";
import { checkBankingProfileV1, BANKING_PROFILE_V1 } from "../lib/enforce-banking-profile.js";

function keys() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return { priv: privateKey.export({ type: "pkcs8", format: "pem" }), pub: publicKey.export({ type: "spki", format: "pem" }) };
}
function session(k) {
  return createSession({
    agent: { name: "loan-council", version: "1.5" },
    models: [{ model_id: "council-v1", provider: "anthropic" }],
    environmentFingerprint: { os: "linux", node_version: "v24" },
    keyId: "bank-key", privateKey: k.priv,
  });
}

// A bundle that carries all the required evidence slots of a credit decision.
function conformingBundle(k) {
  const s = session(k);
  appendEvent(s, { event_type: "prompt", actor: "user", payload: { q: "credit decision" } });
  appendEvent(s, { event_type: "tool_call", actor: "tool", payload: { tool: "bureau_pull", as_of: "2026-07-17T00:00:00Z" } });
  appendEvent(s, { event_type: "model_output", actor: "model",
    payload: { decision: "deny", reason_codes: ["AA01", "AA02"] },
    extensions: { dictionary_hash: "sha256:abc123", citation_registry_sha256: "sha256:def456" } });
  appendEvent(s, { event_type: "human_approval", actor: "user", payload: { approved: true, reviewer: "u-9" } });
  return sealSession(s);
}

test("profile spec is well-formed (every field has a level, reg_hooks, and a check)", () => {
  assert.equal(BANKING_PROFILE_V1.profile, "banking-v1");
  assert.ok(BANKING_PROFILE_V1.fields.length >= 8);
  for (const f of BANKING_PROFILE_V1.fields) {
    assert.ok(["required", "required_on_adverse", "recommended"].includes(f.level), `${f.id} bad level`);
    assert.ok(Array.isArray(f.reg_hooks) && f.reg_hooks.length, `${f.id} missing reg_hooks`);
    assert.ok(f.check && f.check.kind, `${f.id} missing check`);
  }
});

test("a purpose-built credit-decision bundle conforms (pass, high coverage)", () => {
  const k = keys();
  const bundle = conformingBundle(k);
  const verified = verifyBundle(bundle, { publicKey: k.pub });
  const r = checkBankingProfileV1(bundle, { verified });
  assert.equal(verified.ok, true);
  assert.equal(r.pass, true, `missing: ${r.missing_required.join(",")}`);
  assert.ok(r.coverage_pct >= 70, `coverage ${r.coverage_pct}`);
  // integrity resolves to present once a verify result is supplied
  assert.equal(r.fields.find((f) => f.id === "integrity").status, "present");
});

test("a bare bundle (no decision / no human approval) fails with the missing slots named", () => {
  const k = keys();
  const s = session(k);
  appendEvent(s, { event_type: "prompt", actor: "user", payload: { q: "hi" } });
  const bundle = sealSession(s);
  const r = checkBankingProfileV1(bundle, { verified: verifyBundle(bundle, { publicKey: k.pub }) });
  assert.equal(r.pass, false);
  assert.ok(r.missing_required.includes("decision_outcome"));
  assert.ok(r.missing_required.includes("human_review"));
});

test("required_on_adverse enforced only when payloads reveal an adverse decision", () => {
  const k = keys();
  const bundle = conformingBundle(k);
  const verified = verifyBundle(bundle, { publicKey: k.pub });
  // adverse decision + reason codes present in payloads → conforms
  const payloads = { 2: { decision: "deny", reason_codes: ["AA01", "AA02"] } };
  const rAdverse = checkBankingProfileV1(bundle, { verified, payloads });
  assert.equal(rAdverse.adverse, true);
  assert.equal(rAdverse.pass, true);
  assert.equal(rAdverse.fields.find((f) => f.id === "principal_reason_codes").status, "present");

  // more than 4 principal reason codes → fails Reg B specificity
  const tooMany = { 2: { decision: "deny", reason_codes: ["AA01", "AA02", "AA03", "AA04", "AA05"] } };
  const rTooMany = checkBankingProfileV1(bundle, { verified, payloads: tooMany });
  assert.equal(rTooMany.pass, false);
  assert.ok(rTooMany.missing_required.includes("principal_reason_codes"));
});

test("without a verify result, integrity is 'unknown' (signature present, not yet verified)", () => {
  const k = keys();
  const bundle = conformingBundle(k);
  const r = checkBankingProfileV1(bundle); // no verified
  assert.equal(r.fields.find((f) => f.id === "integrity").status, "unknown");
});
