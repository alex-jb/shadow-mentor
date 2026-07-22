// Shadow shared semantic vocabulary — the ONE vocabulary imported by every adapter
// (HTML/SVG explainer, Three.js spatial player, Unity native adapter). Meaning lives here;
// each engine only chooses shapes/positions/colours. A status or trust dimension that is not
// declared here is rejected by the compiler, so no adapter can invent a meaning the others
// don't share.
//
// Two hard rules encoded as data, not prose:
//   1. Every status carries text (EN + zh) + an accessible description + a severity + a shape.
//      Status is NEVER conveyed by colour alone.
//   2. FORBIDDEN_MAPPINGS enumerates the collapses we must never let a renderer make —
//      "VERIFIED means trusted", "majority means correct", "the compliance persona ran, so
//      legal review is complete". The compiler and the parity test assert these never appear.
//
// Pure + deterministic: no Date.now / Math.random. Frozen exports.

// ── Semantic statuses ────────────────────────────────────────────────────────
// severity buckets: pass | fail | warn | neutral | abstain | info
// shape is a redundant, colour-independent encoding (matches design/shadow-spatial-tokens.json
// where the concepts overlap). icon is a monochrome glyph name.
export const SEMANTIC_STATUS = Object.freeze({
  VERIFIED: {
    severity: "pass", shape: "icosahedron", icon: "check",
    text_en: "VERIFIED", text_zh: "已验证",
    a11y_en: "verified — this record matches the sealed evidence; it does not mean the decision was correct",
    a11y_zh: "已验证——该记录与封存证据一致;不代表决策正确",
  },
  FAILED: {
    severity: "fail", shape: "octahedron", icon: "alert",
    text_en: "FAILED", text_zh: "失败",
    a11y_en: "failed — this check did not pass",
    a11y_zh: "失败——该检查未通过",
  },
  PRESENT: {
    severity: "neutral", shape: "disc", icon: "dot",
    text_en: "PRESENT", text_zh: "存在",
    a11y_en: "present — this element exists in the bundle (existence only, not validity)",
    a11y_zh: "存在——该元素在包中存在(仅表示存在,不代表有效)",
  },
  NOT_PRESENT: {
    severity: "neutral", shape: "ring", icon: "empty",
    text_en: "NOT PRESENT", text_zh: "不存在",
    a11y_en: "not present — this element is absent from the bundle",
    a11y_zh: "不存在——该元素在包中缺失",
  },
  NOT_CHECKED: {
    severity: "neutral", shape: "box", icon: "question",
    text_en: "NOT CHECKED", text_zh: "未检查",
    a11y_en: "not checked — this dimension was not evaluated in this pass",
    a11y_zh: "未检查——本次未评估该维度",
  },
  NOT_EVALUATED: {
    severity: "info", shape: "box", icon: "minus",
    text_en: "NOT EVALUATED", text_zh: "不评估",
    a11y_en: "not evaluated — outside what this verifier judges; analytical correctness is never judged here",
    a11y_zh: "不评估——超出本验证器判断范围;此处从不判断分析正确性",
  },
  WARNING: {
    severity: "warn", shape: "tetrahedron", icon: "warn",
    text_en: "WARNING", text_zh: "警告",
    a11y_en: "warning — a weak or notable condition that does not by itself fail verification",
    a11y_zh: "警告——一个弱项或值得注意的情况,本身不构成验证失败",
  },
  UNSUPPORTED: {
    severity: "warn", shape: "box", icon: "block",
    text_en: "UNSUPPORTED", text_zh: "无支撑",
    a11y_en: "unsupported — a claim with no supporting evidence, or a capability this verifier cannot support",
    a11y_zh: "无支撑——一个没有支撑证据的主张,或本验证器无法支持的能力",
  },
  MALFORMED: {
    severity: "fail", shape: "octahedron", icon: "alert",
    text_en: "MALFORMED", text_zh: "格式错误",
    a11y_en: "malformed — input could not be parsed and was rejected, not crashed",
    a11y_zh: "格式错误——输入无法解析,已被拒绝而非崩溃",
  },
  ABSTAINED: {
    severity: "abstain", shape: "ring", icon: "pause",
    text_en: "ABSTAINED", text_zh: "弃权",
    a11y_en: "abstained — insufficient verified evidence, so no claim was asserted (an honest non-answer)",
    a11y_zh: "弃权——已核验证据不足,因此未作出任何主张(诚实的不作答)",
  },
  REQUIRES_HUMAN_REVIEW: {
    severity: "warn", shape: "pill", icon: "person",
    text_en: "REQUIRES HUMAN REVIEW", text_zh: "需人工复核",
    a11y_en: "requires human review — a regulated outcome that a person, not the verifier, must sign off",
    a11y_zh: "需人工复核——受监管的结果,必须由人而非验证器签署",
  },
  AFFECTED_DOWNSTREAM: {
    severity: "fail", shape: "box", icon: "dash",
    text_en: "AFFECTED DOWNSTREAM", text_zh: "受下游影响",
    a11y_en: "affected downstream — frozen because an earlier link failed; not independently re-judged",
    a11y_zh: "受下游影响——因上游环节失败而冻结;未被独立重新判断",
  },
  FIRST_FAILURE: {
    severity: "fail", shape: "octahedron", icon: "alert",
    text_en: "FIRST FAILURE", text_zh: "首个失败",
    a11y_en: "first failure — the earliest link where verification broke; downstream is a consequence",
    a11y_zh: "首个失败——验证最早断裂的环节;下游是其后果",
  },
});

