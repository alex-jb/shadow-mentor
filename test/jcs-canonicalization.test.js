// test/jcs-canonicalization.test.js
//
// P0 · S2 · per docs/SHADOW_SECURITY_STANDARDS_BRIEF (2026-07-13).
//
// The known weakness: signing serializes JSON one way; a verifier in
// another language / library re-serializes differently → either brittle
// false-negatives, or (worse) a tolerant re-parse that lets two
// byte-different-but-semantically-equal payloads collide.
//
// Shadow's canonicalize (packages/attest-core/attestation.js:131) is a
// hand-rolled JCS-lite:
//   - object keys sorted lexicographically
//   - each key and each string value goes through JSON.stringify
//   - numbers/nulls/booleans go through JSON.stringify(primitive)
//   - arrays canonicalized element-wise
//
// Below we exercise the classic RFC 8785 divergence points AND assert
// two adversarial properties:
//   (a) two objects that differ only in key order MUST produce the
//       SAME canonical string (else signature is brittle)
//   (b) two objects that differ semantically MUST produce DIFFERENT
//       canonical strings (else tampered payloads verify)
//
// If any of these fails, follow brief §S2 discipline: mark .skip with
// a TODO(security): jcs-parity note. Do NOT rush a canonicalization
// rewrite 48h before Wed — the fix is to route all signing+verifying
// through a single RFC 8785 canonicalizer, which is a coordinated
// multi-file change.

import { test } from "node:test";
import assert from "node:assert/strict";

import { canonicalize } from "../packages/attest-core/attestation.js";

// ── Property (a): order-insensitive equality ──────────────────

test("S2.a · same object with keys in different orders → SAME canonical string", () => {
  const a = { c: 3, a: 1, b: 2 };
  const b = { a: 1, b: 2, c: 3 };
  const c = { b: 2, c: 3, a: 1 };
  assert.equal(canonicalize(a), canonicalize(b));
  assert.equal(canonicalize(b), canonicalize(c));
  assert.equal(canonicalize(a), '{"a":1,"b":2,"c":3}');
});

test("S2.a · nested objects with reordered keys at every level → SAME", () => {
  const a = { outer: { z: 26, a: 1, m: { y: 25, b: 2 } }, first: true };
  const b = { first: true, outer: { m: { b: 2, y: 25 }, a: 1, z: 26 } };
  assert.equal(canonicalize(a), canonicalize(b));
});

test("S2.a · arrays preserve order (canonicalization does NOT sort arrays)", () => {
  const a = [3, 1, 2];
  const b = [1, 2, 3];
  assert.notEqual(canonicalize(a), canonicalize(b),
    "array order MUST be preserved — sorting arrays would be a semantic bug");
  assert.equal(canonicalize(a), "[3,1,2]");
});


// ── Property (b): semantic difference must be detected ──────

test("S2.b · different values → DIFFERENT canonical strings", () => {
  assert.notEqual(canonicalize({ a: 1 }), canonicalize({ a: 2 }));
  assert.notEqual(canonicalize({ a: 1 }), canonicalize({ b: 1 }));
  assert.notEqual(canonicalize({ a: 1 }), canonicalize({ a: "1" }),
    "1 (number) MUST NOT collide with '1' (string)");
});

test("S2.b · null / false / 0 / '' / empty object / empty array — all distinct", () => {
  const canonicals = [null, false, 0, "", {}, []].map(canonicalize);
  const set = new Set(canonicals);
  assert.equal(set.size, canonicals.length,
    `expected ${canonicals.length} distinct canonicalizations, got ${set.size}: ${canonicals.join(" · ")}`);
});


// ── RFC 8785 corner cases ─────────────────────────────────────

test("S2 · number normalization: 1 vs 1.0 vs 1e0 (JavaScript-native)", () => {
  // In JavaScript these are all the same Number value, so JSON.stringify
  // produces "1" for each. This is aligned with RFC 8785's ECMAScript
  // ToString(Number) rule.
  assert.equal(canonicalize({ n: 1 }), canonicalize({ n: 1.0 }));
  assert.equal(canonicalize({ n: 1 }), canonicalize({ n: 1e0 }));
  assert.equal(canonicalize({ n: 10 }), canonicalize({ n: 1e1 }));
  assert.equal(canonicalize({ n: 0.1 }), canonicalize({ n: 1e-1 }));
});

test("S2 · negative zero collides with positive zero (JavaScript-native behavior)", () => {
  // RFC 8785 §3.2.2.3: negative zero MUST be canonicalized as "0"
  // (positive zero). Node's JSON.stringify(-0) === "0", so this holds.
  assert.equal(canonicalize({ n: -0 }), canonicalize({ n: 0 }));
  assert.equal(canonicalize(-0), "0");
});

