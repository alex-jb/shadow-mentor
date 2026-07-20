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
import { computeDictionaryHash } from "../lib/enforce-reason-code-dictionary.js";
import { buildSourceMapFromClaims } from "../lib/document-source-map.js";

const DICT_HASH = computeDictionaryHash(); // the registered, governed dictionary

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
    extensions: { dictionary_hash: DICT_HASH, citation_registry_sha256: "sha256:def456" } });
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

test("document_source_traceability: present when a source-map is bound, missing (not failing) otherwise", () => {
  const k = keys();
  // bare conforming bundle has no source-map → recommended field MISSING but pass holds
  const bare = conformingBundle(k);
  const rBare = checkBankingProfileV1(bare, { verified: verifyBundle(bare, { publicKey: k.pub }) });
  assert.equal(rBare.fields.find((f) => f.id === "document_source_traceability").status, "missing");
  assert.equal(rBare.pass, true); // recommended miss does not fail conformance

  // closed loop: claims → buildSourceMapFromClaims → source_map_hash → bound in a bundle
  const { source_map_hash } = buildSourceMapFromClaims(
    [{ field: "debt_to_income", text: "DTI 0.41 over ceiling", source: "0.41", value: 0.41, page: 2 }],
    { documentBytes: Buffer.from("origination-doc-bytes"), extractedAtUtc: "2026-07-20T00:00:00.000Z" });
  const s = session(k);
  appendEvent(s, { event_type: "prompt", actor: "user", payload: { q: "credit decision" } });
  appendEvent(s, { event_type: "model_output", actor: "model",
    payload: { decision: "deny", reason_codes: ["AA01"] },
    extensions: { dictionary_hash: DICT_HASH, source_map_hash } });
  appendEvent(s, { event_type: "human_approval", actor: "user", payload: { approved: true } });
  const bound = sealSession(s);
  const rBound = checkBankingProfileV1(bound, { verified: verifyBundle(bound, { publicKey: k.pub }) });
  assert.equal(rBound.fields.find((f) => f.id === "document_source_traceability").status, "present");
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

test("a swapped/unregistered reason-code dictionary fails the gate on an adverse decision", () => {
  const k = keys();
  const s = session(k);
  appendEvent(s, { event_type: "tool_call", actor: "tool", payload: { tool: "bureau_pull" } });
  appendEvent(s, { event_type: "model_output", actor: "model", payload: { decision: "deny" },
    extensions: { dictionary_hash: "e".repeat(64) } }); // NOT the registered dictionary
  appendEvent(s, { event_type: "human_approval", actor: "user", payload: { approved: true } });
  const bundle = sealSession(s);
  const verified = verifyBundle(bundle, { publicKey: k.pub });
  const payloads = { 1: { decision: "deny", reason_codes: ["AA01"] } };
  const r = checkBankingProfileV1(bundle, { verified, payloads });
  assert.equal(r.adverse, true);
  assert.equal(r.pass, false);
  assert.ok(r.missing_required.includes("reason_code_dictionary_version"));
  assert.match(r.fields.find((f) => f.id === "reason_code_dictionary_version").detail, /swap|ungoverned/i);
});

test("without a verify result, integrity is 'unknown' (signature present, not yet verified)", () => {
  const k = keys();
  const bundle = conformingBundle(k);
  const r = checkBankingProfileV1(bundle); // no verified
  assert.equal(r.fields.find((f) => f.id === "integrity").status, "unknown");
});
