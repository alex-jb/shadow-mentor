// apps/shadow-lens/flow/flow-presentation-mapping.mjs
// Shadow → Flow PRESENTATION mapping (spike, offline, deterministic).
//
// Composes three EXISTING sources of truth into one Flow-ready presentation model for the
// canonical banking audit case — it invents nothing:
//   1. fixtures/banking-narrative.mjs            (case, council, metrics, evidence, decision)
//   2. fixtures/guided-stories/audit-chain.guided-story.json
//                                                (7-node evidence lineage, pristine + tamper_seq_3
//                                                 scenarios, first_failure + affected_downstream)
//   3. lib/shadow-semantic-vocabulary.mjs        (bilingual status labels, severity families,
//                                                 forbidden mappings)
//
// Flow VISUALIZES this model; Shadow remains the analysis + evidence authority. Nothing here
// recomputes a council stance, a verdict, or a verification result — every status is copied from
// the fixtures. The tabular export reuses the existing versioned contract
// (shadow-flow-export/1.0, flow-export-contract.mjs); the node/edge layer here is a presentation
// EXTENSION carrying spatial grouping + bilingual labels, versioned separately so the 1.0 row
// contract does not drift.
//
// Deterministic + offline + non-secret: no Date.now / Math.random, no network, no credentials,
// no absolute paths. generated_at is the fixture timestamp.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { BANKING_NARRATIVE } from "../fixtures/banking-narrative.mjs";
import { exportFlowContract, FLOW_EXPORT_VERSION } from "./flow-export-contract.mjs";
import { SEMANTIC_STATUS } from "../../../lib/shadow-semantic-vocabulary.mjs";

export const FLOW_PRESENTATION_VERSION = "shadow-flow-presentation/1.0";

const __dir = dirname(fileURLToPath(import.meta.url));
const AUDIT_CHAIN_STORY_PATH = join(__dir, "../../../fixtures/guided-stories/audit-chain.guided-story.json");

export function loadAuditChainStory() {
  return JSON.parse(readFileSync(AUDIT_CHAIN_STORY_PATH, "utf8"));
}

// The scenario the demo presents as its hero beat. The pristine scenario is also carried so the
// storyboard can open clean and then show the tamper cascade.
export const PRESENTED_SCENARIO = "tamper_seq_3";

// severity family for a SEMANTIC_STATUS id; council/case elements use their own mapping below.
const family = (statusId) => SEMANTIC_STATUS[statusId]?.severity ?? "info";

// council vote → severity family (presentation only; the stance text itself is the status).
const VOTE_FAMILY = { agree: "pass", challenge: "warn", abstain: "abstain" };

