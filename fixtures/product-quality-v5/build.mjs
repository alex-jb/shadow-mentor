// Deterministic generator for the product-quality-v5 guided stories — deeper, genuinely
// domain-different fixtures (not recolored): Banking, Data Science, and Coding, each using its own
// entity kinds + relations, with pristine + tampered variants, a human-review boundary, and a
// limitation case (missing/contradictory evidence, drift, or a failing test). Sanitized, no private
// data. Validates every status/dimension/kind against the vocabulary as it builds. Run:
//   node fixtures/product-quality-v5/build.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isStatus, isTrustDimension, isEntityKind, isRelationType } from "../../lib/shadow-semantic-vocabulary.mjs";

const OUT = dirname(fileURLToPath(import.meta.url));
mkdirSync(OUT, { recursive: true });
const write = (name, o) => writeFileSync(join(OUT, name), JSON.stringify(o, null, 2) + "\n");
const bi = (en, zh) => ({ en, zh });

function E(id, kind, seq, en, zh, extra = {}) {
  if (!isEntityKind(kind)) throw new Error(`kind ${kind}`);
  if (extra.trust_dimension && !isTrustDimension(extra.trust_dimension)) throw new Error(`dim ${extra.trust_dimension}`);
  return { id, kind, sequence: seq, label: bi(en, zh), a11y: bi(`${kind} seq ${seq}: ${en}`, `序号 ${seq} 的${kind}:${zh}`), ...extra };
}
function R(id, type, from, to) { if (!isRelationType(type)) throw new Error(`rel ${type}`); return { id, type, from, to }; }
function S(map) { for (const v of Object.values(map)) if (!isStatus(v)) throw new Error(`status ${v}`); return map; }
function D(map) { for (const [k, v] of Object.entries(map)) { if (!isTrustDimension(k)) throw new Error(`dim ${k}`); if (!isStatus(v)) throw new Error(`status ${v}`); } return map; }

// chain-of-seven helper: build a provenance spine, its DERIVED_FROM/SEALED_BY edges, and the
// pristine / tamper / limitation scenarios common to all three domains.
function chainStory({ id, title, kinds, labels, dims, sealSeq, tamperSeq, limitation }) {
  const entities = kinds.map((k, i) => E(`${id}:n${i}:${k}`, k, i, labels[i][0], labels[i][1]));
  const ids = entities.map((e) => e.id);
  const relations = [];
  for (let i = 1; i < kinds.length; i++) relations.push(R(`e${i}`, i === sealSeq ? "SEALED_BY" : "DERIVED_FROM", ids[i], ids[i - 1]));

  const cleanE = S(Object.fromEntries(ids.map((x) => [x, "VERIFIED"])));
  const cleanD = D(dims.clean);
  const tamperedE = S(Object.fromEntries(ids.map((x, i) => [x, i < tamperSeq ? "VERIFIED" : i === tamperSeq ? "FIRST_FAILURE" : "AFFECTED_DOWNSTREAM"])));
  const tamperedD = D(dims.tampered);
  const downstream = ids.filter((_, i) => i > tamperSeq);

  const scenarios = [
    { id: "pristine", label: bi("Pristine", "原始"), entity_status: cleanE, dimension_status: cleanD, first_failure: null, affected_downstream: [], note: bi("All checks pass; analytical correctness NOT evaluated; human review still required.", "全部检查通过;分析正确性不评估;仍需人工复核。") },
    { id: "tampered", label: bi("Tampered", "被篡改"), entity_status: tamperedE, dimension_status: tamperedD, first_failure: ids[tamperSeq], affected_downstream: downstream, note: bi(`First failure at sequence ${tamperSeq}; downstream frozen.`, `序号 ${tamperSeq} 首个失败;下游冻结。`) },
    limitation(ids, cleanD),
  ];
  const steps = [
    { id: "intro", index: 0, kind: "intro", scenario_ref: "pristine", narration: title.intro, focus_entities: [], reveal_upto_sequence: 0, layout_intent: "timeline" },
    { id: "reveal", index: 1, kind: "reveal", scenario_ref: "pristine", narration: title.reveal, focus_entities: ids, reveal_upto_sequence: kinds.length - 1, layout_intent: "timeline" },
    { id: "tamper", index: 2, kind: "tamper", scenario_ref: "tampered", narration: title.tamper, focus_entities: [ids[tamperSeq]], layout_intent: "timeline" },
    { id: "limit", index: 3, kind: "abstain", scenario_ref: scenarios[2].id, narration: title.limit, focus_entities: [], layout_intent: "dag" },
    { id: "human", index: 4, kind: "human_gate", scenario_ref: null, narration: title.human, focus_entities: [], layout_intent: "timeline" },
  ];
  return {
    story_version: "shadow-guided-story-v1", story_id: id, provenance_mode: "FIXTURE",
    fixture_note: "PRODUCT-QUALITY FIXTURE — sanitized, deterministic, no private data.",
    title: title.title,
    teaches: { proves: title.proves, does_not_prove: title.does_not_prove },
    trust_dimensions: Object.keys(dims.clean),
    entities, relations, scenarios, steps,
  };
}

