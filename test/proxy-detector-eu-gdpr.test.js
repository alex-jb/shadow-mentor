// test/proxy-detector-eu-gdpr.test.js
// ──────────────────────────────────────────────────────────────────
// v1.5.20 B4 EU jurisdiction tests. Pins the GDPR Art. 9 / Art. 22 /
// Schufa taxonomy contract shipped 2026-07-08.
//
// German + English direct-mention terms both hard-block.
// Combinatorial signals under EU-GDPR jurisdiction differ from
// US-ECOA — postal_code_ethnic_correlation replaces zip_prefix_hmda_mmct,
// surname_national_origin_correlation replaces surname_ssa_ethnic,
// residency_status replaces language_preference.
//
// Attestation binding differentiated per jurisdiction:
// proxy_schema_sha256 differs between US-ECOA and EU-GDPR.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  scanDirectMentions,
  scanCombinatorialSignals,
  assessProxyRisk,
  proxySchemaMetadata,
  supportedJurisdictions,
} from "../lib/proxy-detector.js";


// ═══════════════════════════════════════════════════════════════
// Jurisdiction enumeration
// ═══════════════════════════════════════════════════════════════

test("supportedJurisdictions returns US-ECOA and EU-GDPR", () => {
  const list = supportedJurisdictions();
  assert.ok(list.includes("US-ECOA"));
  assert.ok(list.includes("EU-GDPR"));
});

test("unknown jurisdiction throws with helpful message", () => {
  assert.throws(
    () => scanDirectMentions("test", { jurisdiction: "UK-EA2010" }),
    /unsupported jurisdiction/
  );
});


// ═══════════════════════════════════════════════════════════════
// German direct-mention (GDPR Art. 9)
// ═══════════════════════════════════════════════════════════════

test("EU-GDPR catches German 'Herkunft' as ethnic_origin", () => {
  const hits = scanDirectMentions("Die Herkunft des Antragstellers.", {
    jurisdiction: "EU-GDPR",
  });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].class, "ethnic_origin");
  assert.equal(hits[0].language, "de");
  assert.equal(hits[0].gdpr_ref, "Art. 9(1)");
});

test("EU-GDPR catches 'Religionszugehörigkeit'", () => {
  const hits = scanDirectMentions("Die Religionszugehörigkeit wurde geprüft.", {
    jurisdiction: "EU-GDPR",
  });
  assert.ok(hits.some((h) => h.class === "religion_belief"));
});

test("EU-GDPR catches English 'sexual orientation'", () => {
  const hits = scanDirectMentions("Sexual orientation is not a factor.", {
    jurisdiction: "EU-GDPR",
  });
  assert.ok(hits.some((h) => h.class === "sexual_orientation"));
});

test("EU-GDPR catches 'trade union' membership", () => {
  const hits = scanDirectMentions("Applicant is a trade union member.", {
    jurisdiction: "EU-GDPR",
  });
  assert.ok(hits.some((h) => h.class === "trade_union_membership"));
});

test("EU-GDPR catches 'health data'", () => {
  const hits = scanDirectMentions("Health data was considered.", {
    jurisdiction: "EU-GDPR",
  });
  assert.ok(hits.some((h) => h.class === "health"));
});

test("EU-GDPR does NOT flag 'age' (age is Art. 21 not Art. 9)", () => {
  const hits = scanDirectMentions("Applicant age was checked.", {
    jurisdiction: "EU-GDPR",
  });
  const ageHits = hits.filter((h) => h.term === "age");
  assert.equal(ageHits.length, 0, "GDPR Art. 9 special categories do not include age");
});

test("US-ECOA does flag 'age' (ECOA §701 explicit)", () => {
  const hits = scanDirectMentions("Applicant age was checked.", {
    jurisdiction: "US-ECOA",
  });
  assert.ok(hits.some((h) => h.class === "age"));
});


// ═══════════════════════════════════════════════════════════════
// EU-GDPR combinatorial signals
// ═══════════════════════════════════════════════════════════════

test("EU-GDPR flags postal_code with ethnic_district_correlated=true", () => {
  const hits = scanCombinatorialSignals(
    { postal_code: "10557", ethnic_district_correlated: true },
    { jurisdiction: "EU-GDPR" }
  );
  assert.equal(hits.length, 1);
  assert.equal(hits[0].signal, "postal_code_ethnic_correlation");
});

