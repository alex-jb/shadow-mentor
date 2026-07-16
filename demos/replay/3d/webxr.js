// demos/replay/3d/webxr.js
// ─────────────────────────────────────────────────────────────────
// Phase 6 — Quest 3 immersive-ar/vr (user study only, post-launch).
//
// Same scene graph, `mode=webxr`. This mode exists ONLY to run the study:
// flat 2D report vs. spatially anchored (XREAL) vs. immersive (Quest),
// measuring time-to-find-tamper and impact-scope accuracy. It gates behind
// IRB before any participant — but the code is not the blocker, so it is
// built to feature parity: local-floor reference space, smooth glide with a
// motion vignette, teleport to arc waypoints, controller-ray select, and
// hand-pinch select. No new features beyond the flat interactions.
//
// This never runs in the live XREAL demo (macOS Chrome has no immersive-ar).
// It is inert unless a WebXR device is present and the user enters VR.
//
// STUDY-DEPLOYMENT NOTE: WebXR requires a secure context — Quest will NOT
// grant an immersive session from file://. The Quest study condition must be
// served over https (a tiny local https host is enough); the 2D + XREAL
// conditions keep the offline file:// build.
// ─────────────────────────────────────────────────────────────────
import * as THREE from "three";
import { VRButton } from "three/examples/jsm/webxr/VRButton.js";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory.js";
import { XRHandModelFactory } from "three/examples/jsm/webxr/XRHandModelFactory.js";

export function createWebXR({ renderer, scene, camera, room, C, mountButton }) {
  renderer.xr.enabled = true;

  // A dolly holds the camera so we can locomote without moving the head rig.
  const dolly = new THREE.Group();
  dolly.name = "xr-dolly";
  dolly.add(camera);
  scene.add(dolly);

  // Entry button — the one DOM affordance this mode needs (mode entry UI).
  const button = VRButton.createButton(renderer, { requiredFeatures: ["local-floor"] });
  mountButton?.(button);

  const raycaster = new THREE.Raycaster();
  const tmpMatrix = new THREE.Matrix4();
  const controllerModelFactory = new XRControllerModelFactory();
  const handModelFactory = new XRHandModelFactory();
  const controllers = [];

  function addRayLine(ctrl) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
    line.scale.z = 5;
    ctrl.add(line);
  }
  function selectFromController(ctrl) {
    tmpMatrix.identity().extractRotation(ctrl.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(ctrl.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tmpMatrix);
    const seq = room.raycastSeq(raycaster);
    if (seq != null) room.select(seq);
  }

  for (let i = 0; i < 2; i++) {
    const ctrl = renderer.xr.getController(i);
    ctrl.addEventListener("selectstart", () => selectFromController(ctrl));
    addRayLine(ctrl);
    dolly.add(ctrl);
    controllers.push(ctrl);

    const grip = renderer.xr.getControllerGrip(i);
    grip.add(controllerModelFactory.createControllerModel(grip));
    dolly.add(grip);

    const hand = renderer.xr.getHand(i);
    hand.add(handModelFactory.createHandModel(hand, "mesh"));
    // Hand-pinch select. On Quest the standard signal is `selectstart` from
    // the hand input source (a pinch); `pinchstart` is a non-standard alias
    // some runtimes emit, kept as a fallback. Bind both.
    hand.addEventListener("selectstart", () => selectFromController(hand));
    hand.addEventListener("pinchstart", () => selectFromController(hand));
    dolly.add(hand);
  }

  // Teleport waypoints along the arc (parity with beats, in-headset).
  function waypoints() {
    return room.cards.map((c) => {
      const p = c.group.getWorldPosition(new THREE.Vector3());
      const viewer = new THREE.Vector3(0, C.ARC_Y, C.CAMERA_POS[2]);
      const dir = viewer.clone().sub(p).normalize();
      return p.clone().add(dir.multiplyScalar(1.6));
    });
  }
  let waypointIdx = 0;
  function teleportNext() {
    const wp = waypoints();
    waypointIdx = (waypointIdx + 1) % wp.length;
    dolly.position.copy(wp[waypointIdx]).sub(new THREE.Vector3(0, C.ARC_Y, 0));
  }

  // Motion vignette (opaque VR only — never in additive see-through).
  const vignette = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.6, 48),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, side: THREE.DoubleSide, depthTest: false }),
  );
  vignette.position.z = -0.5;
  vignette.renderOrder = 999;
  camera.add(vignette);

  // Smooth glide from the primary thumbstick.
  function update(dt, session) {
    if (!renderer.xr.isPresenting) return;
    let moving = 0;
    const src = session?.inputSources ?? [];
    for (const input of src) {
      const gp = input.gamepad;
      if (!gp || gp.axes.length < 4) continue;
      const x = gp.axes[2] || 0, y = gp.axes[3] || 0;
      if (Math.abs(x) < 0.15 && Math.abs(y) < 0.15) continue;
      moving = Math.max(moving, Math.hypot(x, y));
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
      dolly.position.addScaledVector(forward, -y * C.GLIDE_SPEED * dt);
      dolly.position.addScaledVector(right, x * C.GLIDE_SPEED * dt);
      // secondary button teleports along the arc
      if (gp.buttons?.[4]?.pressed) teleportNext();
    }
    const target = moving > 0 ? 0.55 : 0.0;
    vignette.material.opacity += (target - vignette.material.opacity) * Math.min(1, dt * 8);
  }

  function onSessionLoop(dt) { update(dt, renderer.xr.getSession()); }

  return { dolly, button, update: onSessionLoop, teleportNext, get presenting() { return renderer.xr.isPresenting; } };
}
