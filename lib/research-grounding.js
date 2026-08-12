// lib/research-grounding.js
// ─────────────────────────────────────────────────────────────────
// The deterministic backbone of the shadow-deep-research skill: take a research
// memo's prose and label every citation it makes against the checked-in citation
// registry — IN_FORCE, WITHDRAWN (with the sunset date), or EVIDENCE_INSUFFICIENT
// (looks like a citation but does not resolve to any registry entry).
//
// This turns the skill's promise ("cite only what resolves; never invent") from a
// prompt instruction into a mechanical gate that reuses the same registry the
// loan council prompt-injects (lib/citation-registry.js) — so a memo and the
// runtime council can never disagree about whether an authority is current.
//
// Reuses lib/citation-scanner.js (candidate extraction + registry resolution) and
// lib/citation-registry.js (sunset-aware currency). Adds only the memo-level
// hygiene the scanner leaves to the caller: drop fragment/substring artifacts and
// non-citation noise so EVIDENCE_INSUFFICIENT flags real invented citations, not
// scanner splinters.
// ─────────────────────────────────────────────────────────────────

import { scanRationale } from "./citation-scanner.js";
import { isCitationCurrent } from "./citation-registry.js";

// A candidate only counts as an ungrounded CITATION if it carries a recognizable
// citation-form marker. This drops scanner splinters like "ECOA 15" (a word + a
// number with no CFR / U.S.C. / Circular / SR / § / C-<n> marker) while keeping
// genuinely-invented citations like "12 CFR 9999.1" or "CFPB Circular 2099-01".
const CITATION_MARKER = /\bCFR\b|U\.?\s?S\.?\s?C\.?|Circular|Bulletin|\bSR[\s-]?\d|§|\bC-\d/i;

/**
 * @param {string} memoText
 * @param {object} [opts]
 * @param {Date}   [opts.asOfDate] — currency reference (default now)
 * @returns {{
 *   in_force:   {raw, id, source_url}[],
 *   withdrawn:  {raw, id, sunset, source_url}[],
 *   ungrounded: string[],
 *   ok: boolean,          // true iff no ungrounded (invented) citation
 *   summary: {in_force:number, withdrawn:number, ungrounded:number}
 * }}
 */
export function groundResearchMemo(memoText, { asOfDate = new Date() } = {}) {
  const { resolved, unresolved } = scanRationale(typeof memoText === "string" ? memoText : "");

  const in_force = [];
  const withdrawn = [];
  for (const r of resolved) {
    const e = r.entry || {};
    if (isCitationCurrent(r.canonical_id, asOfDate)) {
      in_force.push({ raw: r.raw, id: r.canonical_id, source_url: e.source_url ?? null });
    } else {
      withdrawn.push({ raw: r.raw, id: r.canonical_id, sunset: e.sunset ?? null, source_url: e.source_url ?? null });
    }
  }

  const resolvedRaws = resolved.map((r) => r.raw);
  // Keep an unresolved candidate only if it (a) looks like a citation, (b) is not a
  // fragment of a resolved citation, and (c) is not a fragment of a longer unresolved
  // candidate. Longest-first so the fragment check drops the shorter overlaps.
  const marked = unresolved.filter((u) => CITATION_MARKER.test(u));
  const bySizeDesc = [...marked].sort((a, b) => b.length - a.length);
  const ungrounded = [];
  for (const u of bySizeDesc) {
    const isFragmentOfResolved = resolvedRaws.some((r) => r !== u && r.includes(u));
    const isFragmentOfKept = ungrounded.some((k) => k !== u && k.includes(u));
    if (!isFragmentOfResolved && !isFragmentOfKept) ungrounded.push(u);
  }
  // Restore document order for stable output.
  ungrounded.sort((a, b) => memoText.indexOf(a) - memoText.indexOf(b));

  return {
    in_force,
    withdrawn,
    ungrounded,
    ok: ungrounded.length === 0,
    summary: { in_force: in_force.length, withdrawn: withdrawn.length, ungrounded: ungrounded.length },
  };
}