test("EU-GDPR flags non-EU residency_status", () => {
  const hits = scanCombinatorialSignals(
    { residency_status: "US" },
    { jurisdiction: "EU-GDPR" }
  );
  assert.ok(hits.some((h) => h.signal === "residency_status"));
});

test("EU-GDPR does NOT flag EU residency", () => {
  const hits = scanCombinatorialSignals(
    { residency_status: "EU" },
    { jurisdiction: "EU-GDPR" }
  );
  assert.equal(hits.filter((h) => h.signal === "residency_status").length, 0);
});

test("EU-GDPR does NOT flag EEA residency", () => {
  const hits = scanCombinatorialSignals(
    { residency_status: "EEA" },
    { jurisdiction: "EU-GDPR" }
  );
  assert.equal(hits.filter((h) => h.signal === "residency_status").length, 0);
});

test("EU-GDPR combinatorial signals are ALL advisory (B1 defense)", () => {
  const hits = scanCombinatorialSignals(
    {
      postal_code: "10557",
      ethnic_district_correlated: true,
      surname_national_origin_correlated: true,
      surname: "Yılmaz",
      residency_status: "TR",
    },
    { jurisdiction: "EU-GDPR" }
  );
  assert.ok(hits.length >= 3);
  for (const h of hits) {
    assert.equal(h.severity, "advisory");
  }
});

test("US-ECOA combinatorial signals do NOT fire for EU features", () => {
  const hits = scanCombinatorialSignals(
    { postal_code: "10557", ethnic_district_correlated: true },
    { jurisdiction: "US-ECOA" }
  );
  assert.equal(hits.length, 0, "postal_code is EU signal; US-ECOA scanner ignores it");
});


// ═══════════════════════════════════════════════════════════════
// Full assessment envelope routing
// ═══════════════════════════════════════════════════════════════

test("EU-GDPR full assessment routes to correct schema", () => {
  const result = assessProxyRisk({
    voices: [{ voice: "Compliance", rationale: "Herkunft ignoriert." }],
    jurisdiction: "EU-GDPR",
  });
  assert.equal(result.jurisdiction, "EU-GDPR");
  assert.equal(result.recommendation, "block");
});

test("US-ECOA full assessment routes to correct schema", () => {
  const result = assessProxyRisk({
    voices: [{ voice: "Analyst", rationale: "Race was ignored." }],
    jurisdiction: "US-ECOA",
  });
  assert.equal(result.jurisdiction, "US-ECOA");
  assert.equal(result.recommendation, "block");
});

test("no jurisdiction param defaults to US-ECOA (back-compat)", () => {
  const result = assessProxyRisk({
    voices: [{ voice: "Compliance", rationale: "FICO 720 clears." }],
  });
  assert.equal(result.jurisdiction, "US-ECOA");
});


// ═══════════════════════════════════════════════════════════════
// Jurisdiction-specific attestation binding
// ═══════════════════════════════════════════════════════════════

test("proxy_schema_sha256 differs between US-ECOA and EU-GDPR", () => {
  const us = proxySchemaMetadata({ jurisdiction: "US-ECOA" });
  const eu = proxySchemaMetadata({ jurisdiction: "EU-GDPR" });
  assert.notEqual(
    us.proxy_schema_sha256,
    eu.proxy_schema_sha256,
    "different jurisdictions must produce different schema hashes"
  );
  assert.equal(us.jurisdiction, "US-ECOA");
  assert.equal(eu.jurisdiction, "EU-GDPR");
});

test("EU-GDPR schema has at least 20 direct-mention terms + 3 advisory signals", () => {
  const meta = proxySchemaMetadata({ jurisdiction: "EU-GDPR" });
  assert.ok(meta.direct_term_count >= 20);
  assert.ok(meta.advisory_signal_count >= 3);
});

test("EU honest_scope_note explicitly disclaims EU AI Act 'ready'", () => {
  const result = assessProxyRisk({ voices: [], jurisdiction: "EU-GDPR" });
  assert.ok(
    /AI Act 2026 ready/i.test(result.honest_scope_note),
    "must explicitly reject 'AI Act 2026 ready' framing (Digital Omnibus deferred to 2027-12-02)"
  );
});
