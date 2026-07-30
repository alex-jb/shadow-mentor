// Node test for the pure validation logic of bundle-loader.js.
// (DOM wiring is exercised manually; validateBundle is the honesty gate.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBundle } from "./bundle-loader.js";

const good = {
  header: { session_id: "s1" },
  events: [{ seq: 0 }, { seq: 1 }],
  signatures: [{ alg: "ed25519", sig: "..." }],
  batch_root: "abc",
};

test("accepts a well-formed evidence bundle", () => {
  assert.equal(validateBundle(good).ok, true);
});

test("rejects with a reason, never throws, for bad inputs (anti-silent-failure)", () => {
  const cases = [
    [null, /JSON object/],
    [{}, /header/],
    [{ header: {} }, /events/],
    [{ header: {}, events: [] }, /empty/],
    [{ header: {}, events: [{ seq: 0 }] }, /signatures/],
    [{ header: {}, events: [{ seq: 0 }], signatures: [] }, /signatures/],
    [{ header: {}, events: [{ notseq: 1 }], signatures: [{}] }, /seq/],
  ];
  for (const [input, re] of cases) {
    const r = validateBundle(input);
    assert.equal(r.ok, false, JSON.stringify(input));
    assert.match(r.reason, re);
  }
});

test("batch_root is optional (older single-signature bundles still load)", () => {
  const { batch_root, ...noRoot } = good;
  assert.equal(validateBundle(noRoot).ok, true);
});
