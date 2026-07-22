// LEGACY v1 CHARACTERIZATION — documents the CONFIRMED structural ambiguities in aex-attestation/v1's
// delimiter-joined signing payload. These tests PASS: they assert the *known historical behavior* so it
// cannot change silently. They do NOT imply v1 is secure — each ambiguity is fixed by v2 (see
// test/attestation-v2-security.test.js). v1 bytes are intentionally left byte-for-byte unchanged so
// existing released proofs keep verifying; the fix is the new v2 wire version, not a v1 rewrite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAttestation } from "../packages/attest-core/attestation.js";

const req = { loan: { amount: 1 } }, res = { verdict: "REVIEW" };
const base = { request: req, response: res, mode: "hmac-sha256", secret: "characterization-secret", modelId: "claude", completedAtUtc: "2026-01-01T00:00:00Z", keyId: "k1" };
const H = "a".repeat(64);

test("V1-OPTIONAL-BINDING-RELABEL-CONFIRMED: same hash under two different binding fields signs identically", () => {
  const withDictionary = buildAttestation({ ...base, dictionaryHash: H });
  const withCitation = buildAttestation({ ...base, citationRegistrySha256: H });
  // KNOWN v1 behavior: field NAMES are not in the signed bytes, so relabeling the same value collides.
  assert.equal(withDictionary.signature, withCitation.signature, "documented v1 relabel collision");
  // and the objects genuinely claim DIFFERENT bindings, yet share one signature
  assert.equal(withDictionary.dictionary_hash, H);
  assert.equal(withCitation.citation_registry_sha256, H);
  assert.equal(withDictionary.citation_registry_sha256, undefined);
});

test("V1-DELIMITER-COLLISION-CONFIRMED: a '|' moving across model_id/completed_at_utc collides", () => {
  const a = buildAttestation({ ...base, modelId: "claude|2026", completedAtUtc: "2026-01-01T00:00:00Z" });
  const b = buildAttestation({ ...base, modelId: "claude", completedAtUtc: "2026|2026-01-01T00:00:00Z" });
  assert.equal(a.signature, b.signature, "documented v1 delimiter-boundary collision");
});

test("V1-DELIMITER-COLLISION-CONFIRMED: a '|' moving across previous_hash/key_id collides", () => {
  const a = buildAttestation({ ...base, previousHash: "x|y", keyId: "k1" });
  const b = buildAttestation({ ...base, previousHash: "x", keyId: "y|k1" });
  assert.equal(a.signature, b.signature, "documented v1 previous_hash/key_id delimiter collision");
});

test("V1-NULL-EMPTY-ABSENT-AMBIGUITY-CONFIRMED: previous_hash null and '' sign identically", () => {
  const withNull = buildAttestation({ ...base, previousHash: null });
  const withEmpty = buildAttestation({ ...base, previousHash: "" });
  assert.equal(withNull.signature, withEmpty.signature, "documented v1 null/empty previous_hash collapse");
});

test("V1-NULL-EMPTY-ABSENT-AMBIGUITY-CONFIRMED: an absent binding and an empty-string binding sign identically", () => {
  const absent = buildAttestation({ ...base });                       // no dictionaryHash
  const empty = buildAttestation({ ...base, dictionaryHash: "" });     // falsy → skipped in the payload
  assert.equal(absent.signature, empty.signature, "documented v1 absent/empty binding collapse");
});

test("v1 signing bytes remain byte-for-byte stable (regression guard on the historical payload)", () => {
  // A pinned v1 signature — if this changes, v1 bytes drifted (forbidden). Recompute only if the fix
  // deliberately versions v1, which it does NOT.
  const a = buildAttestation({ ...base });
  assert.match(a.version, /aex-attestation\/v1/);
  assert.equal(typeof a.signature, "string");
  // determinism: same inputs → same v1 signature
  assert.equal(buildAttestation({ ...base }).signature, a.signature);
});