export const SEMANTIC_STATUS_IDS = Object.freeze(Object.keys(SEMANTIC_STATUS));

// ── Trust dimensions ─────────────────────────────────────────────────────────
// The independent things a Shadow verifier can check. They are NEVER collapsed into a single
// "green". A story declares which dimensions it exercises; a scenario gives each a status.
export const TRUST_DIMENSIONS = Object.freeze({
  RECORD_INTEGRITY: { text_en: "Record integrity", text_zh: "记录完整性", kind: "cryptographic" },
  DIGITAL_SIGNATURE: { text_en: "Digital signature", text_zh: "数字签名", kind: "cryptographic" },
  HASH_CHAIN: { text_en: "Hash chain", text_zh: "哈希链", kind: "cryptographic" },
  PROFILE: { text_en: "Profile", text_zh: "配置档", kind: "structural" },
  SOURCE_RESOLUTION: { text_en: "Source resolution", text_zh: "来源解析", kind: "structural" },
  EXTERNAL_ANCHOR: { text_en: "External anchor", text_zh: "外部锚定", kind: "structural" },
  CLAIM_EVIDENCE_BINDING: { text_en: "Claim–evidence binding", text_zh: "主张–证据绑定", kind: "structural" },
  DICTIONARY_HASH: { text_en: "Dictionary hash", text_zh: "字典哈希", kind: "cryptographic" },
  DICTIONARY_VERSION: { text_en: "Dictionary version", text_zh: "字典版本", kind: "structural" },
  PERSONA_OUTPUT_INTEGRITY: { text_en: "Persona output integrity", text_zh: "视角输出完整性", kind: "structural" },
  SYNTHESIS_PROVENANCE: { text_en: "Synthesis provenance", text_zh: "综合溯源", kind: "structural" },
  // The three that are explicitly NOT the verifier's job — surfaced so a green never implies them.
  ANALYTICAL_CORRECTNESS: { text_en: "Analytical correctness", text_zh: "分析正确性", kind: "not_judged" },
  POLICY_ADEQUACY: { text_en: "Policy adequacy", text_zh: "政策充分性", kind: "not_judged" },
  LEGAL_FAIRNESS_REVIEW: { text_en: "Legal / fairness review", text_zh: "法律 / 公平性复核", kind: "human" },
  HUMAN_APPROVAL: { text_en: "Human approval", text_zh: "人工批准", kind: "human" },
});

