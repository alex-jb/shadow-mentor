// Isolated integration layer for the experimental spatial props. It attaches a prop as an OPTIONAL
// visual to an existing canonical entity, keyed by entity KIND (never by canonical id, and never
// changing the id). Status colour still comes from the Shadow semantic vocabulary (applied to the
// prop's primary material); the prop geometry itself carries no meaning. Feature-gated by
// SHADOW_EXPERIMENTAL_SPATIAL_PROPS (default OFF). Disposes correctly. EXPERIMENTAL · NOT DEVICE VALIDATED.
import * as THREE from "three";
import { PROPS, PROP_A11Y, disposeProp } from "../approved/shadow-props.mjs";
import { statusVisual } from "../../../prototypes/shadow-3d-v2/src/shadow-status-materials.mjs";

// Which canonical entity KIND gets which prop (visual only). Signature→seal, audit_record→bundle,
// synthesis→human-review checkpoint. Nothing else is decorated.
export const KIND_TO_PROP = {
  signature: "cryptographic_seal",
  audit_record: "evidence_bundle",
  synthesis: "human_review_checkpoint",
};

// Map a dimension/entity status to a human-review checkpoint STATE (visual distinction only; the
// authoritative status stays in the panel + semantic vocabulary).
function humanReviewStateFor(node, sceneModel) {
  const hp = sceneModel.trust_dimensions?.find((d) => d.dimension === "HUMAN_APPROVAL");
  if (node.status === "REQUIRES_HUMAN_REVIEW") return "REQUIRES_HUMAN_REVIEW";
  if (hp?.status === "PRESENT" || hp?.status === "VERIFIED") return "HUMAN_APPROVAL_PRESENT";
  if (hp?.status === "NOT_PRESENT") return "HUMAN_APPROVAL_NOT_PRESENT";
  return "HUMAN_REVIEW_RECORDED";
}

export class ShadowPropLayer {
  constructor(root, enabled = false) { this.root = root; this.enabled = enabled; this.props = new Map(); }

  // Build/refresh props for the current scene model. No-op (and clears) when disabled.
  sync(sceneModel) {
    this.clear();
    if (!this.enabled || !sceneModel) return;
    for (const n of sceneModel.nodes) {
      const propKind = KIND_TO_PROP[n.kind];
      if (!propKind) continue;
      let g, a11yKey;
      if (propKind === "cryptographic_seal") { g = PROPS.createCryptographicSeal(); a11yKey = "cryptographic_seal"; }
      else if (propKind === "evidence_bundle") { g = PROPS.createEvidenceBundle(); a11yKey = "evidence_bundle"; }
      else { const st = humanReviewStateFor(n, sceneModel); g = PROPS.createHumanReviewCheckpoint(st); a11yKey = st; }
      // status colour from the Shadow vocabulary — applied to the prop's PRIMARY material only.
      const v = statusVisual(n.status);
      g.userData.sculptRuntime.materials[0].color.setHex(v.color);
      // place beside the canonical node, slightly below, scaled down; carries the canonical id ONLY as
      // an opaque back-reference in userData (not baked into geometry), for selection mapping.
      g.scale.setScalar(0.5);
      g.position.set(n.pos[0], n.pos[1] - 0.45, n.pos[2]);
      g.userData.canonicalRef = n.id;   // selection maps back to the canonical entity; geometry has no id
      g.userData.a11y = propKind === "human_review_checkpoint" ? PROP_A11Y.human_review_checkpoint[g.userData.sculptRuntime.state] : PROP_A11Y[a11yKey];
      this.root.add(g);
      this.props.set(n.id, g);
    }
  }

  // Selection still resolves to the canonical entity id (props never become the selection source).
  canonicalRefAt(object3d) {
    let o = object3d;
    while (o) { if (o.userData?.canonicalRef) return o.userData.canonicalRef; o = o.parent; }
    return null;
  }

  clear() {
    for (const g of this.props.values()) { this.root.remove(g); disposeProp(g); }
    this.props.clear();
  }
  setEnabled(on) { this.enabled = on; }
}
