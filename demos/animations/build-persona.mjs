// Deterministic builder for the persona-deliberation explainer. Emits the story fixture and injects it
// into the offline HTML (self-contained, zero drift). No live LLM. Personas are CONFIGURED ANALYTICAL
// PERSPECTIVES — not human experts; stance_strength is a persona prior, NOT statistical confidence.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
mkdirSync(join(ROOT, "fixtures/animations"), { recursive: true });

const shared_evidence = {
  "E-101": { en: "High revolving utilization", zh: "循环额度使用率高", quote: "revolving utilization 78% (policy pref ≤ 30%)" },
  "E-102": { en: "Verified income documentation", zh: "已核验收入文件", quote: "income verified via 2y W-2 + paystubs" },
  "E-103": { en: "Recent delinquency record", zh: "近期逾期记录", quote: "30-day delinquency 4 months ago" },
  "E-104": { en: "Long-standing customer relationship", zh: "长期客户关系", quote: "11-year relationship, prior loans repaid" },
  "E-105": { en: "Policy exception criteria", zh: "政策例外条件", quote: "exception §4.3 requires a compensating factor" },
};
const PERS = {
  CF: { en: "Credit Fundamentals", zh: "信贷基本面" }, RO: { en: "Risk Officer", zh: "风险官" },
  FL: { en: "Fair Lending Compliance", zh: "公平放贷合规" }, CA: { en: "Customer Advocate", zh: "客户倡导" },
  MC: { en: "Macro Contrarian", zh: "宏观逆向" },
};
// a persona output: perspective_id, claim_id, stance, stance_strength (persona prior — NOT confidence),
// supporting_evidence_ids, contradictory_evidence_ids, unsupported_claim_ids, abstain_reason, source_resolution_status
const O = (id, claim, stance, strength, support, extra = {}) => ({
  perspective_id: id, claim_id: `${id}-${claim}`, stance, stance_strength: strength,
  supporting_evidence_ids: support, contradictory_evidence_ids: extra.contra || [], unsupported_claim_ids: extra.unsupp || [],
  abstain_reason: extra.abstain || null, source_resolution_status: extra.badref ? "UNRESOLVED" : "RESOLVED", weak_evidence: !!extra.weak,
});

// baseline = consensus with evidence
const base = () => ([
  O("CF", "util-high", "CAUTION", 0.70, ["E-101"]),
  O("RO", "delinquency-risk", "CAUTION", 0.75, ["E-103"]),
  O("FL", "no-disparate-driver", "NEUTRAL", 0.60, ["E-105"]),
  O("CA", "relationship-mitigant", "SUPPORT", 0.50, ["E-104"]),
  O("MC", "macro-buffer", "CAUTION", 0.55, ["E-102"]),
]);
function scenarioOutputs(key) {
  const o = base();
  const by = (id) => o.find((x) => x.perspective_id === id);
  if (key === "disagreement") { by("CA").stance = "SUPPORT"; by("CA").stance_strength = 0.8; by("RO").stance = "OPPOSE"; by("RO").supporting_evidence_ids = ["E-104"]; } // same E-104, opposite stance
  if (key === "unsupported_claim") { const mc = by("MC"); mc.claim_id = "MC-approve-anyway"; mc.stance = "SUPPORT"; mc.supporting_evidence_ids = []; mc.unsupported_claim_ids = ["MC-approve-anyway"]; }
  if (key === "contradictory_evidence") { by("CA").contradictory_evidence_ids = ["E-103"]; by("RO").contradictory_evidence_ids = ["E-104"]; }
  if (key === "abstain") { const fl = by("FL"); fl.abstain_reason = "Insufficient verified evidence to assess disparate impact."; fl.supporting_evidence_ids = []; }
  if (key === "majority_weak_evidence") { for (const id of ["CF", "RO", "CA", "MC"]) { const p = by(id); p.stance = "SUPPORT"; p.supporting_evidence_ids = ["E-104"]; p.weak_evidence = true; } by("FL").stance = "NEUTRAL"; }
  return o;
}
const SCEN = {
  consensus_with_evidence: { label_en: "Consensus with evidence", label_zh: "有证据的共识", first_warning: null },
  disagreement: { label_en: "Disagreement", label_zh: "分歧", first_warning: "MAJORITY_AGREEMENT" },
  unsupported_claim: { label_en: "Unsupported claim", label_zh: "无证据主张", first_warning: "UNSUPPORTED_CLAIMS" },
  contradictory_evidence: { label_en: "Contradictory evidence", label_zh: "矛盾证据", first_warning: "CONTRADICTORY_EVIDENCE" },
  abstain: { label_en: "Abstain — insufficient evidence", label_zh: "弃权——证据不足", first_warning: "ABSTENTION" },
  majority_weak_evidence: { label_en: "Majority but weak evidence", label_zh: "多数但证据弱", first_warning: "CLAIM_EVIDENCE_BINDING" },
};
const CHECKS = ["SHARED_SOURCE_EVIDENCE", "SOURCE_RESOLUTION", "PERSONA_OUTPUT_INTEGRITY", "CLAIM_EVIDENCE_BINDING", "UNSUPPORTED_CLAIMS", "CONTRADICTORY_EVIDENCE", "ABSTENTION", "SYNTHESIS_PROVENANCE", "MAJORITY_AGREEMENT", "ANALYTICAL_CORRECTNESS", "LEGAL_FAIRNESS_REVIEW", "HUMAN_APPROVAL"];

const scenarios = {};
for (const k of Object.keys(SCEN)) scenarios[k] = { ...SCEN[k], outputs: scenarioOutputs(k) };

const fixture = {
  story_version: "shadow-explainer-story/1", fixture_status: "FIXTURE",
  fixture_note: "DEMONSTRATION FIXTURE — configured analytical perspectives, not human experts; not bank policy.",
  shared_evidence, personas: PERS, checks: CHECKS, scenarios,
  accessibility_descriptions: { majority: "Majority agreement is descriptive metadata only; it does not set analytical correctness.", human: "Human approval is not present; regulated outcomes require human review." },
};
writeFileSync(join(ROOT, "fixtures/animations/persona-deliberation.json"), JSON.stringify(fixture, null, 2) + "\n");

const htmlPath = join(HERE, "persona-deliberation.html");
let html = readFileSync(htmlPath, "utf8");
html = html.replace(/const FIX = [\s\S]*?\/\*__END_FIX__\*\/;/, `const FIX = ${JSON.stringify(fixture)}; /*__END_FIX__*/;`);
writeFileSync(htmlPath, html);
console.log("persona fixture built + injected; scenarios:", Object.keys(scenarios).join(","));
