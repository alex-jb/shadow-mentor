// Deterministic presentation-snapshot fixture for the Banking guided story. Sanitized display
// content only — it does NOT alter any canonical evidence. Used to golden-test
// lib/presentation-snapshot.js. Re-run: node fixtures/presentation/build.mjs > golden.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildPresentationSnapshot, buildPresentationManifest } from "../../lib/presentation-snapshot.js";

const H = (c) => c.repeat(64); // fixed 64-hex placeholders (fixture only; no real signatures here)

export function buildBankingSnapshot() {
  const claims = [
    { claim_id: "loan.income", claim_text: "Stated annual income", claim_text_zh: "申报年收入",
      value: 84000, unit: "USD/yr", source_ref: "src.paystub.p1", evidence_ref: "ev.income",
      transform_ref: null, data_commitment: H("a"),
      evaluation_state: "NOT_EVALUATED", human_review_state: "HUMAN_REVIEW_RECORDED", approval_state: "APPROVAL_NOT_PRESENT", attestation_ref: "att.income" },
    { claim_id: "loan.dti", claim_text: "Debt-to-income ratio", claim_text_zh: "债务收入比",
      value: 0.31, unit: "ratio", source_ref: "src.credit.r4", evidence_ref: "ev.dti",
      transform_ref: "tf.dti.compute", data_commitment: H("b"),
      evaluation_state: "VERIFIED", human_review_state: "HUMAN_REVIEW_RECORDED", approval_state: "APPROVAL_NOT_PRESENT", attestation_ref: "att.dti" },
    { claim_id: "loan.decision", claim_text: "Council recommendation", claim_text_zh: "委员会建议",
      value: null, unit: null, source_ref: null, evidence_ref: "ev.decision",
      transform_ref: null, data_commitment: H("c"),
      evaluation_state: "FIRST_FAILURE", human_review_state: "REQUIRES_HUMAN_REVIEW", approval_state: "APPROVAL_NOT_PRESENT", attestation_ref: "att.decision" },
    { claim_id: "loan.downstream", claim_text: "Pricing tier (downstream of decision)", claim_text_zh: "定价档位(决策下游)",
      value: null, unit: null, source_ref: null, evidence_ref: "ev.pricing",
      transform_ref: null, data_commitment: H("d"),
      evaluation_state: "AFFECTED_DOWNSTREAM", human_review_state: "NOT_EVALUATED", approval_state: "APPROVAL_NOT_PRESENT", attestation_ref: null },
  ];
  const sceneElements = [
    { scene_element_id: "el.income", claim_refs: ["loan.income"], visual_role: "claim_marker",
      encoding: { x: { axis: "sequence" }, y: { field: "value", axis: "value" } }, missing_data_behavior: "explicit_unknown", not_evaluated_behavior: "explicit_not_evaluated" },
    { scene_element_id: "el.dti", claim_refs: ["loan.dti"], visual_role: "claim_marker",
      encoding: { x: { axis: "sequence" } }, missing_data_behavior: "explicit_unknown", not_evaluated_behavior: "neutral" },
    { scene_element_id: "el.decision", claim_refs: ["loan.decision"], visual_role: "claim_marker",
      encoding: { x: { axis: "sequence" } }, missing_data_behavior: "explicit_unknown", not_evaluated_behavior: "explicit_not_evaluated" },
    { scene_element_id: "el.downstream", claim_refs: ["loan.downstream"], visual_role: "claim_marker",
      encoding: { x: { axis: "sequence" } }, missing_data_behavior: "explicit_unknown", not_evaluated_behavior: "explicit_not_evaluated" },
    { scene_element_id: "el.axis.seq", claim_refs: [], visual_role: "axis_label", encoding: { x: { axis: "sequence" } } },
  ];
  const story = {
    story_id: "banking-guided-v1",
    acts: [{ act_id: "act.review", label: "Review", steps: [
      { step_id: "s1", label: "Income", label_zh: "收入", scene_element_refs: ["el.income"] },
      { step_id: "s2", label: "DTI", label_zh: "债务收入比", scene_element_refs: ["el.dti"] },
      { step_id: "s3", label: "Decision", label_zh: "决策", scene_element_refs: ["el.decision"] },
    ] }],
  };
  return buildPresentationSnapshot({
    snapshotId: "banking-snap-0001",
    evidenceBundleId: "bundle-banking-0001",
    evidenceBundleHash: H("e"),
    adapterVersion: "presentation-snapshot/1.0.0",
    claims, sceneElements, story,
    verificationSummary: { overall: "FIRST_FAILURE", first_failure_claim_ref: "loan.decision", downstream_affected_count: 1, external_anchor: "NOT_EVALUATED" },
    governanceSummary: { human_review: "REQUIRES_HUMAN_REVIEW", approval: "APPROVAL_NOT_PRESENT", trust_posture: "SELF_SIGNED" },
  });
}

export function buildBankingManifest() {
  return buildPresentationManifest({ snapshot: buildBankingSnapshot(), adapterName: "threejs-audit-room", adapterVersion: "audit-room/1.0.0" });
}

// CLI: write goldens
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = dirname(fileURLToPath(import.meta.url));
  writeFileSync(join(dir, "banking-snapshot.golden.json"), JSON.stringify(buildBankingSnapshot(), null, 2) + "\n");
  writeFileSync(join(dir, "banking-manifest.golden.json"), JSON.stringify(buildBankingManifest(), null, 2) + "\n");
  console.log("wrote banking-snapshot.golden.json + banking-manifest.golden.json");
}
