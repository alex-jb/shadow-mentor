// Deterministic generator for the three canonical shadow-guided-story-v1 fixtures.
// Each guided story REFERENCES an existing scene / evidence bundle (by opaque id) and REUSES its
// entity ids + first-failure + downstream + statuses — no semantic drift from the source fixtures
// it is derived from:
//   - audit-chain            ← fixtures/shadow-3d/banking-{seven-node,tampered}.json
//   - reason-code-attestation← fixtures/animations/reason-code-attestation.json
//   - persona-deliberation   ← fixtures/animations/persona-deliberation.json
// Pure + deterministic (no Date.now / Math.random). Validates every status/dimension/kind against
// lib/shadow-semantic-vocabulary.mjs as it builds, so a typo fails the build, not a renderer.
// Run: node fixtures/guided-stories/build.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isStatus, isTrustDimension, isEntityKind, isRelationType } from "../../lib/shadow-semantic-vocabulary.mjs";

const OUT = dirname(fileURLToPath(import.meta.url));
mkdirSync(OUT, { recursive: true });
const write = (name, o) => writeFileSync(join(OUT, name), JSON.stringify(o, null, 2) + "\n");

const bi = (en, zh) => ({ en, zh });

// Fail-fast guards so a fixture can never reference a status/dimension/kind/relation the vocabulary
// does not define (that would silently diverge the three engines).
function entity(id, kind, sequence, label, a11y, extra = {}) {
  if (!isEntityKind(kind)) throw new Error(`entity ${id}: unknown kind ${kind}`);
  if (extra.trust_dimension && !isTrustDimension(extra.trust_dimension)) throw new Error(`entity ${id}: unknown dim ${extra.trust_dimension}`);
  return { id, kind, sequence, label, a11y, ...extra };
}
function relation(id, type, from, to) {
  if (!isRelationType(type)) throw new Error(`relation ${id}: unknown type ${type}`);
  return { id, type, from, to };
}
function statusMap(obj) {
  for (const [k, v] of Object.entries(obj)) if (!isStatus(v)) throw new Error(`status for ${k}: unknown ${v}`);
  return obj;
}
function dimMap(obj) {
  for (const [k, v] of Object.entries(obj)) {
    if (!isTrustDimension(k)) throw new Error(`dimension key unknown ${k}`);
    if (!isStatus(v)) throw new Error(`dimension ${k}: unknown status ${v}`);
  }
  return obj;
}