function buildBanking() {
  return chainStory({
    id: "banking-deep",
    kinds: ["source", "source", "snapshot", "evidence", "claim", "recommendation", "signature", "audit_record"],
    labels: [["Loan application p1", "贷款申请第1页"], ["Loan application p2", "贷款申请第2页"], ["Intake snapshot", "受理快照"], ["DTI / FICO / income", "DTI / FICO / 收入"], ["Council claim: elevated risk", "council 声明:风险偏高"], ["REVIEW (not auto-decline)", "REVIEW(非自动拒绝)"], ["Ed25519 seal", "Ed25519 封签"], ["Audit record", "审计记录"]],
    sealSeq: 6, tamperSeq: 4,
    dims: {
      clean: { RECORD_INTEGRITY: "VERIFIED", DIGITAL_SIGNATURE: "VERIFIED", HASH_CHAIN: "VERIFIED", SOURCE_RESOLUTION: "VERIFIED", CLAIM_EVIDENCE_BINDING: "VERIFIED", POLICY_ADEQUACY: "NOT_EVALUATED", ANALYTICAL_CORRECTNESS: "NOT_EVALUATED", LEGAL_FAIRNESS_REVIEW: "REQUIRES_HUMAN_REVIEW", HUMAN_APPROVAL: "NOT_PRESENT" },
      tampered: { RECORD_INTEGRITY: "FAILED", DIGITAL_SIGNATURE: "FAILED", HASH_CHAIN: "FAILED", SOURCE_RESOLUTION: "VERIFIED", CLAIM_EVIDENCE_BINDING: "FAILED", POLICY_ADEQUACY: "NOT_EVALUATED", ANALYTICAL_CORRECTNESS: "NOT_EVALUATED", LEGAL_FAIRNESS_REVIEW: "REQUIRES_HUMAN_REVIEW", HUMAN_APPROVAL: "NOT_PRESENT" },
    },
    title: {
      title: bi("Banking loan council — deep audit", "银行贷款 council——深度审计"),
      proves: bi("The recommendation is bound to two source pages + verified ratios, sealed and logged.", "推荐结果绑定到两页来源 + 已核验比率,已封签并记录。"),
      does_not_prove: bi("An intact chain does not prove the lending decision was correct, adequate, or fair — a person must review.", "完整的链不证明放贷决策正确、充分或公平——必须由人复核。"),
      intro: bi("A loan package seals into a signed provenance chain.", "一份贷款材料封存进一条签名溯源链。"),
      reveal: bi("Two application pages → snapshot → verified ratios → council claim → REVIEW → seal → audit.", "两页申请 → 快照 → 已核验比率 → council 声明 → REVIEW → 封签 → 审计。"),
      tamper: bi("Edit the council claim and its verification fails first; the recommendation, seal and audit freeze.", "篡改 council 声明,它最先验证失败;推荐、封签与审计随之冻结。"),
      limit: bi("Missing income evidence leaves the claim UNSUPPORTED — flagged, not silently approved.", "缺失收入证据使该声明无支撑——被标记而非悄悄批准。"),
      human: bi("Policy adequacy + analytical correctness NOT evaluated; fair-lending review + human approval required.", "政策充分性 + 分析正确性不评估;需公平放贷复核 + 人工批准。"),
    },
    limitation: (ids, cleanD) => ({
      id: "missing_evidence", label: bi("Missing income evidence", "缺失收入证据"),
      entity_status: S({ ...Object.fromEntries(ids.map((x) => [x, "VERIFIED"])), [ids[3]]: "NOT_PRESENT", [ids[4]]: "UNSUPPORTED" }),
      dimension_status: D({ ...cleanD, CLAIM_EVIDENCE_BINDING: "WARNING" }),
      first_failure: ids[4], affected_downstream: [ids[5]],
      note: bi("The claim cites income evidence that is not present → UNSUPPORTED, requires human review.", "该声明引用了不存在的收入证据 → 无支撑,需人工复核。"),
    }),
  });
}

