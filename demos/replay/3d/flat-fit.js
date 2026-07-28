// demos/replay/3d/flat-fit.js
// Pure Flat-mode fit-to-content math for the Audit Room. Given the card-rail bounds + the viewport
// aspect + the camera vertical FOV, compute the camera distance so the rail fills a target fraction
// of the usable viewport (width AND height constrained, take whichever needs more distance). Flat
// mode only — SBS/XR/ultrawide camera policy is untouched. No Three.js import; app.js applies the
// numbers. Deterministic → unit-testable.

const DEG = Math.PI / 180;

// visible half-extent (world units) at a given distance for a perspective camera
export function visibleHalfWidth(distance, fovVDeg, aspect) {
  const halfH = distance * Math.tan((fovVDeg * DEG) / 2);
  return halfH * aspect;
}
export function visibleHalfHeight(distance, fovVDeg) {
  return distance * Math.tan((fovVDeg * DEG) / 2);
}

// Compute the camera distance (from the card plane) so the rail fills `fill` of width and stays
// within `fillV` of height. bounds: {width, height} of the card rail (world units).
export function fitDistance({ width, height }, { aspect, fovVDeg, fill = 0.78, fillV = 0.4 }) {
  const tanV = Math.tan((fovVDeg * DEG) / 2);
  // width constraint: width = fill * (2 * D * tanV * aspect)  → D = width / (fill * 2 * tanV * aspect)
  const dW = width / (fill * 2 * tanV * aspect);
  // height constraint: height = fillV * (2 * D * tanV)         → D = height / (fillV * 2 * tanV)
  const dH = height / (fillV * 2 * tanV);
  return Math.max(dW, dH);
}

// Full Flat framing: returns the camera z + the fraction of viewport the rail will occupy, given the
// card rail bounding box (front z + x/y extents). Camera looks down -z at the rail centre.
export function flatCameraFrame(rail, view) {
  // rail: {minX,maxX,minY,maxY,frontZ,centerZ}; view: {aspect, fovVDeg, fill?, fillV?, minDistance?, maxDistance?}
  const width = rail.maxX - rail.minX;
  const height = rail.maxY - rail.minY;
  let d = fitDistance({ width, height }, view);
  const minD = view.minDistance ?? 2.2, maxD = view.maxDistance ?? 40;
  d = Math.min(maxD, Math.max(minD, d));
  const cameraZ = rail.frontZ + d;
  const occWidth = width / (2 * visibleHalfWidth(d, view.fovVDeg, view.aspect));
  const occHeight = height / (2 * visibleHalfHeight(d, view.fovVDeg));
  return {
    distance: d,
    cameraZ,
    occupiesWidthFraction: occWidth,
    occupiesHeightFraction: occHeight,
    centerX: (rail.minX + rail.maxX) / 2,
    centerY: (rail.minY + rail.maxY) / 2,
  };
}
