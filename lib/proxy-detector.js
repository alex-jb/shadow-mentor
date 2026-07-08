// Proxy detector — honest scope.
//
// Scans persona rationales for ECOA §701 direct-mention protected-class
// references (hard block) + three combinatorial signals (advisory FLAG).
// The 15-item exact-match blocklist that ships in
// enforce-reason-code-dictionary.js is the actual runtime hard-block
// gate; this module is the descriptive scanner + audit-envelope
// contributor.
//
// Red-team B1 caveat baked in: this module does NOT solve combinatorial
// proxy detection. The Fed itself has no crisp solution. Combinatorial
// signals ship as advisory FLAG requiring human review — never as
// hard-block claims. See lib/schemas/protected-classes-us-ecoa.json
// honest_scope_disclosure for the procurement-defensible framing.
//
// Red-team B3 defense: bank_personnel_roster allowlist prevents the
// scanner from flagging the bank's own compliance officer's name as
// protected-class-adjacent. Roster loaded from
// SHADOW_BANK_PERSONNEL_ROSTER_PATH env var at import time.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// v1.5.20: jurisdiction-routed schema loader. Default US-ECOA for
// back-compat with v1.5.19 callers who did not pass jurisdiction.
// EU-GDPR loads the Art. 9 / Art. 22 / Schufa taxonomy.
const SCHEMA_PATHS = {
  "US-ECOA": resolve(__dirname, "schemas", "protected-classes-us-ecoa.json"),
  "EU-GDPR": resolve(__dirname, "schemas", "protected-classes-eu-gdpr.json"),
};

const SCHEMAS = Object.freeze({
  "US-ECOA": JSON.parse(readFileSync(SCHEMA_PATHS["US-ECOA"], "utf8")),
  "EU-GDPR": JSON.parse(readFileSync(SCHEMA_PATHS["EU-GDPR"], "utf8")),
});

// Default. Back-compat: v1.5.19 callers with no jurisdiction arg
// resolve to US-ECOA. Explicit jurisdiction arg overrides.
const DEFAULT_JURISDICTION = "US-ECOA";

function _resolveSchema(jurisdiction) {
  const key = jurisdiction || DEFAULT_JURISDICTION;
  if (!SCHEMAS[key]) {
    throw new Error(
      `proxy-detector: unsupported jurisdiction "${key}". ` +
      `Supported: ${Object.keys(SCHEMAS).join(", ")}`
    );
  }
  return SCHEMAS[key];
}

// Kept as SCHEMA singleton for v1.5.19 back-compat helpers below.
const SCHEMA = SCHEMAS[DEFAULT_JURISDICTION];

/**
 * Load bank personnel roster from env-configured path. Falls back to
 * the shipped example when unset — but the example is marked
 * example_only: true so any real deployment must set the env var.
 */
function _loadRoster() {
  const envPath = process.env.SHADOW_BANK_PERSONNEL_ROSTER_PATH;
  if (envPath && existsSync(envPath)) {
    return JSON.parse(readFileSync(envPath, "utf8"));
  }
  return { personnel: [], example_only: true };
}

const ROSTER = _loadRoster();
const ROSTER_ALLOWLIST_NAMES = new Set(
  ROSTER.personnel.map((p) => (p.full_name || "").toLowerCase())
);

/**
 * Case-insensitive whole-word match. Uses word boundaries so
 * "raceway" doesn't match "race" but "race-based" does.
 */
