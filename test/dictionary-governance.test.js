// test/dictionary-governance.test.js
// Reason-code dictionary version governance: the live dictionary must be
// registered (drift guard), a bound hash resolves to its governed version, and a
// swap to an unregistered dictionary is caught.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDictionaryHash } from "../lib/enforce-reason-code-dictionary.js";
import { resolveDictionaryVersion, checkDictionaryGovernance, loadDictionaryRegistry } from "../lib/enforce-dictionary-governance.js";

test("DRIFT GUARD: the live reason-code dictionary's hash is registered + active", () => {
  const hash = computeDictionaryHash();
  const r = resolveDictionaryVersion(hash);
  assert.equal(r.registered, true,
    `live dictionary hash ${hash} is NOT registered — edit lib/schemas/reason-code-dictionary-registry.json to register the new version, then update its dictionary_hash`);
  assert.equal(r.status, "active");
});

test("resolveDictionaryVersion: unknown hash is not registered; sha256: prefix tolerated", () => {
  assert.equal(resolveDictionaryVersion("deadbeef".repeat(8)).registered, false);
  const known = loadDictionaryRegistry().dictionaries[0].dictionary_hash;
  assert.equal(resolveDictionaryVersion("sha256:" + known).registered, true);
});

function bundleWith(dictHash) {
  return { header: {}, events: dictHash === null ? [] : [
    { event_type: "model_output", extensions: { dictionary_hash: dictHash } }] };
}

test("checkDictionaryGovernance: registered hash → ok with resolved version", () => {
  const known = loadDictionaryRegistry().dictionaries[0].dictionary_hash;
  const g = checkDictionaryGovernance(bundleWith(known));
  assert.equal(g.ok, true);
  assert.equal(g.status, "ok");
  assert.equal(g.schema_version, "reason-code-dictionary/v1.0.0");
});

test("checkDictionaryGovernance: unregistered hash → caught as a possible swap", () => {
  const g = checkDictionaryGovernance(bundleWith("f".repeat(64)));
  assert.equal(g.ok, false);
  assert.equal(g.status, "unregistered");
  assert.match(g.detail, /swap|ungoverned/i);
});

test("checkDictionaryGovernance: no binding → no_binding", () => {
  const g = checkDictionaryGovernance(bundleWith(null));
  assert.equal(g.ok, false);
  assert.equal(g.status, "no_binding");
});

test("retired version is rejected", () => {
  const registry = { dictionaries: [
    { schema_version: "reason-code-dictionary/v0.9.0", dictionary_hash: "a".repeat(64), status: "retired", superseded_by: "reason-code-dictionary/v1.0.0" }] };
  const g = checkDictionaryGovernance(bundleWith("a".repeat(64)), { registry });
  assert.equal(g.ok, false);
  assert.equal(g.status, "retired");
  assert.match(g.detail, /RETIRED/);
});