// Presentation groups (the spatial narrative):
//   center            — First Failure
//   left-case         — case + source evidence
//   ring-council      — council roles + conclusions
//   right-downstream  — downstream consequences, human review, approval
//   path-lineage      — ordered evidence lineage (bottom / connected path)
//   verification-area — hash-chain / attestation / offline verifier / device boundary
export function buildFlowPresentationMapping() {
  const n = BANKING_NARRATIVE;
  const story = loadAuditChainStory();
  const tamper = story.scenarios.find((s) => s.id === PRESENTED_SCENARIO);
  const pristine = story.scenarios.find((s) => s.id === "pristine");
  const firstFailureId = tamper.first_failure;
  const downstream = tamper.affected_downstream;

  const nodes = [];
  const edges = [];
  const refs = (extra = {}) => ({
    first_failure_ref: firstFailureId,
    human_review_ref: "presentation:human-review",
    approval_ref: "presentation:approval",
    verification_ref: "presentation:verify-hash-chain",
    ...extra,
  });

  // ── left-case: the case card + source evidence items ───────────────────────
  nodes.push({
    id: "presentation:case-card",
    type: "case",
    label_en: `${n.case_display.title} — ${n.case_display.number} — ${n.case_display.amount}`,
    label_zh: `中型市场贷款 — ${n.case_display.number} — 请求金额 $8.4M`,
    status: "PRESENT",
    status_family: family("PRESENT"),
    group: "left-case",
    source_ref: "fixtures/banking-narrative.mjs#case_display",
    refs: refs(),
  });
  for (const e of n.evidence) {
    nodes.push({
      id: `evidence:${e.evidence_id}`,
      type: "evidence_item",
      label_en: e.label,
      label_zh: zhEvidence(e.evidence_id, e.label),
      status: "VERIFIED",
      status_family: family("VERIFIED"),
      group: "left-case",
      source_ref: `fixtures/banking-narrative.mjs#evidence.${e.evidence_id}`,
      refs: refs(),
    });
  }

  // ── ring-council: five voices, statuses copied from the fixture ────────────
  for (const c of n.council) {
    const id = `council:${slug(c.voice)}`;
    nodes.push({
      id,
      type: "council_voice",
      label_en: `${c.voice} — ${c.stance} (${c.confidence.toFixed(2)})`,
      label_zh: `${zhVoice(c.voice)} — ${zhStance(c.stance)}(置信度 ${c.confidence.toFixed(2)})`,
      status: c.stance,
      status_family: VOTE_FAMILY[c.vote] ?? "info",
      group: "ring-council",
      source_ref: `fixtures/banking-narrative.mjs#council.${c.voice}`,
      refs: refs(),
    });
  }
  // council relationship edges come from the fixture verbatim (cites / disagrees).
  for (const r of n.relationships) {
    const from = r.from.startsWith("B0") ? `evidence:${r.from}` : `council:${slug(r.from)}`;
    const to = r.to.startsWith("B0") ? `evidence:${r.to}` : `council:${slug(r.to)}`;
    edges.push({ id: `edge:${slug(r.from)}-${r.type}-${slug(r.to)}`, from, to, type: r.type, category: "council" });
  }

  // ── path-lineage: the 7-node ordered evidence lineage (statuses per scenario)
  for (const ent of story.entities) {
    const st = tamper.entity_status[ent.id];
    nodes.push({
      id: ent.id,
      type: ent.kind,
      sequence: ent.sequence,
      label_en: ent.label.en,
      label_zh: ent.label.zh,
      status: st,
      status_family: family(st),
      status_by_scenario: { pristine: pristine.entity_status[ent.id], [PRESENTED_SCENARIO]: st },
      group: ent.id === firstFailureId ? "center" : "path-lineage",
      source_ref: `fixtures/guided-stories/audit-chain.guided-story.json#${ent.id}`,
      refs: refs({
        is_first_failure: ent.id === firstFailureId,
        is_affected_downstream: downstream.includes(ent.id),
      }),
    });
  }
  for (const rel of story.relations) {
    edges.push({ id: `edge:${rel.id}`, from: rel.from, to: rel.to, type: rel.type, category: "lineage" });
  }
  // explicit first-failure / downstream presentation edges (category only — semantics stay in the
  // scenario lists; no new audit vocabulary is invented).
  for (const d of downstream) {
    edges.push({ id: `edge:downstream:${slug(d)}`, from: d, to: firstFailureId, type: "DERIVED_FROM", category: "downstream" });
  }

  // ── right-downstream: decision consequence, human review, approval ─────────
  nodes.push({
    id: "presentation:decision",
    type: "recommendation",
    label_en: `Council recommendation: ${n.decision.recommendation} (dissent ${n.decision.dissent}/5)`,
    label_zh: `Council 建议:${n.decision.recommendation}(异议 ${n.decision.dissent}/5)`,
    status: "REQUIRES_HUMAN_REVIEW",
    status_family: family("REQUIRES_HUMAN_REVIEW"),
    group: "right-downstream",
    source_ref: "fixtures/banking-narrative.mjs#decision",
    refs: refs(),
  });
  nodes.push({
    id: "presentation:human-review",
    type: "human_review",
    label_en: SEMANTIC_STATUS.REQUIRES_HUMAN_REVIEW.text_en + " — routed to a person",
    label_zh: SEMANTIC_STATUS.REQUIRES_HUMAN_REVIEW.text_zh + "——已转交人工",
    status: "REQUIRES_HUMAN_REVIEW",
    status_family: family("REQUIRES_HUMAN_REVIEW"),
    group: "right-downstream",
    source_ref: "fixtures/banking-narrative.mjs#decision.recommendation=REVIEW",
    refs: refs(),
  });
  nodes.push({
    id: "presentation:approval",
    type: "human_approval",
    label_en: "Human approval: NOT PRESENT in this fixture (distinct from review)",
    label_zh: "人工批准:本 fixture 中不存在(与人工复核是两回事)",
    status: "NOT_PRESENT",
    status_family: family("NOT_PRESENT"),
    group: "right-downstream",
    source_ref: "lib/shadow-semantic-vocabulary.mjs#TRUST_DIMENSIONS.HUMAN_APPROVAL",
    refs: refs(),
  });
  edges.push({ id: "edge:decision-review", from: "presentation:decision", to: "presentation:human-review", type: "BINDS", category: "human_review" });
  edges.push({ id: "edge:review-approval", from: "presentation:human-review", to: "presentation:approval", type: "BINDS", category: "approval" });

  // ── verification-area: independent of the business conclusion ──────────────
  const verify = [
    ["presentation:verify-hash-chain", "HASH_CHAIN", tamper.dimension_status.HASH_CHAIN],
    ["presentation:verify-record-integrity", "RECORD_INTEGRITY", tamper.dimension_status.RECORD_INTEGRITY],
    ["presentation:verify-signature", "DIGITAL_SIGNATURE", tamper.dimension_status.DIGITAL_SIGNATURE],
    ["presentation:verify-analytical", "ANALYTICAL_CORRECTNESS", tamper.dimension_status.ANALYTICAL_CORRECTNESS],
  ];
  for (const [id, dim, st] of verify) {
    nodes.push({
      id,
      type: "verification",
      label_en: `${dim.replaceAll("_", " ")}: ${SEMANTIC_STATUS[st].text_en}`,
      label_zh: `${zhDim(dim)}:${SEMANTIC_STATUS[st].text_zh}`,
      status: st,
      status_family: family(st),
      status_by_scenario: { pristine: pristine.dimension_status[dim], [PRESENTED_SCENARIO]: st },
      group: "verification-area",
      source_ref: `fixtures/guided-stories/audit-chain.guided-story.json#scenarios.${PRESENTED_SCENARIO}.dimension_status.${dim}`,
      refs: refs(),
    });
    edges.push({ id: `edge:verify:${slug(dim)}`, from: id, to: firstFailureId, type: "ATTESTS", category: "verification" });
  }
  nodes.push({
    id: "presentation:attestation",
    type: "attestation",
    label_en: `Attestation status: ${n.decision.signed_result_status} (${n.decision.audit_reference})`,
    label_zh: `签章状态:${n.decision.signed_result_status}(${n.decision.audit_reference})`,
    status: "PRESENT",
    status_family: family("PRESENT"),
    group: "verification-area",
    source_ref: "fixtures/banking-narrative.mjs#decision.signed_result_status",
    refs: refs(),
  });
  nodes.push({
    id: "presentation:device-boundary",
    type: "capability_disclaimer",
    label_en: "SIMULATION — Flow visualization of a Shadow fixture; no physical Shadow Lens capability is claimed",
    label_zh: "模拟——Flow 对 Shadow fixture 的可视化;不声称任何 Shadow Lens 实体设备能力",
    status: "NOT_EVALUATED",
    status_family: family("NOT_EVALUATED"),
    group: "verification-area",
    source_ref: "reports/flow-v11/shadow-flow-demo-manifest.json#capability",
    refs: refs(),
  });

  return {
    presentation_version: FLOW_PRESENTATION_VERSION,
    export_contract: FLOW_EXPORT_VERSION,
    case_id: n.case_id,
    generated_at: n.fixture_timestamp,
    mode_label: n.decision.mode_label,           // FIXTURE MODEL — honesty label, carried everywhere
    presented_scenario: PRESENTED_SCENARIO,
    scenarios: {
      pristine: { entity_status: pristine.entity_status, dimension_status: pristine.dimension_status, first_failure: null, affected_downstream: [] },
      [PRESENTED_SCENARIO]: { entity_status: tamper.entity_status, dimension_status: tamper.dimension_status, first_failure: firstFailureId, affected_downstream: downstream },
    },
    first_failure: firstFailureId,
    affected_downstream: downstream,
    nodes,
    edges,
  };
}

