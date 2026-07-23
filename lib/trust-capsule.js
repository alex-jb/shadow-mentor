// Shadow Trust Capsule — an honest, compact, expandable trust summary. The whole point is that it
// does NOT collapse eight different trust dimensions into one generic green check: integrity can be
// VERIFIED while analytical correctness is NOT_EVALUATED, approval is APPROVAL_NOT_PRESENT, and the
// posture is only SELF_SIGNED. Every dimension resolves to a canonical GENERATED semantic token
// (text + icon + shape + colour + a11y, EN/ZH) — never colour alone. Pure model; renderers (browser,
// Unity, Three.js) consume it. Statuses come from generated/shadow-semantic-tokens.generated.js.
import { SHADOW_SEMANTIC_TOKENS } from "../generated/shadow-semantic-tokens.generated.js";

// dimension key → canonical token id (category.KEY) for a given status value
function tok(id) {
  const t = SHADOW_SEMANTIC_TOKENS[id];
  if (!t) throw new Error("trust-capsule: unknown token " + id);
  return { text: t.text, text_zh: t.textZh, icon: t.icon, shape: t.shape, color: t.color, a11y: t.a11y, a11y_zh: t.a11yZh };
}

const STATUS_TO_TOKEN = {
  // integrity / correctness family
  VERIFIED: "status.VERIFIED",
  FAILED: "status.FAILED",
  FIRST_FAILURE: "status.FIRST_FAILURE",
  AFFECTED_DOWNSTREAM: "status.DOWNSTREAM_AFFECTED",
  WARNING: "status.WARNING",
  NOT_EVALUATED: "status.NOT_EVALUATED",
  // governance
  REQUIRES_HUMAN_REVIEW: "governance.REQUIRES_HUMAN_REVIEW",
  HUMAN_REVIEW_RECORDED: "governance.HUMAN_REVIEW_RECORDED",
  APPROVAL_NOT_PRESENT: "governance.APPROVAL_NOT_PRESENT",
  APPROVAL_PRESENT: "governance.APPROVAL_PRESENT",
  ABSTAINED: "governance.ABSTAINED",
  // trust posture
  SELF_SIGNED: "trust_posture.SELF_SIGNED",
  TIME_ANCHORED_STRUCTURAL: "trust_posture.TIME_ANCHORED_STRUCTURAL",
  TIME_ANCHORED: "trust_posture.TIME_ANCHORED",
  // source resolution reuses the status family
  PRESENT: "status.VERIFIED",
  NOT_PRESENT: "status.NOT_PRESENT",
};

function resolve(status) {
  const id = STATUS_TO_TOKEN[status];
  if (!id) throw new Error("trust-capsule: unmapped status " + status);
  return { status, ...tok(id) };
}

// Build the capsule from a snapshot's summaries. Each field defaults to the HONEST conservative
// state — correctness NOT_EVALUATED, approval APPROVAL_NOT_PRESENT, posture SELF_SIGNED, external
// anchor NOT_EVALUATED — so nothing reads as verified that hasn't been.
export function buildTrustCapsule(input = {}) {
  const {
    integrity = "VERIFIED",
    source_resolution = "PRESENT",
    analytical_correctness = "NOT_EVALUATED",
    human_review = "HUMAN_REVIEW_RECORDED",
    approval = "APPROVAL_NOT_PRESENT",
    trust_posture = "SELF_SIGNED",
    external_anchor = "NOT_EVALUATED",
  } = input;

  const dimensions = [
    { key: "evidence_integrity", label: "Evidence integrity", label_zh: "证据完整性", ...resolve(integrity) },
    { key: "source_links", label: "Source links", label_zh: "来源链接", ...resolve(source_resolution) },
    { key: "analytical_correctness", label: "Analytical correctness", label_zh: "分析正确性", ...resolve(analytical_correctness) },
    { key: "human_review", label: "Human review", label_zh: "人工审核", ...resolve(human_review) },
    { key: "human_approval", label: "Human approval", label_zh: "人工审批", ...resolve(approval) },
    { key: "trust_posture", label: "Trust posture", label_zh: "信任姿态", ...resolve(trust_posture) },
    { key: "external_anchoring", label: "External anchoring", label_zh: "外部锚定", ...resolve(external_anchor) },
    { key: "open_verifier", label: "Open independent verifier", label_zh: "开放独立验证器", status: "ACTION", text: "OPEN VERIFIER", text_zh: "打开验证器", icon: "external-link", shape: "pill", color: "#3b82f6", a11y: "open the offline independent verifier", a11y_zh: "打开离线独立验证器" },
  ];

  // collapsed line reflects the INTEGRITY state only — it never implies correctness/approval.
  const integrityTok = resolve(integrity);
  const collapsed = {
    brand: "SHADOW",
    label: `INTEGRITY ${integrityTok.text}`,
    label_zh: `完整性 ${integrityTok.text_zh}`,
    status: integrity,
    color: integrityTok.color,
  };
  return { collapsed, dimensions };
}

// Guard used by tests + renderers: the capsule must NOT show one generic green check everywhere.
export function assertNotAllGreen(capsule) {
  const GREEN = "#4ade80";
  const greens = capsule.dimensions.filter((d) => (d.color || "").toLowerCase() === GREEN);
  if (greens.length === capsule.dimensions.length) throw new Error("trust-capsule: all dimensions green (dishonest)");
  return true;
}
