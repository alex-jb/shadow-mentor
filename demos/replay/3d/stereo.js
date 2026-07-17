// demos/replay/3d/stereo.js
// ─────────────────────────────────────────────────────────────────
// Stereo (SBS) rendering — Phase 2. The Eye pins the screen in the room;
// side-by-side gives the chain real depth. Together this is the thing a
// laptop cannot do.
//
// We compute correct per-eye view/projection matrices with THREE.StereoCamera
// (NOT the deprecated THREE.StereoEffect) and then render the two-viewport
// pass ourselves: left half / right half of ONE canvas, each at full output
// resolution via scissor + viewport. EYE_SEP is tuned live with [ and ] and
// persisted to localStorage (this is a built site — localStorage is correct
// here). Convergence (Phase 2.4) is driven by the camera focus distance so
// the nearest card sits slightly inside the screen plane, far cards behind.
// ─────────────────────────────────────────────────────────────────
import * as THREE from "three";

const LS_EYE_SEP = "shadow.auditroom.eyeSep";
const LS_CONVERGENCE = "shadow.auditroom.convergence";

export function createStereo({ renderer, scene, camera, C }) {
  const stereo = new THREE.StereoCamera();
  stereo.aspect = 1; // we override per-eye aspect below

  let mode = "flat"; // 'flat' | 'sbs'
  let eyeSep = readNum(LS_EYE_SEP, C.EYE_SEP);
  let convergence = readNum(LS_CONVERGENCE, distanceToArc());
  const listeners = new Set();

  function distanceToArc() {
    // nominal convergence plane ≈ the far centre card, minus offset
    return C.ARC_RADIUS - C.CAMERA_POS[2] + C.CONVERGENCE_OFFSET;
  }
  function readNum(key, fallback) {
    try { const v = parseFloat(localStorage.getItem(key)); return Number.isFinite(v) ? v : fallback; }
    catch { return fallback; }
  }
  function persist() {
    try { localStorage.setItem(LS_EYE_SEP, String(eyeSep)); localStorage.setItem(LS_CONVERGENCE, String(convergence)); } catch {}
  }
  function emit() { for (const fn of listeners) fn({ mode, eyeSep, convergence }); }

  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function setMode(m) { mode = m === "sbs" ? "sbs" : "flat"; emit(); }
  function toggle() { setMode(mode === "sbs" ? "flat" : "sbs"); }
  function adjustEyeSep(factor) { eyeSep = Math.max(0.0, eyeSep * factor); persist(); emit(); }
  function adjustConvergence(delta) { convergence = Math.max(0.2, convergence + delta); persist(); emit(); }
  function getState() { return { mode, eyeSep, convergence }; }

  function render() {
    const size = renderer.getSize(new THREE.Vector2());
    const w = size.x, h = size.y;

    if (mode === "flat") {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setViewport(0, 0, w, h);
      renderer.setScissorTest(false);
      renderer.render(scene, camera);
      return;
    }

    // SBS: two half-width viewports on one frame ("squeeze" SBS — each eye
    // gets half the pixel width, the display stretches each half back to full
    // width). HARDWARE-VERIFY (highest-risk item): some XREAL 3D modes instead
    // expect a frame-packed 3840×1080 full-width-per-eye signal; if the glasses
    // are in that mode, this squeeze layout looks horizontally compressed and
    // depth reads wrong. Confirm the actual SBS signal mode on the real device
    // before trusting fusion (see DEMO_SCRIPT.md pre-flight).
    camera.aspect = (w / 2) / h;
    camera.updateProjectionMatrix();
    camera.focus = convergence;
    stereo.eyeSep = eyeSep;
    camera.updateWorldMatrix(true, false);
    stereo.update(camera);

    renderer.setScissorTest(true);
    // left eye → left half
    renderer.setViewport(0, 0, w / 2, h);
    renderer.setScissor(0, 0, w / 2, h);
    renderer.render(scene, stereo.cameraL);
    // right eye → right half
    renderer.setViewport(w / 2, 0, w / 2, h);
    renderer.setScissor(w / 2, 0, w / 2, h);
    renderer.render(scene, stereo.cameraR);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);
  }

  return { render, setMode, toggle, adjustEyeSep, adjustConvergence, onChange, getState,
    get mode() { return mode; } };
}
