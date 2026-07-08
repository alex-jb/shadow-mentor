// Citation scanner. Walks a persona rationale (or any prose) and
// extracts regulatory citation candidates, tests each against the
// registry, and returns resolved + unresolved lists.
//
// Used by lib/run-loan-council.js to populate the response envelope
// `citation_check` field so bank counsel sees at audit time which
// rationales cite verified registry entries vs which cite something
// the registry couldn't resolve.
//
// Advisory-only for v1.5.18 (not REWORK-blocking). Collects the
// baseline. v1.5.19 candidate: promote unresolved to REWORK once we
// have per-persona base rates.

import { normalizeCitation, getCitation } from "./citation-registry.js";

// Match citation-shaped substrings in rationale prose. Permissive on
// purpose: we'd rather over-extract and let normalizeCitation reject
// false positives than miss a real citation.
const CITATION_PATTERNS = [
  // 12 CFR § 1002.9(b)(2), 15 U.S.C. § 1691(a), 31 CFR 1010.410
  /\b\d+\s*(?:CFR|U\.?S\.?C\.?)\s*§?\s*\d+(?:\.\d+)?(?:\([a-z0-9]+\))*/gi,
  // Reg B §1002.9(b)(2) or Reg B 1002.9
  /\bReg(?:ulation)?\s*B\s*§?\s*\d+\.\d+(?:\([a-z0-9]+\))*/gi,
  // ECOA §701
  /\bECOA\s*§?\s*\d+(?:\([a-z0-9]+\))?/gi,
  // SR 26-2, SR 26-2 Tier 3, SR 11-7
  /\bSR\s*\d+-\d+(?:\s*Tier\s*\d+)?/gi,
  // CFPB Circular 2023-03, CFPB Bulletin 2024-09
  /\bCFPB\s*(?:Circular|Bulletin)\s*\d{4}-\d{2}/gi,
  // Bare "Circular 2022-03" / "Bulletin 2024-09"
  /\b(?:Circular|Bulletin)\s*\d{4}-\d{2}/gi,
  // FFIEC IS Booklet
  /\bFFIEC\s+(?:IS\s+Booklet|Information\s+Security(?:\s+Booklet)?(?:\s*\d{4})?)/gi,
];

/**
 * Extract every citation-shaped substring from a piece of prose.
 * Duplicates removed while preserving first-seen order.
 */
export function extractCitationCandidates(text) {
  if (typeof text !== "string") return [];
  const seen = new Set();
  const out = [];
  for (const pattern of CITATION_PATTERNS) {
    const matches = text.match(pattern) ?? [];
    for (const m of matches) {
      const trimmed = m.trim();
      if (!seen.has(trimmed)) {
        seen.add(trimmed);
        out.push(trimmed);
      }
    }
  }
  return out;
}

/**
 * Walk a single rationale string and classify each citation
 * candidate as resolved (matched a registry entry) or unresolved
 * (looks like a citation but not in the registry).
 *
 * Returns:
 *   {
 *     resolved:   [{ raw, canonical_id, entry }],
 *     unresolved: [ raw ]
 *   }
 */
export function scanRationale(rationaleText) {
  const candidates = extractCitationCandidates(rationaleText);
  const resolved = [];
  const unresolved = [];
  for (const raw of candidates) {
    const canonicalId = normalizeCitation(raw);
    if (canonicalId) {
      resolved.push({
        raw,
        canonical_id: canonicalId,
        entry: getCitation(canonicalId),
      });
    } else {
      unresolved.push(raw);
    }
  }
  return { resolved, unresolved };
}

/**
 * Aggregate citation coverage over an array of voice objects
 * (as produced by lib/run-loan-council.js). Returns per-voice
 * breakdown plus totals.
 *
 *   by_voice: [{ voice, resolved_ids: [], resolved_count, unresolved: [] }]
 *   totals:   { resolved: N, unresolved: N, voices_with_unresolved: N }
 */
export function scanCouncilCoverage(voices) {
  if (!Array.isArray(voices)) {
    return { by_voice: [], totals: { resolved: 0, unresolved: 0, voices_with_unresolved: 0 } };
  }
  let totalResolved = 0;
  let totalUnresolved = 0;
  let voicesWithUnresolved = 0;
  const byVoice = voices.map((v) => {
    const scan = scanRationale(v.rationale ?? "");
    if (scan.unresolved.length > 0) voicesWithUnresolved += 1;
    totalResolved += scan.resolved.length;
    totalUnresolved += scan.unresolved.length;
    return {
      voice: v.voice,
      resolved_ids: scan.resolved.map((r) => r.canonical_id),
      resolved_count: scan.resolved.length,
      unresolved: scan.unresolved,
    };
  });
  return {
    by_voice: byVoice,
    totals: {
      resolved: totalResolved,
      unresolved: totalUnresolved,
      voices_with_unresolved: voicesWithUnresolved,
    },
  };
}
