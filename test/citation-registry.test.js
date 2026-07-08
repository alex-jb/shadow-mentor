// test/citation-registry.test.js
// ──────────────────────────────────────────────────────────────────
// Pins the citation registry contract shipped 2026-07-07 for
// Shadow v1.5.18 procurement discipline release.
//
// Attack surface closed by these tests:
//   A1 — LLM hallucinated section numbers get rejected
//   A2 — Semantically-wrong citation for an AA code gets rejected
//   A3 — Sunset citations (SR 11-7 post 2026-04-17) get rejected
//   Registry integrity — SHA-256 stability guards post-hoc swaps

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CITATION_REGISTRY_VERSION,
  CITATIONS,
  CITATION_ALIASES,
  normalizeCitation,
  isValidCitation,
  isValidForAA,
  isCitationCurrent,
  getCitation,
  citationsForAA,
  verifiedCitations,
  registryMetadata,
} from "../lib/citation-registry.js";


// ═══════════════════════════════════════════════════════════════
// Registry shape
// ═══════════════════════════════════════════════════════════════

test("registry version is a date string 2026 or later", () => {
  assert.ok(CITATION_REGISTRY_VERSION.startsWith("2026-"));
});

test("registry has both citations and aliases", () => {
  assert.ok(Object.keys(CITATIONS).length >= 10);
  assert.ok(Object.keys(CITATION_ALIASES).length >= 15);
});

test("every citation entry has required fields", () => {
  for (const [id, entry] of Object.entries(CITATIONS)) {
    assert.equal(entry.id, id, `${id}: entry.id mismatches key`);
    assert.ok(entry.regulator, `${id}: regulator missing`);
    assert.ok(entry.topic, `${id}: topic missing`);
    assert.ok(typeof entry.verbatim_snippet === "string", `${id}: verbatim_snippet missing`);
    assert.ok(entry.verbatim_snippet.length > 0, `${id}: verbatim_snippet empty`);
    assert.ok(typeof entry.verbatim_verified === "boolean", `${id}: verbatim_verified not boolean`);
    assert.ok(Array.isArray(entry.valid_for_aa_codes), `${id}: valid_for_aa_codes not array`);
    assert.ok(entry.source_url, `${id}: source_url missing`);
  }
});

test("every alias points to a valid canonical id", () => {
  for (const [alias, canonicalId] of Object.entries(CITATION_ALIASES)) {
    assert.ok(CITATIONS[canonicalId], `alias "${alias}" points to unknown id "${canonicalId}"`);
  }
});


// ═══════════════════════════════════════════════════════════════
// normalizeCitation — canonical + alias + invalid inputs
// ═══════════════════════════════════════════════════════════════

test("normalizeCitation returns canonical id unchanged", () => {
  assert.equal(normalizeCitation("12CFR1002.9(b)(2)"), "12CFR1002.9(b)(2)");
});

test("normalizeCitation resolves verbose CFR alias", () => {
  assert.equal(normalizeCitation("12 CFR § 1002.9(b)(2)"), "12CFR1002.9(b)(2)");
});

test("normalizeCitation resolves Reg B shorthand", () => {
  assert.equal(normalizeCitation("Reg B §1002.9(b)(2)"), "12CFR1002.9(b)(2)");
});

test("normalizeCitation resolves ECOA shorthand", () => {
  assert.equal(normalizeCitation("ECOA §701"), "15USC1691(a)");
});

test("normalizeCitation trims whitespace", () => {
  assert.equal(normalizeCitation("  SR 26-2  "), "SR-26-2");
});

test("normalizeCitation returns null for hallucinated citation", () => {
  assert.equal(normalizeCitation("12 CFR 1002.9(c)(3)"), null);
});

test("normalizeCitation returns null for non-string input", () => {
  assert.equal(normalizeCitation(null), null);
  assert.equal(normalizeCitation(undefined), null);
  assert.equal(normalizeCitation(42), null);
  assert.equal(normalizeCitation({}), null);
});

test("normalizeCitation returns null for empty string", () => {
  assert.equal(normalizeCitation(""), null);
  assert.equal(normalizeCitation("   "), null);
});


// ═══════════════════════════════════════════════════════════════
// isValidCitation — attack A1 defense
// ═══════════════════════════════════════════════════════════════

test("isValidCitation true for real §1002.9(b)(2)", () => {
  assert.equal(isValidCitation("12CFR1002.9(b)(2)"), true);
  assert.equal(isValidCitation("Reg B §1002.9(b)(2)"), true);
});

test("A1 — isValidCitation false for hallucinated CFR section", () => {
  assert.equal(isValidCitation("12 CFR 1002.9(c)(3)"), false);
  assert.equal(isValidCitation("12 CFR 1002.99(z)"), false);
  assert.equal(isValidCitation("15 U.S.C. § 9999(z)"), false);
});

test("A1 — isValidCitation false for empty / null", () => {
  assert.equal(isValidCitation(""), false);
  assert.equal(isValidCitation(null), false);
});


// ═══════════════════════════════════════════════════════════════
// isValidForAA — attack A2 defense (semantic match)
// ═══════════════════════════════════════════════════════════════

test("§1002.9(b)(2) is valid for AA01 (credit score)", () => {
  assert.equal(isValidForAA("12CFR1002.9(b)(2)", "AA01"), true);
});

test("§1002.9(b)(2) is valid for AA03 (LTV)", () => {
  assert.equal(isValidForAA("12CFR1002.9(b)(2)", "AA03"), true);
});

test("A2 — §1002.9(b)(2) NOT valid for AA04 (portfolio risk)", () => {
  assert.equal(isValidForAA("12CFR1002.9(b)(2)", "AA04"), false);
});

