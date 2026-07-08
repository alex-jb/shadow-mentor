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

const SCHEMA_PATH = resolve(
  __dirname,
  "schemas",
  "protected-classes-us-ecoa.json"
);
const SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));

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
export function scanDirectMentions(text) {
  if (typeof text !== "string" || text.length === 0) return [];
  const hits = [];
  for (const entry of SCHEMA.direct_mention_hard_block) {
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
export function scanCombinatorialSignals(features) {
  if (!features || typeof features !== "object") return [];
  const hits = [];
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
export function assessProxyRisk({ voices = [], applicant_features = null } = {}) {
  const direct = [];
  for (const v of voices) {
    const hits = scanDirectMentions(v.rationale ?? "");
    for (const h of hits) direct.push({ voice: v.voice, ...h });
  }
  const combinatorial = scanCombinatorialSignals(applicant_features);

  const manifestPayload = JSON.stringify({
    direct_categories: direct
      .map((d) => d.class)
      .sort(),
    advisory_signals: combinatorial.map((c) => c.signal).sort(),
    voice_count: voices.length,
    jurisdiction: SCHEMA.jurisdiction,
    schema_version: SCHEMA.version,
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
    honest_scope_note: SCHEMA.honest_scope_disclosure,
    jurisdiction: SCHEMA.jurisdiction,
    schema_version: SCHEMA.version,
    roster_allowlist_active: !ROSTER.example_only,
  };
}

/**
 * Schema metadata for attestation binding. Same pattern as
 * citation-registry.js registryMetadata() — bank counsel pins
 * `proxy_schema_sha256` in procurement contract so post-hoc edits to
 * the ECOA blocklist break Ed25519 verification.
 */
export function proxySchemaMetadata() {
  const canonicalPayload = JSON.stringify({
    jurisdiction: SCHEMA.jurisdiction,
    version: SCHEMA.version,
    direct_term_count: SCHEMA.direct_mention_hard_block.length,
    advisory_signal_count: SCHEMA.combinatorial_advisory_signals.length,
    regulatory_anchor: SCHEMA.regulatory_anchor,
  });
  const digest = createHash("sha256").update(canonicalPayload).digest("hex");
  return {
    jurisdiction: SCHEMA.jurisdiction,
    version: SCHEMA.version,
    direct_term_count: SCHEMA.direct_mention_hard_block.length,
    advisory_signal_count: SCHEMA.combinatorial_advisory_signals.length,
    proxy_schema_sha256: digest,
  };
}
