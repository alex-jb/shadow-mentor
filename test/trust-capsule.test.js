// Shadow Trust Capsule — the honest-distinction guard. Integrity VERIFIED must never imply
// correctness / approval / external anchoring. Every dimension resolves to a canonical GENERATED
// token; the capsule must not render one generic green check for everything.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTrustCapsule, assertNotAllGreen } from "../lib/trust-capsule.js";

test("collapsed line reflects integrity only, not a blanket verified claim", () => {
  const c = buildTrustCapsule({ integrity: "VERIFIED" });
  assert.match(c.collapsed.label, /INTEGRITY VERIFIED/);
  assert.equal(c.collapsed.brand, "SHADOW");
  assert.match(c.collapsed.label_zh, /完整性/);
});

test("expanded shows eight distinct dimensions", () => {
  const c = buildTrustCapsule();
  const keys = c.dimensions.map((d) => d.key);
  assert.deepEqual(keys, [
    "evidence_integrity", "source_links", "analytical_correctness", "human_review",
    "human_approval", "trust_posture", "external_anchoring", "open_verifier",
  ]);
});

test("REQUIRED explicit distinctions: VERIFIED integrity ≠ NOT_EVALUATED correctness ≠ APPROVAL_NOT_PRESENT ≠ SELF_SIGNED", () => {
  const c = buildTrustCapsule();
  const by = Object.fromEntries(c.dimensions.map((d) => [d.key, d]));
  assert.equal(by.evidence_integrity.status, "VERIFIED");
  assert.equal(by.analytical_correctness.status, "NOT_EVALUATED");
  assert.equal(by.human_approval.status, "APPROVAL_NOT_PRESENT");
  assert.equal(by.trust_posture.status, "SELF_SIGNED");
  // and their colours/text differ — integrity green must not be reused for the others
  assert.notEqual(by.evidence_integrity.color.toLowerCase(), by.analytical_correctness.color.toLowerCase());
  assert.notEqual(by.evidence_integrity.color.toLowerCase(), by.human_approval.color.toLowerCase());
  assert.notEqual(by.analytical_correctness.text, by.evidence_integrity.text);
});

test("SELF_SIGNED is distinct from TIME_ANCHORED (posture honesty)", () => {
  const self = buildTrustCapsule({ trust_posture: "SELF_SIGNED" }).dimensions.find((d) => d.key === "trust_posture");
  const anchored = buildTrustCapsule({ trust_posture: "TIME_ANCHORED" }).dimensions.find((d) => d.key === "trust_posture");
  assert.notEqual(self.text, anchored.text);
  assert.notEqual(self.color.toLowerCase(), anchored.color.toLowerCase());
});

test("NOT one generic green check for every dimension", () => {
  assert.ok(assertNotAllGreen(buildTrustCapsule()));
  // even a maximally-good state is not all-green: approval is blue, correctness/anchor may vary
  assert.ok(assertNotAllGreen(buildTrustCapsule({ analytical_correctness: "VERIFIED", external_anchor: "VERIFIED", approval: "APPROVAL_PRESENT" })));
});

test("every dimension carries a generated token: text + icon + shape + colour + a11y, EN and ZH", () => {
  for (const d of buildTrustCapsule().dimensions) {
    for (const f of ["text", "icon", "shape", "color", "a11y"]) assert.ok(d[f], `${d.key} missing ${f}`);
    assert.ok(/[一-鿿]/.test(d.text_zh), `${d.key} zh text not Chinese`);
    assert.ok(/[一-鿿]/.test(d.a11y_zh), `${d.key} zh a11y not Chinese`);
    assert.match(d.color, /^#[0-9a-fA-F]{6}$/);
  }
});
