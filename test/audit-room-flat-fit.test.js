// Pure Flat fit-to-content math for the Audit Room. Proves the rail fills a useful fraction of the
// viewport across desktop aspect ratios and stays within bounded distance — the numeric contract the
// browser composition relies on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fitDistance, flatCameraFrame, visibleHalfWidth } from "../demos/replay/3d/flat-fit.js";

// the demo rail: 12 cards over x∈[-3.24,3.24], modest y extent, front plane a bit ahead of centre
const RAIL = { minX: -3.24, maxX: 3.24, minY: -0.35, maxY: 0.35, frontZ: -2.6, centerZ: -3.0 };
const VIEWS = [
  { name: "1920x1080", aspect: 1920 / 1080 },
  { name: "1680x1050", aspect: 1680 / 1050 },
  { name: "1440x900", aspect: 1440 / 900 },
  { name: "1366x768", aspect: 1366 / 768 },
  { name: "2560x1080", aspect: 2560 / 1080 },
];
const FOV = 55;

test("FLAT-FIT: rail occupies ~70–82% width (or is height-limited) across desktop aspects", () => {
  for (const v of VIEWS) {
    const f = flatCameraFrame(RAIL, { aspect: v.aspect, fovVDeg: FOV, fill: 0.78, fillV: 0.4 });
    // width fraction never exceeds the target (never overflows), and unless height-limited, is useful
    assert.ok(f.occupiesWidthFraction <= 0.82 + 1e-6, `${v.name}: width ${f.occupiesWidthFraction} overflows`);
    assert.ok(f.occupiesHeightFraction <= 0.4 + 1e-6, `${v.name}: height ${f.occupiesHeightFraction} overflows`);
    // at least one dimension is meaningfully filled (not a tiny distant rail)
    assert.ok(f.occupiesWidthFraction >= 0.6 || f.occupiesHeightFraction >= 0.34, `${v.name}: rail too small (${f.occupiesWidthFraction.toFixed(2)}w/${f.occupiesHeightFraction.toFixed(2)}h)`);
    // distance stays bounded + camera in front of the rail
    assert.ok(f.distance >= 2.2 && f.distance <= 40, `${v.name}: distance ${f.distance} out of bounds`);
    assert.ok(f.cameraZ > RAIL.frontZ, `${v.name}: camera must be in front of the rail`);
  }
});

test("FLAT-FIT: narrower viewport pushes the camera further back (deterministic monotonicity)", () => {
  const wide = flatCameraFrame(RAIL, { aspect: 2560 / 1080, fovVDeg: FOV });
  const narrow = flatCameraFrame(RAIL, { aspect: 1366 / 768, fovVDeg: FOV });
  assert.ok(narrow.distance >= wide.distance - 1e-9, "narrower aspect needs >= distance to fit the width");
});

test("FLAT-FIT: deterministic — same inputs give identical framing", () => {
  const a = flatCameraFrame(RAIL, { aspect: 16 / 9, fovVDeg: FOV });
  const b = flatCameraFrame(RAIL, { aspect: 16 / 9, fovVDeg: FOV });
  assert.deepEqual(a, b);
});

test("FLAT-FIT: fitDistance width constraint matches visibleHalfWidth inverse", () => {
  const d = fitDistance({ width: 6.48, height: 0.7 }, { aspect: 16 / 9, fovVDeg: FOV, fill: 0.78, fillV: 0.4 });
  const visW = 2 * visibleHalfWidth(d, FOV, 16 / 9);
  assert.ok(Math.abs(6.48 / visW - 0.78) < 1e-6 || 0.7 / (2 * d * Math.tan((FOV * Math.PI / 180) / 2)) >= 0.4 - 1e-6,
    "distance satisfies the width fill (or is height-limited)");
});