// ── 1. audit-chain ───────────────────────────────────────────────────────────
// Reuses banking-v1 node ids + the tamper failure at seq 3 with downstream 4,5,6.
function buildAuditChain() {
  const N = [
    ["banking-v1:n0:source", "source", "Loan file", "循环贷款文件"],
    ["banking-v1:n1:snapshot", "snapshot", "Intake snapshot", "受理快照"],
    ["banking-v1:n2:evidence", "evidence", "DTI / FICO / LTV", "DTI / FICO / LTV"],
    ["banking-v1:n3:claim", "claim", "Council claims", "council 声明"],
    ["banking-v1:n4:recommendation", "recommendation", "REVIEW", "REVIEW"],
    ["banking-v1:n5:signature", "signature", "Ed25519 seal", "Ed25519 封签"],
    ["banking-v1:n6:audit_record", "audit_record", "Audit record", "审计记录"],
  ];
  const entities = N.map(([id, kind, en, zh], i) =>
    entity(id, kind, i, bi(en, zh),
      bi(`${kind} at sequence ${i}: ${en}`, `序号 ${i} 的${kind}:${zh}`)));
  const relations = [];
  for (let i = 1; i < N.length; i++) {
    const type = N[i][1] === "signature" ? "SEALED_BY" : "DERIVED_FROM";
    relations.push(relation(`e${i}`, type, N[i][0], N[i - 1][0]));
  }
  const ids = N.map((n) => n[0]);
  const dims = ["RECORD_INTEGRITY", "DIGITAL_SIGNATURE", "HASH_CHAIN", "PROFILE", "SOURCE_RESOLUTION", "EXTERNAL_ANCHOR", "ANALYTICAL_CORRECTNESS"];
  const cleanEntities = statusMap(Object.fromEntries(ids.map((id) => [id, "VERIFIED"])));
  const cleanDims = dimMap({
    RECORD_INTEGRITY: "VERIFIED", DIGITAL_SIGNATURE: "VERIFIED", HASH_CHAIN: "VERIFIED", PROFILE: "VERIFIED",
    SOURCE_RESOLUTION: "NOT_PRESENT", EXTERNAL_ANCHOR: "NOT_PRESENT", ANALYTICAL_CORRECTNESS: "NOT_EVALUATED",
  });
  const tamperedEntities = statusMap({
    "banking-v1:n0:source": "VERIFIED", "banking-v1:n1:snapshot": "VERIFIED", "banking-v1:n2:evidence": "VERIFIED",
    "banking-v1:n3:claim": "FIRST_FAILURE",
    "banking-v1:n4:recommendation": "AFFECTED_DOWNSTREAM", "banking-v1:n5:signature": "AFFECTED_DOWNSTREAM", "banking-v1:n6:audit_record": "AFFECTED_DOWNSTREAM",
  });
  const tamperedDims = dimMap({
    RECORD_INTEGRITY: "FAILED", DIGITAL_SIGNATURE: "FAILED", HASH_CHAIN: "FAILED", PROFILE: "VERIFIED",
    SOURCE_RESOLUTION: "NOT_PRESENT", EXTERNAL_ANCHOR: "NOT_PRESENT", ANALYTICAL_CORRECTNESS: "NOT_EVALUATED",
  });
  return {
    story_version: "shadow-guided-story-v1",
    story_id: "audit-chain",
    provenance_mode: "FIXTURE",
    fixture_note: "DEMONSTRATION FIXTURE — hash-chained provenance illustration, not a production banking record.",
    title: bi("Audit chain: integrity, not correctness", "审计链:证明完整性,而非正确性"),
    teaches: {
      proves: bi("A tampered link breaks its own and every downstream link's verification.", "被篡改的一环会使其自身及其后每一环的验证失败。"),
      does_not_prove: bi("A fully verified chain does not prove the decision was correct.", "完全验证通过的链不证明决策是正确的。"),
    },
    references: { scene_clean: "shadow-3d:banking-seven-node", scene_tampered: "shadow-3d:banking-tampered" },
    trust_dimensions: dims,
    entities,
    relations,
    scenarios: [
      {
        id: "pristine", label: bi("Pristine", "原始"),
        entity_status: cleanEntities, dimension_status: cleanDims,
        first_failure: null, affected_downstream: [],
        note: bi("Every link verifies; analytical correctness is still NOT evaluated.", "每一环都验证通过;分析正确性仍不评估。"),
      },
      {
        id: "tamper_seq_3", label: bi("Tampered at sequence 3", "序号 3 处被篡改"),
        entity_status: tamperedEntities, dimension_status: tamperedDims,
        first_failure: "banking-v1:n3:claim",
        affected_downstream: ["banking-v1:n4:recommendation", "banking-v1:n5:signature", "banking-v1:n6:audit_record"],
        note: bi("prev_hash_mismatch at seq 3; sequences 4,5,6 are frozen as affected downstream.", "序号 3 处 prev_hash_mismatch;序号 4、5、6 因受下游影响而冻结。"),
      },
    ],
    steps: [
      { id: "intro", index: 0, kind: "intro", scenario_ref: "pristine", narration: bi("A decision seals into a hash-chained, signed provenance chain.", "一个决策被封存进一条哈希链 + 签名的溯源链。"), focus_entities: [], reveal_upto_sequence: 0, layout_intent: "timeline" },
      { id: "reveal", index: 1, kind: "reveal", scenario_ref: "pristine", narration: bi("Each link derives from the previous one, source through audit record.", "每一环都由前一环派生,从来源直到审计记录。"), focus_entities: ids, reveal_upto_sequence: 6, layout_intent: "timeline" },
      { id: "seal", index: 2, kind: "seal", scenario_ref: "pristine", narration: bi("The recommendation is sealed by an Ed25519 signature into the audit record.", "推荐结果由 Ed25519 签名封存进审计记录。"), focus_entities: ["banking-v1:n5:signature", "banking-v1:n6:audit_record"], reveal_upto_sequence: 6, layout_intent: "timeline" },
      { id: "tamper", index: 3, kind: "tamper", scenario_ref: "tamper_seq_3", narration: bi("Alter the council claim at sequence 3 and its verification fails first.", "篡改序号 3 的 council 声明,它的验证最先失败。"), focus_entities: ["banking-v1:n3:claim"], reveal_upto_sequence: 6, layout_intent: "timeline" },
      { id: "cascade", index: 4, kind: "cascade", scenario_ref: "tamper_seq_3", narration: bi("Every downstream link is frozen as affected — a green chain would have proved only that the record was unaltered.", "其后每一环都作为受影响项被冻结——绿色的链只能证明记录未被改动。"), focus_entities: ["banking-v1:n4:recommendation", "banking-v1:n5:signature", "banking-v1:n6:audit_record"], reveal_upto_sequence: 6, layout_intent: "timeline" },
      { id: "summary", index: 5, kind: "summary", scenario_ref: null, narration: bi("Integrity is judged; analytical correctness is NOT evaluated by the chain.", "完整性被判断;分析正确性不由审计链评估。"), focus_entities: [], layout_intent: "timeline" },
    ],
  };
}

