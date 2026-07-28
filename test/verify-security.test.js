// Security hardening for the verifier: untrusted bundles + evidence text can't XSS, pollute the
// prototype, blow the stack, exhaust memory, or inject a javascript:/external URL.
import { test } from "node:test";
import assert from "node:assert/strict";
import { safeParse, escapeHtml, safeUrl } from "../verify/safe-json.mjs";

test("script/HTML in a source quote stays inert text", () => {
  const evil = '<img src=x onerror=alert(1)>"><script>alert(2)</script>';
  const out = escapeHtml(evil);
  assert.equal(/[<>]/.test(out), false, "no raw angle brackets survive");
  assert.match(out, /&lt;script&gt;/);
});

test("javascript: and data: URLs are rejected; only allowlisted https passes", () => {
  assert.equal(safeUrl("javascript:alert(1)"), null);
  assert.equal(safeUrl("data:text/html,<script>"), null);
  assert.equal(safeUrl("https://evil.example.com/x"), null, "unknown origin rejected");
  assert.equal(safeUrl("https://www.federalreserve.gov/sr26-2"), "https://www.federalreserve.gov/sr26-2");
  assert.equal(safeUrl("https://eur-lex.europa.eu/AI-Act"), "https://eur-lex.europa.eu/AI-Act");
});

test("prototype-pollution fields are dropped/rejected, never applied", () => {
  const r = safeParse('{"a":1,"__proto__":{"polluted":true}}');
  // reviver drops __proto__ → object is clean, prototype untouched
  assert.equal(({}).polluted, undefined, "Object.prototype must not be polluted");
  assert.ok(r.ok || r.reason === "PROTOTYPE_POLLUTION");

  const nested = safeParse('{"a":{"constructor":{"x":1}}}');
  assert.equal(nested.ok, false);
  assert.equal(nested.reason, "PROTOTYPE_POLLUTION");
});

test("oversized input is rejected before parse", () => {
  const big = '{"x":"' + "a".repeat(100) + '"}';
  assert.equal(safeParse(big, { maxBytes: 50 }).reason, "TOO_LARGE");
});

test("deeply nested JSON is rejected (no stack blowup)", () => {
  let s = "1";
  for (let i = 0; i < 200; i++) s = "[" + s + "]";
  assert.equal(safeParse(s, { maxDepth: 32 }).reason, "TOO_DEEP");
});

test("too many nodes is rejected", () => {
  const arr = JSON.stringify(Array.from({ length: 500 }, (_, i) => i));
  assert.equal(safeParse(arr, { maxNodes: 100 }).reason, "TOO_MANY_NODES");
});

test("malformed JSON and non-strings fail closed", () => {
  assert.equal(safeParse("{not json").reason, "MALFORMED_JSON");
  assert.equal(safeParse(42).reason, "NOT_A_STRING");
});

test("a well-formed bundle parses fine", () => {
  const r = safeParse('{"bundle_version":1,"events":[{"seq":0}]}');
  assert.equal(r.ok, true);
  assert.equal(r.value.bundle_version, 1);
});