function buildDataScience() {
  return chainStory({
    id: "data-science-deep",
    kinds: ["dataset", "feature", "model", "metric", "experiment", "signature", "audit_record"],
    labels: [["Training set v3", "训练集 v3"], ["Feature: PSI drift", "特征:PSI 漂移"], ["Model: GBM", "模型:GBM"], ["AUC 0.86 / KS 0.41", "AUC 0.86 / KS 0.41"], ["Experiment run 24", "实验运行 24"], ["Ed25519 seal", "Ed25519 封签"], ["Audit record", "审计记录"]],
    sealSeq: 5, tamperSeq: 2,
    dims: {
      clean: { RECORD_INTEGRITY: "VERIFIED", DIGITAL_SIGNATURE: "VERIFIED", HASH_CHAIN: "VERIFIED", SOURCE_RESOLUTION: "VERIFIED", SYNTHESIS_PROVENANCE: "VERIFIED", ANALYTICAL_CORRECTNESS: "NOT_EVALUATED", LEGAL_FAIRNESS_REVIEW: "REQUIRES_HUMAN_REVIEW", HUMAN_APPROVAL: "NOT_PRESENT" },
      tampered: { RECORD_INTEGRITY: "FAILED", DIGITAL_SIGNATURE: "FAILED", HASH_CHAIN: "FAILED", SOURCE_RESOLUTION: "VERIFIED", SYNTHESIS_PROVENANCE: "FAILED", ANALYTICAL_CORRECTNESS: "NOT_EVALUATED", LEGAL_FAIRNESS_REVIEW: "REQUIRES_HUMAN_REVIEW", HUMAN_APPROVAL: "NOT_PRESENT" },
    },
    title: {
      title: bi("Data-science model lineage — deep audit", "数据科学模型血缘——深度审计"),
      proves: bi("The metric derives from a named model, feature set, and training set, sealed and logged.", "指标由具名模型、特征集与训练集派生,已封签并记录。"),
      does_not_prove: bi("A sealed lineage does not prove the model is unbiased, well-calibrated, or fit to deploy — validation is human work.", "封签的血缘不证明模型无偏、校准良好或适合部署——验证是人的工作。"),
      intro: bi("A model run seals into a signed lineage chain.", "一次模型运行封存进签名血缘链。"),
      reveal: bi("Training set → feature → model → metric → experiment → seal → audit.", "训练集 → 特征 → 模型 → 指标 → 实验 → 封签 → 审计。"),
      tamper: bi("Swap the model artifact and lineage verification fails first; downstream freezes.", "替换模型工件,血缘验证最先失败;下游冻结。"),
      limit: bi("A drift warning on the feature is a WARNING, not a failure — flagged for validation.", "特征上的漂移警告是 WARNING 而非失败——标记待验证。"),
      human: bi("Analytical correctness NOT evaluated; validation split + fairness review + human sign-off required.", "分析正确性不评估;需验证划分 + 公平性复核 + 人工签署。"),
    },
    limitation: (ids, cleanD) => ({
      id: "feature_drift", label: bi("Feature drift warning", "特征漂移警告"),
      entity_status: S({ ...Object.fromEntries(ids.map((x) => [x, "VERIFIED"])), [ids[1]]: "WARNING" }),
      dimension_status: D({ ...cleanD, SYNTHESIS_PROVENANCE: "WARNING" }),
      first_failure: ids[1], affected_downstream: [],
      note: bi("PSI drift on the feature is surfaced as a WARNING requiring validation, not a hard failure.", "特征的 PSI 漂移作为需验证的 WARNING 呈现,而非硬失败。"),
    }),
  });
}