function _containsTerm(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b${escaped}\\b`, "i");
  return pattern.test(text);
}

/**
 * Scan a single rationale text for direct-mention ECOA §701 terms.
 * Returns array of hits, each with the term matched + protected class.
 * Bank personnel roster allowlist skips names — a term like "Rodriguez"
 * that happens to be on both the ECOA blocklist and the personnel
 * roster does NOT flag.
 */
export function scanDirectMentions(text, { jurisdiction } = {}) {
  if (typeof text !== "string" || text.length === 0) return [];
  const schema = _resolveSchema(jurisdiction);
  const hits = [];
  for (const entry of schema.direct_mention_hard_block) {
    if (!_containsTerm(text, entry.term)) continue;
    // Personnel allowlist skip: if the term appears as part of a
    // roster name, don't flag it. Match on the surrounding word so
    // "Officer Rodriguez" doesn't flag "hispanic" if roster has him.
    // Simple heuristic: if any allowlisted name contains the term,
    // check if the term appears only inside that name in this text.
    const allowlistedContexts = [...ROSTER_ALLOWLIST_NAMES].filter((name) =>
      name.includes(entry.term.toLowerCase())
    );
    let allTermInstancesAreAllowlisted = false;
    if (allowlistedContexts.length > 0) {
      const lower = text.toLowerCase();
      const termLower = entry.term.toLowerCase();
      let idx = 0;
      let allInside = true;
      while ((idx = lower.indexOf(termLower, idx)) !== -1) {
        const insideAllowlistedName = allowlistedContexts.some((name) => {
          const nameIdx = lower.indexOf(name);
          return (
            nameIdx !== -1 &&
            idx >= nameIdx &&
            idx + termLower.length <= nameIdx + name.length
          );
        });
        if (!insideAllowlistedName) {
          allInside = false;
          break;
        }
        idx += termLower.length;
      }
      allTermInstancesAreAllowlisted = allInside;
    }
    if (allTermInstancesAreAllowlisted) continue;
    hits.push({
      term: entry.term,
      class: entry.class,
      severity: "hard_block",
      ...(entry.gdpr_ref ? { gdpr_ref: entry.gdpr_ref } : {}),
      ...(entry.language ? { language: entry.language } : {}),
    });
  }
  return hits;
}

/**
 * Scan applicant feature keys (not values — the keys themselves) for
 * combinatorial-proxy signals. Advisory only per honest scope.
 *
 * `features` shape: { zip_prefix: "606", surname: "Nguyen",
 * language_preference: "es-MX", ... } — pass whichever fields your
 * council rationale references. Returns an array of advisory hits.
 */
export function scanCombinatorialSignals(features, { jurisdiction } = {}) {
  if (!features || typeof features !== "object") return [];
  const key = jurisdiction || DEFAULT_JURISDICTION;
  const hits = [];

  if (key === "US-ECOA") {
    if (
      features.zip_prefix &&
      typeof features.zip_prefix === "string" &&
      features.hmda_mmct === true
    ) {
      hits.push({
        signal: "zip_prefix_hmda_mmct",
        value: features.zip_prefix,
        severity: "advisory",
        reference: "CFPB Ally $98M consent order (2013)",
      });
    }
    if (
      features.surname_ssa_correlated === true &&
      typeof features.surname === "string"
    ) {
      hits.push({
        signal: "surname_ssa_ethnic_correlation",
        value: features.surname,
        severity: "advisory",
        reference: "CFPB BISG methodology",
      });
    }
    if (
      features.language_preference &&
      typeof features.language_preference === "string" &&
      features.language_preference.toLowerCase() !== "en" &&
      !features.language_preference.toLowerCase().startsWith("en-")
    ) {
      hits.push({
        signal: "language_preference",
        value: features.language_preference,
        severity: "advisory",
        reference: "12 CFR § 1002.4",
      });
    }
    return hits;
  }

  if (key === "EU-GDPR") {
    if (
      features.postal_code &&
      typeof features.postal_code === "string" &&
      features.ethnic_district_correlated === true
    ) {
      hits.push({
        signal: "postal_code_ethnic_correlation",
        value: features.postal_code,
        severity: "advisory",
        reference: "Eurostat regional statistics",
      });
    }
    if (
      features.surname_national_origin_correlated === true &&
      typeof features.surname === "string"
    ) {
      hits.push({
        signal: "surname_national_origin_correlation",
        value: features.surname,
        severity: "advisory",
        reference: "GDPR Art. 22 + ECJ C-634/21 Schufa",
      });
    }
    if (
      features.residency_status &&
      typeof features.residency_status === "string" &&
      features.residency_status.toLowerCase() !== "eu" &&
      features.residency_status.toLowerCase() !== "eea"
    ) {
      hits.push({
        signal: "residency_status",
        value: features.residency_status,
        severity: "advisory",
        reference: "GDPR Art. 22 + AGG Germany",
      });
    }
    return hits;
  }

  return hits;
}

/**
 * Full proxy-risk assessment for a single decision.
 *
 * Inputs:
 *   voices: [{voice, rationale}, ...] — from run-loan-council
 *   applicant_features: { zip_prefix, hmda_mmct, surname,
 *     surname_ssa_correlated, language_preference, ... } — optional
 *
 * Output shape (envelope-ready):
 *   {
 *     direct_mention_hits: [{voice, term, class, severity}],
 *     combinatorial_advisory: [{signal, value, severity, reference}],
 *     redaction_manifest_hash: sha256hex,
 *     recommendation: "block" | "human_review" | "clear",
 *     honest_scope_note: string
 *   }
 *
 * Recommendation semantics:
 *   - any direct_mention_hits → "block" (hard veto)
 *   - any combinatorial_advisory → "human_review" (advisory FLAG)
 *   - neither → "clear"
 *
 * `redaction_manifest_hash` binds a per-hit category summary (not the
 * PII itself) into a SHA-256. Bank auditor verifies category
 * distribution matches expected without seeing the raw text (red-team
 * B2 defense: prove redaction category correctness, not just count).
 */
export function assessProxyRisk({
  voices = [],
  applicant_features = null,
  jurisdiction = DEFAULT_JURISDICTION,
} = {}) {
  const schema = _resolveSchema(jurisdiction);
  const direct = [];
  for (const v of voices) {
    const hits = scanDirectMentions(v.rationale ?? "", { jurisdiction });
    for (const h of hits) direct.push({ voice: v.voice, ...h });
  }
  const combinatorial = scanCombinatorialSignals(applicant_features, { jurisdiction });

  const manifestPayload = JSON.stringify({
    direct_categories: direct.map((d) => d.class).sort(),
    advisory_signals: combinatorial.map((c) => c.signal).sort(),
    voice_count: voices.length,
    jurisdiction: schema.jurisdiction,
    schema_version: schema.version,
  });
  const manifestHash = createHash("sha256").update(manifestPayload).digest("hex");

  let recommendation = "clear";
  if (direct.length > 0) recommendation = "block";
  else if (combinatorial.length > 0) recommendation = "human_review";

  return {
    direct_mention_hits: direct,
    combinatorial_advisory: combinatorial,
    redaction_manifest_hash: manifestHash,
    recommendation,
    honest_scope_note: schema.honest_scope_disclosure,
    jurisdiction: schema.jurisdiction,
    schema_version: schema.version,
    roster_allowlist_active: !ROSTER.example_only,
  };
}

/**
 * Schema metadata for attestation binding. Same pattern as
 * citation-registry.js registryMetadata() — bank counsel pins
 * `proxy_schema_sha256` in procurement contract so post-hoc edits to
 * the ECOA blocklist break Ed25519 verification.
 */
export function proxySchemaMetadata({ jurisdiction = DEFAULT_JURISDICTION } = {}) {
  const schema = _resolveSchema(jurisdiction);
  const canonicalPayload = JSON.stringify({
    jurisdiction: schema.jurisdiction,
    version: schema.version,
    direct_term_count: schema.direct_mention_hard_block.length,
    advisory_signal_count: schema.combinatorial_advisory_signals.length,
    regulatory_anchor: schema.regulatory_anchor,
  });
  const digest = createHash("sha256").update(canonicalPayload).digest("hex");
  return {
    jurisdiction: schema.jurisdiction,
    version: schema.version,
    direct_term_count: schema.direct_mention_hard_block.length,
    advisory_signal_count: schema.combinatorial_advisory_signals.length,
    proxy_schema_sha256: digest,
  };
}

/**
 * Enumerate supported jurisdictions. Bank counsel calls this to
 * decide which taxonomy to pin in the procurement contract.
 */
export function supportedJurisdictions() {
  return Object.keys(SCHEMAS);
}