export const TRUST_DIMENSION_IDS = Object.freeze(Object.keys(TRUST_DIMENSIONS));

// ── Semantic relations between entities ──────────────────────────────────────
// A superset compatible with shadow-3d-scene-v1 edge types + the persona/attestation stories.
export const RELATION_TYPES = Object.freeze([
  "DERIVED_FROM", "SUPPORTS", "CONTRADICTS", "APPLIES_POLICY", "CHALLENGED_BY",
  "SUPERSEDES", "SEALED_BY", "BINDS", "ATTESTS", "SYNTHESIZES_INTO",
]);

// Entity kinds a story node can be (domain-spanning; the adapter maps kind→shape via tokens).
export const ENTITY_KINDS = Object.freeze([
  // banking audit chain
  "source", "snapshot", "evidence", "claim", "recommendation", "signature", "audit_record",
  // reason-code attestation
  "dictionary", "reason_code", "evidence_ref", "attestation",
  // persona deliberation
  "persona", "shared_evidence", "synthesis",
]);

// ── Forbidden mappings ───────────────────────────────────────────────────────
// The collapses no renderer may make. Encoded as {from, to, why} so tests can assert none of
// these labels/derivations appear together as an implied equivalence.
export const FORBIDDEN_MAPPINGS = Object.freeze([
  { from: "VERIFIED", to: "TRUSTED", why: "cryptographic verification of a record is not a judgement that the record deserves trust" },
  { from: "VERIFIED", to: "COMPLIANT", why: "an intact signed record is not a finding of regulatory compliance" },
  { from: "MAJORITY", to: "CORRECT", why: "how many perspectives agree is descriptive metadata; it does not set analytical correctness" },
  { from: "COMPLIANCE_PERSONA", to: "LEGAL_REVIEW_COMPLETE", why: "a compliance analytical perspective running is not a completed human legal/fairness review" },
]);

// Concrete forbidden phrases (EN + zh) these mappings must never produce in rendered copy.
export const FORBIDDEN_EQUIVALENCE_PHRASES = Object.freeze([
  "verified means trusted", "verified means compliant", "majority means correct",
  "compliance review complete", "legal review complete",
  "已验证即可信", "已验证即合规", "多数即正确", "合规复核完成", "法律复核完成",
]);

// ── Helpers ──────────────────────────────────────────────────────────────────
export const isStatus = (s) => Object.prototype.hasOwnProperty.call(SEMANTIC_STATUS, s);
export const isTrustDimension = (d) => Object.prototype.hasOwnProperty.call(TRUST_DIMENSIONS, d);
export const isRelationType = (t) => RELATION_TYPES.includes(t);
export const isEntityKind = (k) => ENTITY_KINDS.includes(k);

export function statusMeta(s) {
  if (!isStatus(s)) throw new Error(`unknown semantic status "${s}"`);
  return SEMANTIC_STATUS[s];
}
export function trustDimensionMeta(d) {
  if (!isTrustDimension(d)) throw new Error(`unknown trust dimension "${d}"`);
  return TRUST_DIMENSIONS[d];
}

// Throws if a claimed derivation is one of the forbidden collapses (used by the compiler).
export function assertNoForbiddenMapping(from, to) {
  const hit = FORBIDDEN_MAPPINGS.find((m) => m.from === from && m.to === to);
  if (hit) throw new Error(`forbidden semantic mapping ${from} → ${to}: ${hit.why}`);
}

// Scans a block of rendered text for an equivalence phrase we must never emit.
export function findForbiddenEquivalence(text) {
  const lower = String(text ?? "").toLowerCase();
  return FORBIDDEN_EQUIVALENCE_PHRASES.filter((p) => lower.includes(p.toLowerCase()));
}

export const VOCABULARY_VERSION = "shadow-semantic-vocabulary/1";
