// test/proxy-detector.test.js
// ──────────────────────────────────────────────────────────────────
// Pins the proxy-detector.js contract shipped 2026-07-08 for Shadow
// v1.5.19. Red-team B1/B2/B3 defenses under honest scope:
//   B1 — combinatorial signals ship as advisory FLAG only, never
//        hard block. Fed itself hasn't solved this.
//   B2 — redaction_manifest_hash proves category distribution, not
//        just count (partial C2 defense).
//   B3 — bank personnel roster allowlist prevents flagging the bank's
//        own compliance officer's name.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  scanDirectMentions,
  scanCombinatorialSignals,
  assessProxyRisk,
  proxySchemaMetadata,
} from "../lib/proxy-detector.js";


// ═══════════════════════════════════════════════════════════════
// Direct-mention hard-block scanner (15 U.S.C. § 1691(a))
// ═══════════════════════════════════════════════════════════════

test("catches direct 'race' mention", () => {
  const hits = scanDirectMentions("Applicant race was considered.");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].class, "race");
  assert.equal(hits[0].severity, "hard_block");
});

test("catches 'religion' mention", () => {
  const hits = scanDirectMentions("The applicant's religion contradicts.");
  assert.ok(hits.some((h) => h.class === "religion"));
});

test("catches 'marital status' phrase", () => {
  const hits = scanDirectMentions("Marital status factored into DTI.");
  assert.ok(hits.some((h) => h.class === "marital_status"));
});

test("catches 'public assistance' phrase", () => {
  const hits = scanDirectMentions("Income from public assistance excluded.");
  assert.ok(hits.some((h) => h.class === "public_assistance_income"));
});

test("does NOT flag word 'raceway' as race (word boundary)", () => {
  const hits = scanDirectMentions("Auto loan for a raceway employee.");
  assert.equal(hits.filter((h) => h.term === "race").length, 0);
});

test("case-insensitive matching", () => {
  const hits = scanDirectMentions("HISPANIC applicant.");
  assert.ok(hits.some((h) => h.class === "race"));
});

test("empty string produces zero hits", () => {
  assert.deepEqual(scanDirectMentions(""), []);
});

test("non-string input produces zero hits", () => {
  assert.deepEqual(scanDirectMentions(null), []);
  assert.deepEqual(scanDirectMentions(42), []);
});


// ═══════════════════════════════════════════════════════════════
// Combinatorial advisory signals (B1 defense — advisory only)
// ═══════════════════════════════════════════════════════════════

test("hmda_mmct + zip_prefix triggers advisory FLAG", () => {
  const hits = scanCombinatorialSignals({
    zip_prefix: "606",
    hmda_mmct: true,
  });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].severity, "advisory");
  assert.equal(hits[0].signal, "zip_prefix_hmda_mmct");
});

test("B1 defense — combinatorial signals NEVER emit hard_block severity", () => {
  const hits = scanCombinatorialSignals({
    zip_prefix: "606",
    hmda_mmct: true,
    surname_ssa_correlated: true,
    surname: "Nguyen",
    language_preference: "es-MX",
  });
  assert.ok(hits.length >= 3);
  for (const h of hits) {
    assert.equal(h.severity, "advisory", "combinatorial signals must be advisory only");
  }
});

test("English language preference does NOT flag", () => {
  const hits = scanCombinatorialSignals({ language_preference: "en" });
  assert.equal(hits.filter((h) => h.signal === "language_preference").length, 0);
});

test("en-US does NOT flag (English variant)", () => {
  const hits = scanCombinatorialSignals({ language_preference: "en-US" });
  assert.equal(hits.filter((h) => h.signal === "language_preference").length, 0);
});

test("non-English preference DOES flag", () => {
  const hits = scanCombinatorialSignals({ language_preference: "es-MX" });
  assert.equal(hits.filter((h) => h.signal === "language_preference").length, 1);
});

test("null features returns empty", () => {
  assert.deepEqual(scanCombinatorialSignals(null), []);
});


// ═══════════════════════════════════════════════════════════════
// Full assessment envelope
// ═══════════════════════════════════════════════════════════════

