// Experimental spatial props (img2threejs spike) — safety + budget guards. The props are VISUAL ONLY:
// they carry no canonical id in geometry, meet the mobile budget (<=2 materials, <5k tris, 0 textures),
// give the four human-review states DISTINCT geometry, and never change the semantic hash. This test
// pins those invariants so an experimental prop can never drift into an authoritative source.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as THREE from "../prototypes/shadow-3d-v2/vendor/three.module.js";
import { PROPS, HUMAN_REVIEW_STATES, PROP_A11Y, disposeProp } from "../experiments/img2threejs/approved/shadow-props.mjs";
import { KIND_TO_PROP } from "../experiments/img2threejs/prototype/props-integration.mjs";
import { compile } from "../tools/compile-shadow-guided-story.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function measure(g) {
  let tris = 0, meshes = 0; const mats = new Set(); let tex = 0;
  g.traverse((o) => { if (o.isMesh) { meshes++; if (o.material) { mats.add(o.material.uuid); if (o.material.map) tex++; }
    const idx = o.geometry.index, pos = o.geometry.attributes.position; tris += idx ? idx.count / 3 : (pos ? pos.count / 3 : 0); } });
  return { tris, meshes, materials: mats.size, textures: tex };
}

test("every prop meets the mobile budget (<=2 materials, <5000 tris, 0 textures)", () => {
  const groups = [PROPS.createEvidenceBundle(), PROPS.createCryptographicSeal(),
    ...HUMAN_REVIEW_STATES.map((s) => PROPS.createHumanReviewCheckpoint(s))];
  for (const g of groups) {
    const m = measure(g);
    assert.ok(m.materials <= 2, `materials ${m.materials} > 2`);
    assert.ok(m.tris < 5000, `tris ${m.tris} >= 5000 target`);
    assert.equal(m.textures, 0, "no textures");
    disposeProp(g);
  }
});

test("prop geometry never bakes in a canonical entity id", () => {
  const raw = readFileSync(join(ROOT, "experiments/img2threejs/approved/shadow-props.mjs"), "utf8");
  assert.equal(/banking-v1:|persona:|rc:/.test(raw), false, "no canonical id literals in prop geometry code");
});

test("the four human-review states have DISTINCT geometry (not one shape)", () => {
  const markers = HUMAN_REVIEW_STATES.map((s) => PROPS.createHumanReviewCheckpoint(s).userData.sculptRuntime.stateMarker);
  assert.equal(new Set(markers).size, 4, `expected 4 distinct state markers, got ${markers.join(",")}`);
});

test("each prop + state has a bilingual a11y label + a 2D icon fallback (external to the mesh)", () => {
  for (const k of ["evidence_bundle", "cryptographic_seal"]) {
    assert.ok(PROP_A11Y[k].en && PROP_A11Y[k].zh && PROP_A11Y[k].icon2d, `${k} a11y`);
  }
  for (const s of HUMAN_REVIEW_STATES) {
    const a = PROP_A11Y.human_review_checkpoint[s];
    assert.ok(a.en && a.zh && a.icon2d, `${s} a11y`);
  }
});

test("props decorate only signature/audit_record/synthesis kinds — never a semantic status", () => {
  assert.deepEqual(Object.keys(KIND_TO_PROP).sort(), ["audit_record", "signature", "synthesis"]);
  // the a11y copy never AFFIRMS verified/compliant/approved — strip the negated disclaimer first
  // ("not a correctness/approval claim" is the honest disclaimer, not an affirmative claim).
  const seal = PROP_A11Y.cryptographic_seal.en.toLowerCase().replace(/not a[^)]*/g, "");
  assert.equal(/\b(is correct|is compliant|is approved|approved\b)/.test(seal), false, "seal must not AFFIRM correctness/compliance/approval");
  assert.match(PROP_A11Y.cryptographic_seal.en, /not a/i, "seal explicitly disclaims correctness/approval");
});

test("the prop layer does not change the semantic hash (visual attachment only)", () => {
  for (const id of ["audit-chain", "reason-code-attestation", "persona-deliberation"]) {
    const story = JSON.parse(readFileSync(join(ROOT, `fixtures/guided-stories/${id}.guided-story.json`), "utf8"));
    assert.equal(compile(story, { target: "threejs" }).semantic_hash, compile(story, { target: "threejs" }).semantic_hash, id);
  }
});