// ── 2. reason-code-attestation ───────────────────────────────────────────────
// Reuses RC ids + evidence refs + signer + the 4 tamper first-failures from the animation fixture.
function buildReasonCode() {
  const entities = [
    entity("rc:dictionary", "dictionary", 0, bi("Reason-code dictionary v3", "理由代码字典 v3"), bi("dictionary shadow-reason-codes, version v3", "字典 shadow-reason-codes,版本 v3"), { trust_dimension: "DICTIONARY_HASH" }),
    entity("rc:RC-017", "reason_code", 1, bi("RC-017 High revolving utilization", "RC-017 循环额度使用率过高"), bi("selected reason code RC-017", "已选理由代码 RC-017")),
    entity("rc:RC-021", "reason_code", 2, bi("RC-021 Insufficient verified income", "RC-021 已核验收入证据不足"), bi("selected reason code RC-021", "已选理由代码 RC-021")),
    entity("rc:RC-031", "reason_code", 3, bi("RC-031 Recent severe delinquency", "RC-031 近期严重逾期"), bi("dictionary reason code RC-031 (not selected)", "字典理由代码 RC-031(未选)")),
    entity("rc:RC-017:B0L1", "evidence_ref", 4, bi("Evidence B0L1", "证据 B0L1"), bi("evidence reference B0L1 for RC-017", "RC-017 的证据引用 B0L1"), { evidence_ref: "B0L1" }),
    entity("rc:RC-017:B0L2", "evidence_ref", 5, bi("Evidence B0L2", "证据 B0L2"), bi("evidence reference B0L2 for RC-017", "RC-017 的证据引用 B0L2"), { evidence_ref: "B0L2" }),
    entity("rc:RC-021:B0L0", "evidence_ref", 6, bi("Evidence B0L0", "证据 B0L0"), bi("evidence reference B0L0 for RC-021", "RC-021 的证据引用 B0L0"), { evidence_ref: "B0L0" }),
    entity("rc:attestation", "attestation", 7, bi("Signed attestation", "已签名存证"), bi("attestation signed by fingerprint 727d29d3204231f7", "由指纹 727d29d3204231f7 签名的存证"), { trust_dimension: "DIGITAL_SIGNATURE" }),
  ];
  const relations = [
    relation("r1", "DERIVED_FROM", "rc:RC-017", "rc:dictionary"),
    relation("r2", "DERIVED_FROM", "rc:RC-021", "rc:dictionary"),
    relation("r3", "DERIVED_FROM", "rc:RC-031", "rc:dictionary"),
    relation("r4", "BINDS", "rc:RC-017", "rc:RC-017:B0L1"),
    relation("r5", "BINDS", "rc:RC-017", "rc:RC-017:B0L2"),
    relation("r6", "BINDS", "rc:RC-021", "rc:RC-021:B0L0"),
    relation("r7", "ATTESTS", "rc:attestation", "rc:RC-017"),
    relation("r8", "ATTESTS", "rc:attestation", "rc:RC-021"),
    relation("r9", "SEALED_BY", "rc:attestation", "rc:dictionary"),
  ];
  const dims = ["DICTIONARY_HASH", "DICTIONARY_VERSION", "CLAIM_EVIDENCE_BINDING", "DIGITAL_SIGNATURE", "RECORD_INTEGRITY", "POLICY_ADEQUACY", "ANALYTICAL_CORRECTNESS", "LEGAL_FAIRNESS_REVIEW"];
  const allIds = entities.map((e) => e.id);
  const pristineEntities = statusMap(Object.fromEntries(allIds.map((id) => [id, id === "rc:RC-031" ? "PRESENT" : "VERIFIED"])));
  const pristineDims = dimMap({
    DICTIONARY_HASH: "VERIFIED", DICTIONARY_VERSION: "VERIFIED", CLAIM_EVIDENCE_BINDING: "VERIFIED", DIGITAL_SIGNATURE: "VERIFIED",
    RECORD_INTEGRITY: "VERIFIED", POLICY_ADEQUACY: "NOT_EVALUATED", ANALYTICAL_CORRECTNESS: "NOT_EVALUATED", LEGAL_FAIRNESS_REVIEW: "REQUIRES_HUMAN_REVIEW",
  });
  const withFail = (overrides) => statusMap({ ...pristineEntities, ...overrides });
  const withDimFail = (overrides) => dimMap({ ...pristineDims, ...overrides });
  return {
    story_version: "shadow-guided-story-v1",
    story_id: "reason-code-attestation",
    provenance_mode: "FIXTURE",
    fixture_note: "DEMONSTRATION FIXTURE — not production bank policy or regulatory language.",
    title: bi("Reason-code attestation binding", "理由代码存证绑定"),
    teaches: {
      proves: bi("The dictionary hash + version bind the selected reason codes and their evidence to the signature.", "字典哈希 + 版本将所选理由代码及其证据绑定到签名上。"),
      does_not_prove: bi("A valid attestation does not prove the reason codes were the policy-adequate choice or legally reviewed.", "有效的存证不证明这些理由代码是政策上充分的选择,也不代表已经过法律复核。"),
    },
    references: { evidence_bundle: "animations:reason-code-attestation", dictionary: "shadow-reason-codes@v3" },
    trust_dimensions: dims,
    entities,
    relations,
    scenarios: [
      { id: "pristine", label: bi("Pristine", "原始"), entity_status: pristineEntities, dimension_status: pristineDims, first_failure: null, affected_downstream: [], note: bi("All binding checks pass; policy adequacy + analytical correctness are NOT evaluated; legal review still required.", "所有绑定检查通过;政策充分性和分析正确性不评估;仍需法律复核。") },
      { id: "dictionary_modified", label: bi("Dictionary text modified", "字典文本被修改"), entity_status: withFail({ "rc:dictionary": "FIRST_FAILURE", "rc:RC-017": "AFFECTED_DOWNSTREAM", "rc:RC-021": "AFFECTED_DOWNSTREAM", "rc:RC-031": "AFFECTED_DOWNSTREAM", "rc:attestation": "AFFECTED_DOWNSTREAM" }), dimension_status: withDimFail({ DICTIONARY_HASH: "FAILED", RECORD_INTEGRITY: "FAILED", DIGITAL_SIGNATURE: "FAILED", CLAIM_EVIDENCE_BINDING: "FAILED" }), first_failure: "rc:dictionary", affected_downstream: ["rc:RC-017", "rc:RC-021", "rc:RC-031", "rc:attestation"], note: bi("Source check DICTIONARY_HASH fails first.", "源检查 DICTIONARY_HASH 最先失败。") },
      { id: "reason_replaced", label: bi("Reason code replaced", "理由代码被替换"), entity_status: withFail({ "rc:RC-017": "FIRST_FAILURE", "rc:attestation": "AFFECTED_DOWNSTREAM" }), dimension_status: withDimFail({ CLAIM_EVIDENCE_BINDING: "FAILED", RECORD_INTEGRITY: "FAILED", DIGITAL_SIGNATURE: "FAILED" }), first_failure: "rc:RC-017", affected_downstream: ["rc:attestation"], note: bi("Source check REASON_CODE_EXISTS fails first (RC-017 → RC-009 not in dictionary).", "源检查 REASON_CODE_EXISTS 最先失败(RC-017 → RC-009 不在字典中)。") },
      { id: "evidence_removed", label: bi("Evidence reference removed", "证据引用被移除"), entity_status: withFail({ "rc:RC-017:B0L1": "NOT_PRESENT", "rc:RC-017": "FIRST_FAILURE", "rc:attestation": "AFFECTED_DOWNSTREAM" }), dimension_status: withDimFail({ CLAIM_EVIDENCE_BINDING: "FAILED", RECORD_INTEGRITY: "FAILED", DIGITAL_SIGNATURE: "FAILED" }), first_failure: "rc:RC-017:B0L1", affected_downstream: ["rc:RC-017", "rc:attestation"], note: bi("Source check EVIDENCE_REFERENCES fails first (RC-017 loses B0L1).", "源检查 EVIDENCE_REFERENCES 最先失败(RC-017 丢失 B0L1)。") },
      { id: "version_changed", label: bi("Dictionary version changed", "字典版本被更换"), entity_status: withFail({ "rc:dictionary": "FIRST_FAILURE", "rc:attestation": "AFFECTED_DOWNSTREAM" }), dimension_status: withDimFail({ DICTIONARY_VERSION: "FAILED", RECORD_INTEGRITY: "FAILED", DIGITAL_SIGNATURE: "FAILED" }), first_failure: "rc:dictionary", affected_downstream: ["rc:attestation"], note: bi("Source check DICTIONARY_VERSION fails first (v3 → v4).", "源检查 DICTIONARY_VERSION 最先失败(v3 → v4)。") },
    ],
    steps: [
      { id: "intro", index: 0, kind: "intro", scenario_ref: "pristine", narration: bi("Two reason codes are selected, each bound to verified evidence.", "选定两个理由代码,每个都绑定到已核验的证据。"), focus_entities: ["rc:RC-017", "rc:RC-021"], layout_intent: "hybrid" },
      { id: "bind", index: 1, kind: "reveal", scenario_ref: "pristine", narration: bi("The dictionary hash + version and the evidence references are folded into the attestation.", "字典哈希 + 版本与证据引用被纳入存证。"), focus_entities: ["rc:dictionary", "rc:attestation"], layout_intent: "hybrid" },
      { id: "seal", index: 2, kind: "seal", scenario_ref: "pristine", narration: bi("The attestation is signed; any later edit to a bound field breaks it.", "存证被签名;之后对任一绑定字段的修改都会使其失效。"), focus_entities: ["rc:attestation"], layout_intent: "hybrid" },
      { id: "tamper", index: 3, kind: "tamper", scenario_ref: "dictionary_modified", narration: bi("Modify a dictionary definition and the dictionary hash fails first.", "修改一条字典定义,字典哈希最先失败。"), focus_entities: ["rc:dictionary"], layout_intent: "hybrid" },
      { id: "summary", index: 4, kind: "summary", scenario_ref: null, narration: bi("Binding is cryptographic; policy adequacy and legal fairness review remain human work.", "绑定是密码学的;政策充分性与法律公平性复核仍是人的工作。"), focus_entities: [], layout_intent: "hybrid" },
    ],
  };
}

