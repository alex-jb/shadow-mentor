// Shadow spatial props — repository-owned procedural Three.js geometry (img2threejs output style).
// RAW authored output (pre-review). Each factory returns a THREE.Group with named sockets in
// userData.sculptRuntime.sockets (pivots for attaching labels/attachments), NO canonical entity IDs
// baked in, low-poly for mobile/XR. These are VISUAL ONLY — they never carry evidence meaning,
// verification status, sequence state, source truth, analytical correctness, or human approval.
// EXPERIMENTAL VISUAL PROP · NOT DEVICE VALIDATED.
import * as THREE from "three";

// Shared low-poly helpers. Colours are placeholders; the integration recolours from the Shadow
// semantic vocabulary so status is NEVER encoded by the prop geometry itself.
const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, metalness: 0.15, roughness: 0.65, ...opts });
function socket(group, name, pos) {
  const s = new THREE.Object3D(); s.name = name; s.position.set(...pos);
  group.add(s); group.userData.sculptRuntime.sockets[name] = s;
  return s;
}
function newProp(kind) {
  const g = new THREE.Group();
  g.userData.sculptRuntime = { kind, sockets: {}, tris: 0, meshes: 0, provenance: "img2threejs-style, Shadow-authored, MIT" };
  return g;
}

// A — Evidence Bundle: a portable grouped package (a flat wrapped stack), NOT a database/server.
// Reads as "a set of things carried together", not "the source of truth".
export function createEvidenceBundle(m0 = 0x60a5fa) {
  const g = newProp("evidence_bundle");
  // a low wrapped slab + two offset cards peeking out (a bundle, not a cylinder-DB)
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.36), mat(m0));
  const card1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.3), mat(m0, { roughness: 0.8 })); card1.position.set(-0.03, 0.08, 0.02);
  const card2 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.3), mat(m0, { roughness: 0.8 })); card2.position.set(0.03, 0.11, -0.02); card2.rotation.y = 0.08;
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.015, 6, 16), mat(0x8a92a0)); strap.rotation.x = Math.PI / 2; strap.position.y = 0.06;
  g.add(base, card1, card2, strap);
  socket(g, "source_socket", [-0.28, 0.06, 0]);
  socket(g, "claim_socket", [0, 0.16, 0]);
  socket(g, "seal_socket", [0.28, 0.06, 0]);
  return g;
}

// B — Cryptographic Seal: a record has been sealed. A disc-seal with an embossed ring + notch,
// NOT a checkmark/badge — it must not imply correctness/compliance/approval.
export function createCryptographicSeal(m0 = 0x4ade80) {
  const g = newProp("cryptographic_seal");
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 24), mat(m0, { metalness: 0.4 }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 8, 24), mat(m0, { metalness: 0.5 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.035;
  const notch = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.04), mat(0x8a92a0)); notch.position.set(0, 0.02, 0.2);
  g.add(disc, ring, notch);
  socket(g, "record_socket", [0, -0.04, 0]);
  socket(g, "signature_socket", [0, 0.08, 0]);
  socket(g, "verifier_socket", [0, 0.02, 0.24]);
  return g;
}

// C — Human Review Checkpoint: explicit human review required or recorded. A gate/frame with a
// person-notch and a distinct STATE marker. FOUR states must look different (not one shape):
//   REQUIRES_HUMAN_REVIEW · HUMAN_REVIEW_RECORDED · HUMAN_APPROVAL_NOT_PRESENT · HUMAN_APPROVAL_PRESENT
export const HUMAN_REVIEW_STATES = ["REQUIRES_HUMAN_REVIEW", "HUMAN_REVIEW_RECORDED", "HUMAN_APPROVAL_NOT_PRESENT", "HUMAN_APPROVAL_PRESENT"];
export function createHumanReviewCheckpoint(state = "REQUIRES_HUMAN_REVIEW", m0 = 0xfbbf24) {
  const g = newProp("human_review_checkpoint");
  g.userData.sculptRuntime.state = state;
  // a gate frame (two posts + lintel) — a checkpoint you must pass through
  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.05), mat(m0)); postL.position.set(-0.16, 0.17, 0);
  const postR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.05), mat(m0)); postR.position.set(0.16, 0.17, 0);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.05, 0.05), mat(m0)); lintel.position.set(0, 0.36, 0);
  g.add(postL, postR, lintel);
  // a distinct state marker in the gateway — DIFFERENT geometry per state (never the same shape):
  let marker;
  if (state === "REQUIRES_HUMAN_REVIEW") { marker = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 8, 20), mat(0xfbbf24)); marker.rotation.x = Math.PI / 2; }   // open ring = pending
  else if (state === "HUMAN_REVIEW_RECORDED") { marker = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.02, 0.11), mat(0x60a5fa)); }                                   // flat plate = recorded (neutral)
  else if (state === "HUMAN_APPROVAL_NOT_PRESENT") { marker = new THREE.Mesh(new THREE.CylinderGeometry(0.001, 0.07, 0.12, 4), mat(0x8a92a0)); }                     // hollow cone/absence = not present
  else /* HUMAN_APPROVAL_PRESENT */ { marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), mat(0x4ade80)); }                                               // solid octahedron = present
  marker.position.set(0, 0.17, 0); g.add(marker);
  g.userData.sculptRuntime.stateMarker = marker.geometry.type;
  socket(g, "incoming_claim_socket", [-0.24, 0.17, 0]);
  socket(g, "reviewer_action_socket", [0, 0.17, 0.14]);
  socket(g, "decision_output_socket", [0.24, 0.17, 0]);
  return g;
}

export const PROPS = { createEvidenceBundle, createCryptographicSeal, createHumanReviewCheckpoint };