// The portable demo package: the EXISTING 1.0 row export + the presentation extension + manifest.
export function buildFlowDemoPackage() {
  const mapping = buildFlowPresentationMapping();
  const rowExport = exportFlowContract(BANKING_NARRATIVE);
  const nodesCsv = toCsv(
    ["id", "type", "sequence", "label_en", "label_zh", "status", "status_family", "group", "source_ref", "is_first_failure", "is_affected_downstream"],
    mapping.nodes.map((n) => ({
      ...n,
      sequence: n.sequence ?? "",
      is_first_failure: n.refs.is_first_failure === true,
      is_affected_downstream: n.refs.is_affected_downstream === true,
    })),
  );
  const edgesCsv = toCsv(["id", "from", "to", "type", "category"], mapping.edges);
  const manifest = {
    package: "shadow-flow-demo-package",
    presentation_version: FLOW_PRESENTATION_VERSION,
    export_contract: FLOW_EXPORT_VERSION,
    shadow_source_commit: "84561eb",
    fixture_id: BANKING_NARRATIVE.case_id,
    guided_story_id: "audit-chain",
    language_support: ["en", "zh"],
    generated_at: BANKING_NARRATIVE.fixture_timestamp,   // deterministic fixture timestamp
    network_used: false,
    physical_device_validated: false,
    mode_label: BANKING_NARRATIVE.decision.mode_label,
    provenance: {
      narrative: "apps/shadow-lens/fixtures/banking-narrative.mjs",
      lineage: "fixtures/guided-stories/audit-chain.guided-story.json",
      vocabulary: "lib/shadow-semantic-vocabulary.mjs",
      row_contract: "apps/shadow-lens/flow/flow-export-contract.mjs",
    },
    verification_summary: {
      pristine: { HASH_CHAIN: "VERIFIED", RECORD_INTEGRITY: "VERIFIED", ANALYTICAL_CORRECTNESS: "NOT_EVALUATED" },
      tamper_seq_3: { HASH_CHAIN: "FAILED", RECORD_INTEGRITY: "FAILED", first_failure: mapping.first_failure, affected_downstream: mapping.affected_downstream },
      note: "Verification statuses are copied from Shadow fixtures; Flow must display, never recompute them.",
    },
    capability: {
      claim: "Flow is the visualization layer only. Shadow is the analysis, audit, and evidence authority.",
      not_claimed: [
        "native Shadow Lens APK success",
        "MyGlasses MR package handoff resolution",
        "physical XREAL / Beam Pro validation of this Flow scene",
        "a live Flow API import (no credentials; offline package only)",
      ],
    },
    counts: { nodes: mapping.nodes.length, edges: mapping.edges.length, export_rows: rowExport.row_count },
  };
  return { mapping, rowExport, nodesCsv, edgesCsv, manifest };
}