// ── 3. persona-deliberation ──────────────────────────────────────────────────
// Reuses persona ids CF/RO/FL/CA/MC, shared evidence E-101..E-105, and the 6 scenarios' first_warning.
function buildPersona() {
  const P = [
    ["persona:CF", "Credit Fundamentals", "信贷基本面"],
    ["persona:RO", "Risk Officer", "风险官"],
    ["persona:FL", "Fair Lending Compliance", "公平放贷合规"],
    ["persona:CA", "Customer Advocate", "客户倡导"],
    ["persona:MC", "Macro Contrarian", "宏观逆向"],
  ];
  const E = [
    ["E-101", "High revolving utilization", "循环额度使用率高"],
    ["E-102", "Verified income documentation", "已核验收入文件"],
    ["E-103", "Recent delinquency record", "近期逾期记录"],
    ["E-104", "Long-standing customer relationship", "长期客户关系"],
    ["E-105", "Policy exception criteria", "政策例外条件"],
  ];
  const entities = [
    ...P.map(([id, en, zh], i) => entity(id, "persona", i, bi(en, zh), bi(`analytical perspective ${en}`, `分析视角:${zh}`), { trust_dimension: "PERSONA_OUTPUT_INTEGRITY" })),
    ...E.map(([id, en, zh], i) => entity(id, "shared_evidence", 5 + i, bi(en, zh), bi(`shared evidence ${id}: ${en}`, `共享证据 ${id}:${zh}`))),
    entity("persona:synthesis", "synthesis", 10, bi("Evidence-grounded synthesis", "以证据为基础的综合"), bi("synthesis over the perspectives; majority is descriptive only", "对各视角的综合;多数仅为描述性"), { trust_dimension: "SYNTHESIS_PROVENANCE" }),
  ];
  const relations = [
    relation("s1", "SUPPORTS", "persona:CF", "E-101"),
    relation("s2", "SUPPORTS", "persona:RO", "E-103"),
    relation("s3", "SUPPORTS", "persona:FL", "E-105"),
    relation("s4", "SUPPORTS", "persona:CA", "E-104"),
    relation("s5", "SUPPORTS", "persona:MC", "E-102"),
    relation("y1", "SYNTHESIZES_INTO", "persona:CF", "persona:synthesis"),
    relation("y2", "SYNTHESIZES_INTO", "persona:RO", "persona:synthesis"),
    relation("y3", "SYNTHESIZES_INTO", "persona:FL", "persona:synthesis"),
    relation("y4", "SYNTHESIZES_INTO", "persona:CA", "persona:synthesis"),
    relation("y5", "SYNTHESIZES_INTO", "persona:MC", "persona:synthesis"),
  ];
  const dims = ["SOURCE_RESOLUTION", "PERSONA_OUTPUT_INTEGRITY", "CLAIM_EVIDENCE_BINDING", "SYNTHESIS_PROVENANCE", "ANALYTICAL_CORRECTNESS", "LEGAL_FAIRNESS_REVIEW", "HUMAN_APPROVAL"];
  const allIds = entities.map((e) => e.id);
  const baseEntities = Object.fromEntries(allIds.map((id) => [id, id === "persona:synthesis" ? "REQUIRES_HUMAN_REVIEW" : id.startsWith("E-") ? "PRESENT" : "VERIFIED"]));
  const baseDims = {
    SOURCE_RESOLUTION: "VERIFIED", PERSONA_OUTPUT_INTEGRITY: "VERIFIED", CLAIM_EVIDENCE_BINDING: "VERIFIED", SYNTHESIS_PROVENANCE: "VERIFIED",
    ANALYTICAL_CORRECTNESS: "NOT_EVALUATED", LEGAL_FAIRNESS_REVIEW: "REQUIRES_HUMAN_REVIEW", HUMAN_APPROVAL: "NOT_PRESENT",
  };
  const ent = (o) => statusMap({ ...baseEntities, ...o });
  const dim = (o) => dimMap({ ...baseDims, ...o });
  return {
    story_version: "shadow-guided-story-v1",
    story_id: "persona-deliberation",
    provenance_mode: "FIXTURE",
    fixture_note: "DEMONSTRATION FIXTURE — configured analytical perspectives, not human experts; not bank policy.",
    title: bi("Persona deliberation → evidence-grounded synthesis", "视角审议 → 以证据为基础的综合"),
    teaches: {
      proves: bi("Each perspective's claim is bound to shared source evidence, or is flagged unsupported / abstained.", "每个视角的主张都绑定到共享的源证据,或被标记为无支撑 / 弃权。"),
      does_not_prove: bi("Majority agreement is descriptive metadata; it does not set analytical correctness, and human approval is not present.", "多数一致只是描述性元数据;它不设定分析正确性,且人工批准并不存在。"),
    },
    references: { evidence_bundle: "animations:persona-deliberation" },
    trust_dimensions: dims,
    entities,
    relations,
    scenarios: [
      { id: "consensus_with_evidence", label: bi("Consensus with evidence", "有证据的共识"), entity_status: ent({}), dimension_status: dim({}), first_failure: null, affected_downstream: [], note: bi("All perspectives grounded; analytical correctness still NOT evaluated; human approval NOT present.", "所有视角均有依据;分析正确性仍不评估;人工批准不存在。") },
      { id: "disagreement", label: bi("Disagreement", "分歧"), entity_status: ent({ "persona:RO": "WARNING" }), dimension_status: dim({}), first_failure: "persona:RO", affected_downstream: [], note: bi("Source first_warning MAJORITY_AGREEMENT — descriptive only, not a correctness verdict.", "源 first_warning 为 MAJORITY_AGREEMENT——仅为描述,不是正确性裁决。") },
      { id: "unsupported_claim", label: bi("Unsupported claim", "无证据主张"), entity_status: ent({ "persona:MC": "UNSUPPORTED" }), dimension_status: dim({ CLAIM_EVIDENCE_BINDING: "WARNING" }), first_failure: "persona:MC", affected_downstream: ["persona:synthesis"], note: bi("Source first_warning UNSUPPORTED_CLAIMS (MC asserts with no evidence).", "源 first_warning 为 UNSUPPORTED_CLAIMS(MC 无证据主张)。") },
      { id: "contradictory_evidence", label: bi("Contradictory evidence", "矛盾证据"), entity_status: ent({ "persona:RO": "WARNING", "persona:CA": "WARNING" }), dimension_status: dim({ CLAIM_EVIDENCE_BINDING: "WARNING" }), first_failure: "persona:RO", affected_downstream: ["persona:synthesis"], note: bi("Source first_warning CONTRADICTORY_EVIDENCE (a claim cites evidence that opposes it).", "源 first_warning 为 CONTRADICTORY_EVIDENCE(主张引用了与之相反的证据)。") },
      { id: "abstain", label: bi("Abstain — insufficient evidence", "弃权——证据不足"), entity_status: ent({ "persona:FL": "ABSTAINED" }), dimension_status: dim({}), first_failure: "persona:FL", affected_downstream: [], note: bi("Source first_warning ABSTENTION (FL abstains rather than assert).", "源 first_warning 为 ABSTENTION(FL 弃权而非主张)。") },
      { id: "majority_weak_evidence", label: bi("Majority but weak evidence", "多数但证据弱"), entity_status: ent({ "persona:CF": "WARNING", "persona:RO": "WARNING", "persona:CA": "WARNING", "persona:MC": "WARNING" }), dimension_status: dim({ CLAIM_EVIDENCE_BINDING: "WARNING" }), first_failure: "CLAIM_EVIDENCE_BINDING", affected_downstream: ["persona:synthesis"], note: bi("Source first_warning CLAIM_EVIDENCE_BINDING — a majority resting on weak binding, not correctness.", "源 first_warning 为 CLAIM_EVIDENCE_BINDING——多数建立在弱绑定之上,而非正确性。") },
    ],
    steps: [
      { id: "intro", index: 0, kind: "intro", scenario_ref: "consensus_with_evidence", narration: bi("Five analytical perspectives read the same shared evidence.", "五个分析视角读取同一份共享证据。"), focus_entities: P.map((p) => p[0]), layout_intent: "radial" },
      { id: "ground", index: 1, kind: "reveal", scenario_ref: "consensus_with_evidence", narration: bi("Each perspective binds its claim to specific evidence.", "每个视角把它的主张绑定到具体证据。"), focus_entities: E.map((e) => e[0]), layout_intent: "dag" },
      { id: "flag", index: 2, kind: "cascade", scenario_ref: "unsupported_claim", narration: bi("An unsupported claim is flagged, not silently averaged in.", "无证据的主张被标记出来,而不是被悄悄平均进去。"), focus_entities: ["persona:MC"], layout_intent: "dag" },
      { id: "synthesis", index: 3, kind: "synthesis", scenario_ref: "consensus_with_evidence", narration: bi("Synthesis records which evidence grounded it; majority is descriptive only.", "综合会记录支撑它的证据;多数仅为描述性。"), focus_entities: ["persona:synthesis"], layout_intent: "radial" },
      { id: "human_gate", index: 4, kind: "human_gate", scenario_ref: null, narration: bi("Analytical correctness is NOT evaluated and human approval is NOT present — a person must review.", "分析正确性不评估,人工批准也不存在——必须由人复核。"), focus_entities: ["persona:synthesis"], layout_intent: "radial" },
    ],
  };
}

export function buildAll() {
  const stories = {
    "audit-chain.guided-story.json": buildAuditChain(),
    "reason-code-attestation.guided-story.json": buildReasonCode(),
    "persona-deliberation.guided-story.json": buildPersona(),
  };
  for (const [name, story] of Object.entries(stories)) write(name, story);
  return stories;
}

if (import.meta.url === `file://${process.argv[1]}`) { buildAll(); console.log("guided-story fixtures built"); }
