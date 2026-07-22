// P0 (2026-07 deep-audit): the Audit Room's per-card hit proxies are transparent (opacity 0) but were still
// RENDERED (one draw call each, doubled under SBS). They can be made non-rendered (visible=false) with ZERO
// selection change, because THREE's Raycaster ignores `.visible` — only the WebGLRenderer honours it (it
// skips visible=false objects, which is where the draw-call saving comes from). This test PROVES, against
// the CURRENT three revision, that selection is byte-identical whether the hit proxy is visible or not.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

function makeHit(visible) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  m.position.set(0, 0, -2);
  m.visible = visible;
  m.updateMatrixWorld(true);
  return m;
}
function rayHitsThroughCenter(mesh) {
  const rc = new THREE.Raycaster();
  rc.set(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));   // straight at the proxy
  return rc.intersectObjects([mesh], false).length;   // scene.js uses an explicit array (cards.map(c=>c.hit))
}

test("selection is UNCHANGED when the hit proxy is made non-rendered (visible=false)", () => {
  const visibleHits = rayHitsThroughCenter(makeHit(true));
  const invisibleHits = rayHitsThroughCenter(makeHit(false));
  assert.ok(visibleHits >= 1, "sanity: the ray hits the proxy when visible");
  assert.equal(invisibleHits, visibleHits,
    "raycast selection must be identical with visible=false — THREE's Raycaster ignores .visible, so making the proxy non-rendered does not change what the pointer/controller selects");
});

test("a ray that misses the proxy still misses (no false positives introduced)", () => {
  const hit = makeHit(false);
  const rc = new THREE.Raycaster();
  rc.set(new THREE.Vector3(5, 5, 0), new THREE.Vector3(0, 0, -1));   // off to the side
  assert.equal(rc.intersectObjects([hit], false).length, 0);
});

test("REVISION check — this proof is for the version actually shipped (three ^0.160)", () => {
  assert.ok(Number(THREE.REVISION) >= 160, "three revision >= 160 (matches demos/replay/3d)");
});
