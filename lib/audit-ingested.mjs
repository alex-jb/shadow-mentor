// Audit an UNTRUSTED third-party / LLM output. This is the differentiator: Shadow's other
// audit primitives run on its own deterministic templates (which are correct by
// construction — circular). This one runs on someone else's agent output, which may be
// wrong, ungrounded, stale, or adversarial. External content is treated as DATA, never as
// instructions. No citation passes merely because its format is valid — it must resolve to
// a current reference AND be grounded in a provided source.
import { extractCitationCandidates } from "./citation-scanner.js";
import { normalizeCitation, isCitationCurrent } from "./citation-registry.js";
import { scanDirectMentions } from "./proxy-detector.js";
import { adverseImpactRatio } from "./disparity/index.js";
import { createGraph, addNode, addEdge, graphSha256 } from "./claim-evidence-graph.mjs";

export const INGEST_AUDIT_VERSION = "shadow-ingested-audit/1.0";

// per-claim verdicts
export const CLAIM_STATUS = Object.freeze(["SUPPORTED", "PARTIAL", "UNSUPPORTED", "STALE", "UNRESOLVED"]);

const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+|any\s+|the\s+)?(?:previous|prior|above)\s+instructions/i,
  /disregard[^.]{0,30}(above|previous|system|prior)/i,
  /\byou are now\b/i,
  /\bsystem prompt\b/i,
  /reveal[^.]{0,24}(system|prompt|instructions|keys?)/i,
  /<\|im_start\|>|<\|system\|>|\[\/?INST\]/i,
  /run (the )?following (command|code|tool|shell)/i,
  /\bexfiltrat/i,
];

function detectInjection(output, retrievedSources) {
  const hits = [];
  const scan = (text, where) => {
    for (const re of INJECTION_PATTERNS) if (re.test(text || "")) hits.push({ where, pattern: re.source });
  };
  scan(output, "output");
  for (const s of retrievedSources || []) scan(typeof s === "string" ? s : s.text || s.label || "", `source:${s.id || s.label || "?"}`);
  return hits;
}

function validateSchema(input) {
  const errors = [];
  if (!input || typeof input !== "object") return { ok: false, errors: ["input must be an object"] };
  if (typeof input.output !== "string" || !input.output.trim()) errors.push("output (non-empty string) required");
  if (input.retrievedSources && !Array.isArray(input.retrievedSources)) errors.push("retrievedSources must be an array");
  if (input.claims && !Array.isArray(input.claims)) errors.push("claims must be an array");
  return { ok: errors.length === 0, errors };
}

// If caller supplies claims, use them; else segment the output into sentence-claims.
function extractClaims(input) {
  if (Array.isArray(input.claims) && input.claims.length) {
    return input.claims.map((c, i) => (typeof c === "string" ? { id: `c${i}`, text: c } : { id: c.id || `c${i}`, text: c.text || "" }));
  }
  return (input.output.match(/[^.!?\n]+[.!?]?/g) || [])
    .map((s) => s.trim()).filter((s) => s.length > 3)
    .map((text, i) => ({ id: `c${i}`, text }));
}

// A claim REQUIRES a citation if it asserts a regulatory reference or a specific
// quantitative threshold (a number/percent). Opinions don't require one.
function requiresCitation(text) {
  if (extractCitationCandidates(text).length) return true;
  return /\b\d+(\.\d+)?\s?%|\b(FICO|DTI|LTV|VaR|ratio|threshold|score)\b/i.test(text);
}

function sourceGrounds(citationRaw, canonical, retrievedSources) {
  const needle = (canonical || citationRaw || "").toLowerCase();
  if (!needle) return false;
  return (retrievedSources || []).some((s) => {
    const hay = (typeof s === "string" ? s : `${s.id || ""} ${s.label || ""} ${s.text || ""}`).toLowerCase();
    return hay.includes(needle) || hay.includes(citationRaw.toLowerCase());
  });
}

function assessClaim(claim, retrievedSources, asOf) {
  const cites = extractCitationCandidates(claim.text);
  const needsCite = requiresCitation(claim.text);

  if (!cites.length) {
    // requires a citation but gives none → UNSUPPORTED; else a non-factual claim → PARTIAL
    return { ...claim, status: needsCite ? "UNSUPPORTED" : "PARTIAL", requires_citation: needsCite, citations: [], reason: needsCite ? "factual/quantitative claim with no citation" : "no citation required; not independently grounded" };
  }

  // evaluate each cited reference; take the worst status (a valid format never rescues a bad cite)
  let worst = "SUPPORTED";
  const rank = { SUPPORTED: 0, PARTIAL: 1, STALE: 2, UNRESOLVED: 3, UNSUPPORTED: 4 };
  const perCite = cites.map((raw) => {
    const canonical = normalizeCitation(raw);
    let status;
    if (!canonical) status = "UNRESOLVED";
    else if (!isCitationCurrent(raw, asOf ?? new Date("2026-07-21T00:00:00Z"))) status = "STALE";
    else status = sourceGrounds(raw, canonical, retrievedSources) ? "SUPPORTED" : "PARTIAL";
    if (rank[status] > rank[worst]) worst = status;
    return { raw, canonical, status };
  });
  return { ...claim, status: worst, requires_citation: needsCite, citations: perCite };
}

