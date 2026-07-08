// Citation registry helpers.
//
// Loads lib/schemas/citation-registry.json and exposes lookup +
// validation functions Shadow persona voices call to prove that a
// regulatory citation they emit is:
//
//   1. real (matches a registry entry), attack A1 defense
//   2. semantically valid for the AA code it claims to justify,
//      attack A2 defense (partial; full A2 defeat needs Loredana
//      counsel review loop, tracked separately)
//   3. current as of a given date, attack A3 defense (sunset check
//      catches stale citations like SR 11-7 after 2026-04-17)
//
// Also exposes registryMetadata() so /api/deliberate can bind the
// registry version into the Ed25519 attestation payload; post-hoc
// registry swap breaks verification the same way v1.5.8's
// dictionary_hash binding does for the reason-code dictionary.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REGISTRY_JSON_PATH = resolve(__dirname, "schemas", "citation-registry.json");

const REGISTRY = JSON.parse(readFileSync(REGISTRY_JSON_PATH, "utf8"));

export const CITATION_REGISTRY_VERSION = REGISTRY.version;
export const CITATIONS = REGISTRY.citations;
export const CITATION_ALIASES = REGISTRY.aliases;

/**
 * Normalize a raw citation string to its canonical registry ID.
 * Returns null if no match found.
 *
 * Handles: canonical IDs ("12CFR1002.9(b)(2)"), verbose forms
 * ("12 CFR § 1002.9(b)(2)"), Reg B shorthand, "ECOA §701", etc.
 */
export function normalizeCitation(rawCitation) {
  if (typeof rawCitation !== "string") return null;
  const trimmed = rawCitation.trim();
  if (trimmed.length === 0) return null;
  if (CITATIONS[trimmed]) return trimmed;
  if (CITATION_ALIASES[trimmed]) return CITATION_ALIASES[trimmed];
  return null;
}

/**
 * Attack A1 defense: is this citation a real registry entry?
 * Persona rationale that returns false gets REWORK not APPROVE.
 */
export function isValidCitation(rawCitation) {
  return normalizeCitation(rawCitation) !== null;
}

/**
 * Attack A2 defense: is this citation semantically valid for the
 * AA code claimed?
 *
 * A citation with valid_for_aa_codes: [] is a governance-only
 * citation (e.g. SR 26-2 general governance clause) and returns
 * false for any AA code check. Persona voices citing SR 26-2 as
 * the source for AA02 will fail this gate.
 *
 * Partial defense only. LLM can still cite a real section that
 * lists the right AA code as valid but interprets it wrong. Full
 * A2 defeat requires Loredana counsel-in-the-loop review flagged
 * via citation_reviewed_by field on the rationale object.
 */
export function isValidForAA(rawCitation, aa_code) {
  const canonicalId = normalizeCitation(rawCitation);
  if (!canonicalId) return false;
  const entry = CITATIONS[canonicalId];
  if (!entry) return false;
  if (!Array.isArray(entry.valid_for_aa_codes)) return false;
  if (entry.valid_for_aa_codes.length === 0) return false;
  return entry.valid_for_aa_codes.includes(aa_code);
}

/**
 * Attack A3 defense: is this citation still effective on the
 * given date? Rescinded/superseded citations (SR 11-7) return
 * false. Callers should use this to guard runtime rationale
 * generation so post-2026-04-17 SR 11-7 citations get REWORK.
 */
export function isCitationCurrent(rawCitation, asOfDate = new Date()) {
  const canonicalId = normalizeCitation(rawCitation);
  if (!canonicalId) return false;
  const entry = CITATIONS[canonicalId];
  if (!entry) return false;
  if (!entry.sunset) return true;
  const sunset = new Date(entry.sunset);
  if (Number.isNaN(sunset.getTime())) return true;
  return asOfDate < sunset;
}

/**
 * Full registry lookup. Returns entry metadata including verbatim
 * regulation snippet + source_url for a canonical ID or alias.
 * Returns null if not in registry.
 */
export function getCitation(rawCitation) {
  const canonicalId = normalizeCitation(rawCitation);
  if (!canonicalId) return null;
  return CITATIONS[canonicalId];
}

/**
 * List every registry entry valid for a given AA code, filtered
 * to current (non-sunset) entries. Used at runtime by
 * lib/run-loan-council.js to prompt-inject the allowed citation
 * set into the persona voice so the LLM cannot hallucinate a
 * regulation outside this list.
 */
export function citationsForAA(aa_code, asOfDate = new Date()) {
  return Object.values(CITATIONS).filter((entry) => {
    if (!entry.valid_for_aa_codes.includes(aa_code)) return false;
    if (!entry.sunset) return true;
    const sunset = new Date(entry.sunset);
    if (Number.isNaN(sunset.getTime())) return true;
    return asOfDate < sunset;
  });
}

/**
 * Every registry entry marked verbatim_verified true. Ships to
 * bank counsel as "these are the snippets you can grep for in
 * primary source." Entries with verbatim_verified false stay in
 * the registry for lookup but are excluded from external
 * procurement artifacts until Loredana reviews.
 */
export function verifiedCitations() {
  return Object.values(CITATIONS).filter(
    (entry) => entry.verbatim_verified === true
  );
}

/**
 * Registry metadata for attestation payload binding. Ships in
 * every /api/deliberate response and gets folded into the
 * Ed25519 signing payload, analogous to dictionary_hash from
 * v1.5.8. Post-hoc registry swap breaks signature verification.
 */
export function registryMetadata() {
  const entries = Object.values(CITATIONS);
  const canonicalSort = Object.keys(CITATIONS).sort();
  const canonicalDigest = createHash("sha256")
    .update(canonicalSort.join("|"))
    .update("|")
    .update(CITATION_REGISTRY_VERSION)
    .digest("hex");
  return {
    version: CITATION_REGISTRY_VERSION,
    entry_count: entries.length,
    alias_count: Object.keys(CITATION_ALIASES).length,
    verified_count: entries.filter((e) => e.verbatim_verified).length,
    sunset_count: entries.filter((e) => e.sunset).length,
    registry_sha256: canonicalDigest
  };
}