test("A2 — SR 26-2 governance-only NOT valid for any AA code", () => {
  for (const aa of ["AA01", "AA02", "AA03", "AA04", "AA05"]) {
    assert.equal(isValidForAA("SR-26-2", aa), false, `SR 26-2 should not justify ${aa}`);
  }
});

test("A2 — 15 USC 1691(a) valid for AA05 fair-lending only", () => {
  assert.equal(isValidForAA("15USC1691(a)", "AA05"), true);
  assert.equal(isValidForAA("15USC1691(a)", "AA01"), false);
});

test("A2 — unknown citation returns false", () => {
  assert.equal(isValidForAA("12 CFR 9999(z)", "AA01"), false);
});


// ═══════════════════════════════════════════════════════════════
// isCitationCurrent — attack A3 defense (sunset check)
// ═══════════════════════════════════════════════════════════════

test("A3 — SR 26-2 is current as of 2026-07-07", () => {
  assert.equal(isCitationCurrent("SR-26-2", new Date("2026-07-07")), true);
});

test("A3 — SR 11-7 is rescinded (returns false after 2026-04-17)", () => {
  assert.equal(isCitationCurrent("SR-11-7", new Date("2026-07-07")), false);
});

test("A3 — SR 11-7 was current before its 2026-04-17 sunset", () => {
  assert.equal(isCitationCurrent("SR-11-7", new Date("2020-06-01")), true);
});

test("A3 — §1002.9(b)(2) has no sunset, always current", () => {
  assert.equal(isCitationCurrent("12CFR1002.9(b)(2)", new Date("2030-12-31")), true);
});

test("A3 — unknown citation returns false", () => {
  assert.equal(isCitationCurrent("12 CFR 9999(z)"), false);
});


// ═══════════════════════════════════════════════════════════════
// getCitation — full metadata lookup
// ═══════════════════════════════════════════════════════════════

test("getCitation returns full entry with verbatim snippet", () => {
  const entry = getCitation("12CFR1002.9(b)(2)");
  assert.ok(entry);
  assert.equal(entry.regulator, "CFPB");
  assert.equal(entry.topic, "adverse_action_specificity");
  assert.ok(entry.verbatim_snippet.includes("internal standards"));
  assert.equal(entry.verbatim_verified, true);
});

test("getCitation via alias returns canonical entry", () => {
  const entry = getCitation("Reg B §1002.9(b)(2)");
  assert.equal(entry.id, "12CFR1002.9(b)(2)");
});

test("getCitation returns null for unknown", () => {
  assert.equal(getCitation("nonsense"), null);
});


// ═══════════════════════════════════════════════════════════════
// citationsForAA — runtime prompt-inject list
// ═══════════════════════════════════════════════════════════════

test("citationsForAA(AA01) includes §1002.9(b)(2)", () => {
  const list = citationsForAA("AA01");
  const ids = list.map((c) => c.id);
  assert.ok(ids.includes("12CFR1002.9(b)(2)"));
});

test("citationsForAA(AA05) includes fair-lending regulations", () => {
  const list = citationsForAA("AA05");
  const ids = list.map((c) => c.id);
  assert.ok(ids.includes("15USC1691(a)"));
  assert.ok(ids.includes("12CFR1002.6(b)"));
  assert.ok(ids.includes("12CFR1002.9(b)(2)"));
});

test("citationsForAA excludes sunset entries", () => {
  // SR 11-7 has no valid_for_aa_codes anyway, but test shape:
  // ensure the filter honors sunset.
  const list = citationsForAA("AA01", new Date("2026-07-07"));
  assert.ok(!list.some((c) => c.sunset && new Date(c.sunset) < new Date("2026-07-07")));
});

test("citationsForAA returns empty array for unknown AA code", () => {
  const list = citationsForAA("AA99");
  assert.deepEqual(list, []);
});


// ═══════════════════════════════════════════════════════════════
// verifiedCitations — external procurement filter
// ═══════════════════════════════════════════════════════════════

test("verifiedCitations returns only verbatim-verified entries", () => {
  const verified = verifiedCitations();
  assert.ok(verified.length >= 5, "should have at least 5 verified entries");
  for (const entry of verified) {
    assert.equal(entry.verbatim_verified, true);
  }
});

test("verifiedCitations includes §1002.9(b)(2)", () => {
  const verified = verifiedCitations();
  const ids = verified.map((e) => e.id);
  assert.ok(ids.includes("12CFR1002.9(b)(2)"));
});

test("verifiedCitations excludes pending-review entries", () => {
  const verified = verifiedCitations();
  const ids = verified.map((e) => e.id);
  // These are marked verbatim_verified: false pending Loredana review
  assert.ok(!ids.includes("CFPB-Bulletin-2024-09"));
  assert.ok(!ids.includes("SR-11-7"));
});


// ═══════════════════════════════════════════════════════════════
// registryMetadata — attestation payload binding
// ═══════════════════════════════════════════════════════════════

test("registryMetadata returns version + counts + sha256", () => {
  const meta = registryMetadata();
  assert.equal(meta.version, CITATION_REGISTRY_VERSION);
  assert.ok(meta.entry_count >= 10);
  assert.ok(meta.alias_count >= 15);
  assert.ok(meta.verified_count >= 5);
  assert.ok(/^[a-f0-9]{64}$/.test(meta.registry_sha256));
});

test("registryMetadata sha256 is deterministic across calls", () => {
  const a = registryMetadata();
  const b = registryMetadata();
  assert.equal(a.registry_sha256, b.registry_sha256);
});
