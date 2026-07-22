// Shadow spatial props — repository-owned procedural Three.js geometry (img2threejs output style).
// APPROVED output (post-review): materials capped at 2 per prop (a primary + a neutral accent) to meet
// the mobile budget, geometry merged where trivial. Each factory returns a THREE.Group with named
// sockets in userData.sculptRuntime.sockets; NO canonical entity IDs are baked in. VISUAL ONLY — the
// prop geometry NEVER carries evidence meaning, verification status, sequence state, source truth,
// analytical correctness, or human approval. The integration recolours the primary material from the
// Shadow semantic vocabulary, so status is never encoded by the prop itself.
// EXPERIMENTAL VISUAL PROP · NOT DEVICE VALIDATED.
import * as THREE from "three";

function newProp(kind) {
  const g = new THREE.Group();
  // two shared materials only: [0] primary (recoloured by status at integration), [1] neutral accent.
  const primary = new THREE.MeshStandardMaterial({ color: 0x60a5fa, metalness: 0.2, roughness: 0.6 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x8a92a0, metalness: 0.15, roughness: 0.75 });
  g.userData.sculptRuntime = { kind, sockets: {}, materials: [primary, accent], provenance: "img2threejs-style, Shadow-authored, MIT" };
  return g;
}
const P = (g) => g.userData.sculptRuntime.materials[0];
const A = (g) => g.userData.sculptRuntime.materials[1];
function socket(g, name, pos) {
  const s = new THREE.Object3D(); s.name = name; s.position.set(...pos);
  g.add(s); g.userData.sculptRuntime.sockets[name] = s; return s;
}

// A — Evidence Bundle: a portable grouped package (wrapped stack), NOT a database/server.
export function createEvidenceBundle() {
  const g = newProp("evidence_bundle");
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.36), P(g));
  const card1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.3), P(g)); card1.position.set(-0.03, 0.08, 0.02);
  const card2 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.3), P(g)); card2.position.set(0.03, 0.11, -0.02); card2.rotation.y = 0.08;
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.015, 6, 16), A(g)); strap.rotation.x = Math.PI / 2; strap.position.y = 0.06;
  g.add(base, card1, card2, strap);
  socket(g, "source_socket", [-0.28, 0.06, 0]);
  socket(g, "claim_socket", [0, 0.16, 0]);
  socket(g, "seal_socket", [0.28, 0.06, 0]);
  return g;
}

// B — Cryptographic Seal: a record has been sealed. Disc-seal with embossed ring + notch; NOT a
// checkmark/badge (must not imply correctness/compliance/approval).
export function createCryptographicSeal() {
  const g = newProp("cryptographic_seal");
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 20), P(g));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 6, 20), P(g)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.035;
  const notch = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.04), A(g)); notch.position.set(0, 0.02, 0.2);
  g.add(disc, ring, notch);
  socket(g, "record_socket", [0, -0.04, 0]);
  socket(g, "signature_socket", [0, 0.08, 0]);
  socket(g, "verifier_socket", [0, 0.02, 0.24]);
  return g;
}

// C — Human Review Checkpoint: explicit human review required or recorded. Gate frame + a DISTINCT
// state marker per state (never one shape for all four).
export const HUMAN_REVIEW_STATES = ["REQUIRES_HUMAN_REVIEW", "HUMAN_REVIEW_RECORDED", "HUMAN_APPROVAL_NOT_PRESENT", "HUMAN_APPROVAL_PRESENT"];
export function createHumanReviewCheckpoint(state = "REQUIRES_HUMAN_REVIEW") {
  const g = newProp("human_review_checkpoint");
  g.userData.sculptRuntime.state = state;
  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.05), P(g)); postL.position.set(-0.16, 0.17, 0);
  const postR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.05), P(g)); postR.position.set(0.16, 0.17, 0);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.05, 0.05), P(g)); lintel.position.set(0, 0.36, 0);
  g.add(postL, postR, lintel);
  let marker;   // distinct geometry per state — the accent material, so still 2 materials total
  if (state === "REQUIRES_HUMAN_REVIEW") { marker = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 16), A(g)); marker.rotation.x = Math.PI / 2; }
  else if (state === "HUMAN_REVIEW_RECORDED") { marker = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.02, 0.11), A(g)); }
  else if (state === "HUMAN_APPROVAL_NOT_PRESENT") { marker = new THREE.Mesh(new THREE.CylinderGeometry(0.001, 0.07, 0.12, 4), A(g)); }
  else { marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), A(g)); }
  marker.position.set(0, 0.17, 0); g.add(marker);
  g.userData.sculptRuntime.stateMarker = marker.geometry.type;
  socket(g, "incoming_claim_socket", [-0.24, 0.17, 0]);
  socket(g, "reviewer_action_socket", [0, 0.17, 0.14]);
  socket(g, "decision_output_socket", [0.24, 0.17, 0]);
  return g;
}

// A11y label text + 2D icon fallback glyph per prop/state — external to the mesh (never baked in).
export const PROP_A11Y = {
  evidence_bundle: { en: "evidence bundle — a grouped package of evidence (not a source of truth)", zh: "证据包——一组打包的证据(非真相来源)", icon2d: "▤" },
  cryptographic_seal: { en: "cryptographic seal — the record was sealed (not a correctness/approval claim)", zh: "密码学封印——记录已封存(不代表正确或批准)", icon2d: "◉" },
  human_review_checkpoint: {
    REQUIRES_HUMAN_REVIEW: { en: "requires human review", zh: "需要人工复核", icon2d: "◌" },
    HUMAN_REVIEW_RECORDED: { en: "human review recorded", zh: "已记录人工复核", icon2d: "▭" },
    HUMAN_APPROVAL_NOT_PRESENT: { en: "human approval not present", zh: "人工批准尚未存在", icon2d: "▽" },
    HUMAN_APPROVAL_PRESENT: { en: "human approval present", zh: "人工批准已存在", icon2d: "◆" },
  },
};

// Dispose all generated geometry + the (shared) materials of a prop group.
export function disposeProp(g) {
  g.traverse((o) => { if (o.isMesh) o.geometry?.dispose(); });
  (g.userData.sculptRuntime?.materials || []).forEach((m) => m.dispose());
}

export const PROPS = { createEvidenceBundle, createCryptographicSeal, createHumanReviewCheckpoint };