function buildCoding() {
  return chainStory({
    id: "coding-agent-deep",
    kinds: ["issue", "tool_call", "diff", "test", "commit", "signature", "audit_record"],
    labels: [["Issue #412", "问题 #412"], ["tool: Edit EventSystem", "工具:编辑 EventSystem"], ["diff: 3 files", "差异:3 文件"], ["test: PlayMode", "测试:PlayMode"], ["commit 6f6d9de", "提交 6f6d9de"], ["Ed25519 seal", "Ed25519 封签"], ["Audit record", "审计记录"]],
    sealSeq: 5, tamperSeq: 3,
    dims: {
      clean: { RECORD_INTEGRITY: "VERIFIED", DIGITAL_SIGNATURE: "VERIFIED", HASH_CHAIN: "VERIFIED", SOURCE_RESOLUTION: "VERIFIED", CLAIM_EVIDENCE_BINDING: "VERIFIED", ANALYTICAL_CORRECTNESS: "NOT_EVALUATED", HUMAN_APPROVAL: "NOT_PRESENT" },
      tampered: { RECORD_INTEGRITY: "FAILED", DIGITAL_SIGNATURE: "FAILED", HASH_CHAIN: "FAILED", SOURCE_RESOLUTION: "VERIFIED", CLAIM_EVIDENCE_BINDING: "FAILED", ANALYTICAL_CORRECTNESS: "NOT_EVALUATED", HUMAN_APPROVAL: "NOT_PRESENT" },
    },
    title: {
      title: bi("Coding-agent replay — deep audit", "编码 agent 回放——深度审计"),
      proves: bi("The commit traces to an issue, tool calls, a diff, and a test run, sealed and logged.", "提交可追溯到问题、工具调用、差异与一次测试运行,已封签并记录。"),
      does_not_prove: bi("A sealed replay does not prove the code is correct or safe — an unverified/failing test is surfaced, not hidden.", "封签的回放不证明代码正确或安全——未验证/失败的测试被呈现而非隐藏。"),
      intro: bi("A coding-agent action seals into a signed replay chain.", "一次编码 agent 动作封存进签名回放链。"),
      reveal: bi("Issue → tool call → diff → test → commit → seal → audit.", "问题 → 工具调用 → 差异 → 测试 → 提交 → 封签 → 审计。"),
      tamper: bi("Alter the test result and replay verification fails first; commit/seal/audit freeze.", "篡改测试结果,回放验证最先失败;提交/封签/审计冻结。"),
      limit: bi("A failing test leaves the commit's safety UNSUPPORTED — surfaced for human review.", "失败的测试使提交的安全性无支撑——呈现待人工复核。"),
      human: bi("Analytical correctness NOT evaluated; code review + human approval required before merge.", "分析正确性不评估;合并前需代码复核 + 人工批准。"),
    },
    limitation: (ids, cleanD) => ({
      id: "failing_test", label: bi("Failing test / retry", "测试失败 / 重试"),
      entity_status: S({ ...Object.fromEntries(ids.map((x) => [x, "VERIFIED"])), [ids[3]]: "FAILED", [ids[4]]: "UNSUPPORTED" }),
      dimension_status: D({ ...cleanD, CLAIM_EVIDENCE_BINDING: "WARNING" }),
      first_failure: ids[3], affected_downstream: [ids[4]],
      note: bi("The test FAILED, so the commit's safety is UNSUPPORTED and flagged for human review.", "测试失败,故提交的安全性无支撑,标记待人工复核。"),
    }),
  });
}

export function buildAll() {
  const stories = {
    "banking-deep.guided-story.json": buildBanking(),
    "data-science-deep.guided-story.json": buildDataScience(),
    "coding-agent-deep.guided-story.json": buildCoding(),
  };
  for (const [name, s] of Object.entries(stories)) write(name, s);
  return stories;
}

if (import.meta.url === `file://${process.argv[1]}`) { buildAll(); console.log("product-quality-v5 fixtures built"); }
