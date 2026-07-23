// demos/replay/3d/annotation-anchor.js
// Pure annotation-anchoring math for the Audit Room inspector (Flow-inspired "floating panel +
// leader line" pattern). Given the selected card's world position and a comfortable view region,
// decide which side the annotation panel sits on, clamp it into view, guarantee it does not cover
// the card, and return the leader-line endpoints (card boundary → panel edge). No Three.js import —
// scene.js maps these numbers onto objects. The leader line does NOT imply evidence-chain direction;
// it only ties the panel to its record.

// left-side records prefer a panel on their upper-RIGHT; right-side records prefer upper-LEFT.
export function chooseAnnotationSide(cardX, arcCenterX = 0) {
  return cardX < arcCenterX ? "upper-right" : "upper-left";
}

// card: {x,y,z, halfW, halfH}; panel: {halfW, halfH}; view: {minX,maxX,minY,maxY}
export function anchorPanel({ card, panel, view, arcCenterX = 0, gap = 0.18 }) {
  const side = chooseAnnotationSide(card.x, arcCenterX);
  const dir = side === "upper-right" ? 1 : -1;

  // horizontal: beside the card, clamped into the comfortable region
  let px = card.x + dir * (card.halfW + gap + panel.halfW);
  px = Math.max(view.minX + panel.halfW, Math.min(view.maxX - panel.halfW, px));

  // vertical: panel BOTTOM edge sits at least `gap` above the card TOP edge → no overlap by
  // construction. Clamp only the top into view; never pull the bottom below the card top.
  const minPy = card.y + card.halfH + gap + panel.halfH;
  let py = Math.min(minPy, view.maxY - panel.halfH);
  py = Math.max(py, minPy); // if the view is too short, keep it above the card rather than overlap

  const pz = card.z;

  // leader line: from the card boundary (side edge, toward the panel) to the panel's nearest edge.
  const leaderStart = { x: card.x + dir * card.halfW, y: card.y + card.halfH * 0.4, z: card.z + 0.01 };
  const leaderEnd = { x: px - dir * panel.halfW, y: py - panel.halfH, z: pz + 0.01 };

  const overlaps = (py - panel.halfH) < (card.y + card.halfH)
    && Math.abs(px - card.x) < (panel.halfW + card.halfW);

  return { side, position: { x: px, y: py, z: pz }, leaderStart, leaderEnd, overlaps };
}

// Tracking Lost: pin to a stable view-relative position (upper-right of the view). No leader line —
// a world-anchored leader would be dishonest when world tracking is gone.
export function viewRelativeFallback({ panel, view }) {
  return {
    side: "view-fixed",
    position: { x: view.maxX - panel.halfW - 0.1, y: view.maxY - panel.halfH - 0.1, z: 0.6 },
    leaderStart: null,
    leaderEnd: null,
    overlaps: false,
  };
}