test("assessProxyRisk recommendation=clear when no signals", () => {
  const result = assessProxyRisk({
    voices: [{ voice: "Compliance Officer", rationale: "FICO 720 meets Addendum A floor." }],
  });
  assert.equal(result.recommendation, "clear");
  assert.equal(result.direct_mention_hits.length, 0);
  assert.equal(result.combinatorial_advisory.length, 0);
});

test("direct-mention hit produces recommendation=block", () => {
  const result = assessProxyRisk({
    voices: [{ voice: "Analyst Notes", rationale: "Denied due to religion." }],
  });
  assert.equal(result.recommendation, "block");
  assert.ok(result.direct_mention_hits.length >= 1);
});

test("combinatorial-only hit produces recommendation=human_review", () => {
  const result = assessProxyRisk({
    voices: [{ voice: "Compliance Officer", rationale: "FICO 720 clears policy." }],
    applicant_features: { zip_prefix: "606", hmda_mmct: true },
  });
  assert.equal(result.recommendation, "human_review");
  assert.equal(result.direct_mention_hits.length, 0);
  assert.equal(result.combinatorial_advisory.length, 1);
});

test("both direct + combinatorial produces block (direct wins)", () => {
  const result = assessProxyRisk({
    voices: [{ voice: "Analyst Notes", rationale: "Race was considered." }],
    applicant_features: { zip_prefix: "606", hmda_mmct: true },
  });
  assert.equal(result.recommendation, "block");
});


// ═══════════════════════════════════════════════════════════════
// Honest scope disclosure baked into every response
// ═══════════════════════════════════════════════════════════════

test("assessment includes honest_scope_note (B1 procurement-defensible framing)", () => {
  const result = assessProxyRisk({
    voices: [{ voice: "Compliance Officer", rationale: "FICO 720 clears policy." }],
  });
  assert.ok(result.honest_scope_note);
  assert.ok(result.honest_scope_note.length > 50, "honest scope must be substantive");
  assert.match(
    result.honest_scope_note,
    /does NOT/i,
    "must explicitly disclose what the scanner does NOT solve"
  );
});

test("assessment includes jurisdiction + schema_version", () => {
  const result = assessProxyRisk({ voices: [] });
  assert.equal(result.jurisdiction, "US-ECOA");
  assert.ok(result.schema_version);
});


// ═══════════════════════════════════════════════════════════════
// Redaction manifest hash (B2 defense)
// ═══════════════════════════════════════════════════════════════

test("redaction_manifest_hash is deterministic for identical inputs", () => {
  const a = assessProxyRisk({
    voices: [{ voice: "V1", rationale: "Denied for race." }],
    applicant_features: { zip_prefix: "606", hmda_mmct: true },
  });
  const b = assessProxyRisk({
    voices: [{ voice: "V1", rationale: "Denied for race." }],
    applicant_features: { zip_prefix: "606", hmda_mmct: true },
  });
  assert.equal(a.redaction_manifest_hash, b.redaction_manifest_hash);
});

test("redaction_manifest_hash differs when hit categories differ", () => {
  const a = assessProxyRisk({
    voices: [{ voice: "V1", rationale: "Denied for race." }],
  });
  const b = assessProxyRisk({
    voices: [{ voice: "V1", rationale: "Denied for religion." }],
  });
  assert.notEqual(a.redaction_manifest_hash, b.redaction_manifest_hash);
});

test("redaction_manifest_hash is a valid SHA-256 hex string", () => {
  const result = assessProxyRisk({ voices: [] });
  assert.match(result.redaction_manifest_hash, /^[a-f0-9]{64}$/);
});


// ═══════════════════════════════════════════════════════════════
// Schema metadata for attestation binding
// ═══════════════════════════════════════════════════════════════

test("proxySchemaMetadata returns jurisdiction + version + sha256", () => {
  const meta = proxySchemaMetadata();
  assert.equal(meta.jurisdiction, "US-ECOA");
  assert.ok(meta.version);
  assert.ok(meta.direct_term_count >= 30);
  assert.ok(meta.advisory_signal_count >= 3);
  assert.match(meta.proxy_schema_sha256, /^[a-f0-9]{64}$/);
});

test("proxySchemaMetadata sha256 is deterministic across calls", () => {
  const a = proxySchemaMetadata();
  const b = proxySchemaMetadata();
  assert.equal(a.proxy_schema_sha256, b.proxy_schema_sha256);
});
