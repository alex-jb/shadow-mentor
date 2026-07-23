// shadow-presentation-snapshot / manifest — schema conformance, determinism, claim-binding
// validation, and edit classification. A presentation snapshot is a DERIVED VIEW; these tests pin
// that it cannot override canonical verification and that edits are classified honestly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildBankingSnapshot, buildBankingManifest } from "../fixtures/presentation/build.mjs";
import {
  computeSemanticHash, serializeSnapshot, validateClaimBindings, buildPresentationManifest, classifyEdit,
} from "../lib/presentation-snapshot.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SNAP_SCHEMA = JSON.parse(readFileSync(join(ROOT, "schemas/shadow-presentation-snapshot-v1.schema.json"), "utf8"));
const MAN_SCHEMA = JSON.parse(readFileSync(join(ROOT, "schemas/shadow-presentation-manifest-v1.schema.json"), "utf8"));
const clone = (o) => JSON.parse(JSON.stringify(o));

test("snapshot matches golden + carries required schema fields + derived_view", () => {
  const snap = buildBankingSnapshot();
  const golden = JSON.parse(readFileSync(join(ROOT, "fixtures/presentation/banking-snapshot.golden.json"), "utf8"));
  assert.deepEqual(snap, golden, "built snapshot drifted from golden — regenerate fixtures if intended");
  for (const k of SNAP_SCHEMA.required) assert.ok(k in snap, `missing required ${k}`);
  assert.equal(snap.schema_version, "shadow-presentation-snapshot/v1");
  assert.equal(snap.derived_view, true);
});

test("PRESENTATION-SNAPSHOT-DETERMINISTIC: semantic_hash stable + independent of non-authoritative metadata", () => {
  const a = buildBankingSnapshot();
  const b = buildBankingSnapshot();
  assert.equal(computeSemanticHash(a), computeSemanticHash(b));
  assert.equal(serializeSnapshot(a), serializeSnapshot(b));
  // changing generated_at / snapshot_id / adapter_version must NOT change the semantic hash
  const c = clone(a); c.generated_at = "2026-01-01T00:00:00Z"; c.snapshot_id = "other"; c.adapter_version = "x/9.9.9";
  assert.equal(computeSemanticHash(c), computeSemanticHash(a), "metadata leaked into semantic hash");
});

test("valid claim bindings pass; every claim_marker binds a claim", () => {
  const snap = buildBankingSnapshot();
  const r = validateClaimBindings(snap, { evidence: ["ev.income", "ev.dti", "ev.decision", "ev.pricing"], sources: ["src.paystub.p1", "src.credit.r4"], transforms: ["tf.dti.compute"] });
  assert.ok(r.ok, "expected valid: " + r.errors.join("; "));
});

test("claim binding REJECTS: unknown claim ref, claim_marker without ref, presentation status field, unit mismatch, unit-less number", () => {
  // unknown claim ref
  let s = buildBankingSnapshot(); s.scene_elements[0].claim_refs = ["loan.NOPE"];
  assert.ok(!validateClaimBindings(s).ok);
  // claim_marker without ref
  s = buildBankingSnapshot(); s.scene_elements[0].claim_refs = [];
  assert.ok(!validateClaimBindings(s).ok);
  // scene element carrying a status field (presentation overriding canonical verification)
  s = buildBankingSnapshot(); s.scene_elements[0].status = "VERIFIED";
  assert.ok(!validateClaimBindings(s).ok, "must reject scene-element status field");
  // unit mismatch on a shared value axis
  s = buildBankingSnapshot();
  s.scene_elements.push({ scene_element_id: "el.mix", claim_refs: ["loan.income", "loan.dti"], visual_role: "claim_marker", encoding: { y: { axis: "value" } } });
  assert.ok(!validateClaimBindings(s).ok, "must reject mixed-unit value axis");
  // numeric value without unit
  s = buildBankingSnapshot(); s.claims[0].unit = null;
  assert.ok(!validateClaimBindings(s).ok, "must reject unit-less numeric value");
});

test("unknown evidence/source/transform refs are rejected against the bundle's known sets", () => {
  const s = buildBankingSnapshot();
  const r = validateClaimBindings(s, { evidence: ["ev.income"], sources: ["src.paystub.p1"], transforms: [] });
  assert.ok(!r.ok, "unknown ev.dti / transform must be rejected");
});

test("manifest matches golden + carries required fields + derived_view + is deterministic", () => {
  const man = buildBankingManifest();
  const golden = JSON.parse(readFileSync(join(ROOT, "fixtures/presentation/banking-manifest.golden.json"), "utf8"));
  assert.deepEqual(man, golden);
  for (const k of MAN_SCHEMA.required) assert.ok(k in man, `missing required ${k}`);
  assert.equal(man.derived_view, true);
  // snapshot hash binds the exact snapshot bytes
  const man2 = buildPresentationManifest({ snapshot: buildBankingSnapshot(), adapterName: "threejs-audit-room", adapterVersion: "audit-room/1.0.0" });
  assert.equal(man2.presentation_snapshot_hash, man.presentation_snapshot_hash);
});

test("EDIT-CLASSIFICATION: VISUAL_ONLY vs SEMANTIC_PRESENTATION_CHANGE vs CANONICAL_EVIDENCE_CHANGE", () => {
  const base = buildBankingSnapshot();
  // VISUAL_ONLY: camera hint / generated_at / label position (non-analytical)
  const visual = clone(base); visual.generated_at = "2026-02-02T00:00:00Z";
  visual.story.acts[0].steps[0].camera_hint = { position: [0, 0, 3], target: [0, 0, -3] };
  assert.equal(classifyEdit(base, visual).class, "VISUAL_ONLY");
  // SEMANTIC: changed metric value
  const semantic = clone(base); semantic.claims[1].value = 0.42;
  assert.equal(classifyEdit(base, semantic).class, "SEMANTIC_PRESENTATION_CHANGE");
  // SEMANTIC: added claim / changed data mapping
  const remap = clone(base); remap.scene_elements[0].encoding = { x: { axis: "time" } };
  assert.equal(classifyEdit(base, remap).class, "SEMANTIC_PRESENTATION_CHANGE");
  // CANONICAL: changed approval / source / evidence hash
  const approval = clone(base); approval.claims[2].approval_state = "APPROVAL_PRESENT";
  assert.equal(classifyEdit(base, approval).class, "CANONICAL_EVIDENCE_CHANGE");
  const src = clone(base); src.claims[0].source_ref = "src.OTHER";
  assert.equal(classifyEdit(base, src).class, "CANONICAL_EVIDENCE_CHANGE");
  const bundle = clone(base); bundle.evidence_bundle_hash = "f".repeat(64);
  assert.equal(classifyEdit(base, bundle).class, "CANONICAL_EVIDENCE_CHANGE");
});

test("first-failure and downstream-affected are distinct canonical states in the summary", () => {
  const s = buildBankingSnapshot();
  assert.equal(s.verification_summary.first_failure_claim_ref, "loan.decision");
  assert.equal(s.verification_summary.downstream_affected_count, 1);
  const ff = s.claims.find((c) => c.claim_id === "loan.decision");
  const dn = s.claims.find((c) => c.claim_id === "loan.downstream");
  assert.equal(ff.evaluation_state, "FIRST_FAILURE");
  assert.equal(dn.evaluation_state, "AFFECTED_DOWNSTREAM");
  assert.notEqual(ff.evaluation_state, dn.evaluation_state, "first-failure must not read as downstream");
});