function decide({ quarantined, claimResults, proxyHits }) {
  const reasons = [];
  const proxyN = Array.isArray(proxyHits) ? proxyHits.length : 0;
  if (quarantined) reasons.push("prompt-injection quarantined");
  if (proxyN) reasons.push(`ECOA §701 direct proxy mention (${proxyN})`);
  const has = (s) => claimResults.some((c) => c.status === s);
  if (has("UNSUPPORTED")) reasons.push("ungrounded claim(s)");
  if (has("STALE")) reasons.push("stale citation(s)");
  if (quarantined || proxyN || has("UNSUPPORTED") || has("STALE")) return { action: "escalate", reasons };
  if (has("UNRESOLVED")) return { action: "abstain", reasons: [...reasons, "unresolved citation(s)"] };
  return { action: "seal", reasons: reasons.length ? reasons : ["all claims supported or acknowledged"] };
}

function sealGraph(input, claims, claimResults) {
  const g = createGraph();
  addNode(g, { id: "src:ingested", type: "source", label: `${input.provider || "external"}/${input.model || "unknown"}`, prompt_sha256: input.promptHash || null });
  addNode(g, { id: "snap:ingested", type: "snapshot", label: "Ingested output snapshot" });
  addEdge(g, { type: "DERIVED_FROM", from: "snap:ingested", to: "src:ingested" });
  for (const s of input.retrievedSources || []) {
    const id = `ev:${s.id || s.label || Math.abs(hash(String(s))) }`;
    if (!g.nodes.some((n) => n.id === id)) { addNode(g, { id, type: "evidence", label: (s.label || s.id || "source").slice(0, 80) }); addEdge(g, { type: "DERIVED_FROM", from: id, to: "snap:ingested" }); }
  }
  claimResults.forEach((c, i) => {
    const cid = `claim:${c.id || i}`;
    addNode(g, { id: cid, type: "claim", label: c.text.slice(0, 80), status: c.status });
    for (const cite of c.citations || []) {
      const evId = `ev:${(cite.canonical || cite.raw || "cite").replace(/[^A-Za-z0-9]+/g, "-")}`;
      if (!g.nodes.some((n) => n.id === evId)) { addNode(g, { id: evId, type: "evidence", label: cite.raw.slice(0, 80) }); addEdge(g, { type: "DERIVED_FROM", from: evId, to: "snap:ingested" }); }
      if (cite.status === "SUPPORTED" || cite.status === "PARTIAL") addEdge(g, { type: "SUPPORTS", from: evId, to: cid });
      else addEdge(g, { type: "CONTRADICTS", from: evId, to: cid });
    }
  });
  return g;
}

function rollup(claimResults, quarantined) {
  if (quarantined) return "UNSUPPORTED";
  const order = ["SUPPORTED", "PARTIAL", "STALE", "UNRESOLVED", "UNSUPPORTED"];
  let worst = "SUPPORTED";
  for (const c of claimResults) if (order.indexOf(c.status) > order.indexOf(worst)) worst = c.status;
  return worst;
}

function computeDisparity(groupOutcomes) {
  try {
    return { adverse_impact_ratio: adverseImpactRatio(groupOutcomes.protected, groupOutcomes.reference) };
  } catch (e) { return { error: String(e.message || e) }; }
}

function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return h; }

export function auditIngestedOutput(input) {
  const schema = validateSchema(input);
  if (!schema.ok) return { version: INGEST_AUDIT_VERSION, decision: { action: "reject", reasons: schema.errors }, overall: "UNSUPPORTED" };

  const untrusted = { channel: "data", executed: false, note: "EXTERNAL CONTENT — NEVER EXECUTE AS INSTRUCTION" };
  const injectionHits = detectInjection(input.output, input.retrievedSources);
  const quarantined = injectionHits.length > 0;

  const claims = extractClaims(input);
  const asOf = input.timestamps?.output_time ? new Date(input.timestamps.output_time) : undefined;
  const claimResults = claims.map((c) => assessClaim(c, input.retrievedSources || [], asOf));

  const proxyHits = scanDirectMentions(input.output, { jurisdiction: input.jurisdiction || "US-ECOA" });
  const disparity = input.groupOutcomes ? computeDisparity(input.groupOutcomes) : null;
  const decision = decide({ quarantined, claimResults, proxyHits });
  const graph = sealGraph(input, claims, claimResults);

  return {
    version: INGEST_AUDIT_VERSION,
    untrusted,
    injection: { quarantined, hits: injectionHits },
    claims: claimResults,
    proxy_direct_mentions: Array.isArray(proxyHits) ? proxyHits : [],
    disparity,
    decision,
    sealed_sha256: graphSha256(graph),
    overall: rollup(claimResults, quarantined),
  };
}