// ── helpers (presentation-local; bilingual strings for fixture-only vocabulary) ─
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

function toCsv(columns, rows) {
  const cell = (v) => (v === undefined || v === null ? "" : JSON.stringify(v));
  const lines = [columns.join(",")];
  for (const r of rows) lines.push(columns.map((c) => cell(r[c])).join(","));
  return lines.join("\n") + "\n";
}

function zhEvidence(id, label) {
  const zh = { B0L0: "年收入:$82,400", B0L1: "债务收入比:0.41", B0L2: "政策上限:0.36" };
  return zh[id] ?? label;
}
function zhVoice(v) {
  const zh = {
    "Credit Fundamentals": "信贷基本面", "Risk Officer": "风险官", "Fair Lending Compliance": "公平信贷合规",
    "Customer Advocate": "客户代表", "Macro Contrarian": "宏观反方",
  };
  return zh[v] ?? v;
}
function zhStance(s) {
  const zh = {
    "approve-with-conditions": "有条件批准", caution: "谨慎", "no-disparate-impact": "无差别性影响",
    "support-with-structure": "支持但需重组", abstain: "弃权",
  };
  return zh[s] ?? s;
}
function zhDim(d) {
  const zh = {
    HASH_CHAIN: "哈希链", RECORD_INTEGRITY: "记录完整性", DIGITAL_SIGNATURE: "数字签名",
    ANALYTICAL_CORRECTNESS: "分析正确性",
  };
  return zh[d] ?? d;
}