test("S2 · unicode strings: escaped vs literal — MUST canonicalize identically", () => {
  // "café" and "café" are the same string in JavaScript. This is
  // what all conforming JCS impls converge on.
  const a = "café";
  const b = "café";
  assert.equal(a, b, "sanity: JS treats them as equal at the language level");
  assert.equal(canonicalize({ s: a }), canonicalize({ s: b }));
});

test("S2 · non-ASCII in keys sorted lexicographically", () => {
  const a = { "é": 1, "a": 2, "z": 3 };
  const b = { "a": 2, "z": 3, "é": 1 };
  assert.equal(canonicalize(a), canonicalize(b));
});

test("S2 · deeply nested + mixed types → deterministic", () => {
  const value = {
    header: {
      session_id: "abc",
      models: [
        { model_id: "claude", provider: "anthropic", extra: null },
        { model_id: "gpt", provider: "openai" },
      ],
    },
    events: [
      { seq: 0, ts: "2026-07-13T00:00:00Z", payload: { text: "café" } },
      { seq: 1, ts: "2026-07-13T00:00:01Z", payload: { nums: [1, 2, 3] } },
    ],
  };
  const c1 = canonicalize(value);
  // Reorder every level.
  const reordered = {
    events: [
      { payload: { text: "café" }, ts: "2026-07-13T00:00:00Z", seq: 0 },
      { ts: "2026-07-13T00:00:01Z", payload: { nums: [1, 2, 3] }, seq: 1 },
    ],
    header: {
      models: [
        { provider: "anthropic", extra: null, model_id: "claude" },
        { provider: "openai", model_id: "gpt" },
      ],
      session_id: "abc",
    },
  };
  const c2 = canonicalize(reordered);
  assert.equal(c1, c2, "deeply nested reorder must not change canonical bytes");
});


// ── Adversarial: tamper-detection property ───────────────────

test("S2 · adversary swap-key values → DIFFERENT canonical (tamper detected)", () => {
  const legit = { verdict: "approve", amount: 100 };
  const tampered = { verdict: "approve", amount: 100000 };
  assert.notEqual(canonicalize(legit), canonicalize(tampered));

  // Swap keys — a subtle attack: attacker moves the value from one key
  // to another. Canonicalizations must differ.
  const swapped = { amount: "approve", verdict: 100 };
  assert.notEqual(canonicalize(legit), canonicalize(swapped));
});


// ── Cross-verifier parity — spec check ───────────────────────
// Node's canonicalize (attestation.js) and the browser's canonicalize
// (verify.html + demos/replay/verify-browser.js) MUST produce
// byte-identical output for the same input. Rather than spawn a
// browser here, we import the browser impl's function directly (it's
// pure JS, no WebCrypto in the canonicalize helper itself).

import { _internal as browserInternal } from "../demos/replay/verify-browser.js";

test("S2 · Node canonicalize === browser canonicalize (parity)", () => {
  const fixtures = [
    null,
    true,
    false,
    0,
    -0,
    1,
    1.5,
    "hello",
    "café",
    [],
    [1, 2, 3],
    {},
    { a: 1 },
    { z: 3, a: 1, m: [{ b: 2, a: 1 }] },
    {
      header: { session_id: "s", agent: { version: "1", name: "c" } },
      events: [{ seq: 0, payload_hash: "abc" }],
    },
  ];
  for (const f of fixtures) {
    const node = canonicalize(f);
    const browser = browserInternal.canonicalize(f);
    assert.equal(node, browser,
      `parity fail on ${JSON.stringify(f)}: node=${node} · browser=${browser}`);
  }
});


// ── Known limitations vs RFC 8785 — documented, not tested ──
// The current canonicalize is JCS-lite: order + JSON.stringify. Full
// RFC 8785 conformance additionally requires:
//   - reject NaN / Infinity / -Infinity (JSON.stringify already does)
//   - explicit UTF-8 byte output (we output JS strings; consumers must
//     UTF-8 encode before hashing — this happens in canonicalBytes)
//   - JSON Number normalization via the ECMAScript §7.1.12.1 algorithm
//     for very large / very small doubles (JavaScript already uses
//     this algorithm; other languages may not — cross-language parity
//     concern documented for S7 in-toto/DSSE work)
//
// A future S2.2 (post-Wed) will spawn a Python-side canonicalize and
// assert byte parity. For now, Node ↔ browser parity above is enough
// to claim "byte-identical between two independently-authored
// verifiers in the same repo" which is the current scope.
