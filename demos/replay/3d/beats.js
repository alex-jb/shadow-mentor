// demos/replay/3d/beats.js
// ─────────────────────────────────────────────────────────────────
// Presenter beats — Phase 7.1. Number keys 1..8 tween the camera (1.2 s)
// to waypoints; 0 is a full reset. Rehearsal is these keys; the script is
// written against them. Waypoints are RESOLVED from scene geometry (not
// hard-coded coordinates) so they follow the constants block if you retune
// the arc on the glasses. Each beat may also fire a side effect (apply a
// lens, trigger the tamper, show the trust badges).
// ─────────────────────────────────────────────────────────────────
import * as THREE from "three";
import { DEMO_BEATS } from "./demo-data.js";

const smooth = (k) => k * k * (3 - 2 * k);

export function createBeats({ camera, controls, room, C }) {
  let active = null; // {fromP,toP,fromT,toT,t,dur}
  let current = 0;

  function cardByTool(tool) {
    return room.cards.find((c) => c.evt.extensions?.tool === tool)
      || room.cards.find((c) => c.evt.event_type === "tool_call");
  }
  function worldPos(card) { return card.group.getWorldPosition(new THREE.Vector3()); }

  // Resolve a beat's camera spec → {pos, target}
  function resolveCam(spec) {
    const viewer = new THREE.Vector3(C.CAMERA_POS[0], C.CAMERA_POS[1], C.CAMERA_POS[2]);
    if (spec.frame === "all") {
      return { pos: viewer.clone(), target: new THREE.Vector3(...C.CAMERA_TARGET) };
    }
    if (spec.frame === "wide") {
      return { pos: viewer.clone().add(new THREE.Vector3(0, 0.4, 2.6)), target: new THREE.Vector3(...C.CAMERA_TARGET) };
    }
    if (spec.frame === "badges") {
      const last = room.cards[room.cards.length - 1];
      const tp = worldPos(last).add(new THREE.Vector3(0.9, 0.1, 0));
      return { pos: tp.clone().add(new THREE.Vector3(0.2, 0.2, 3.2)), target: tp };
    }
    if (spec.focusTool) {
      const card = cardByTool(spec.focusTool);
      if (card) {
        const cp = worldPos(card);
        const dir = viewer.clone().sub(cp).normalize();
        return { pos: cp.clone().add(dir.multiplyScalar(spec.dist ?? 2.2)), target: cp };
      }
    }
    return { pos: viewer.clone(), target: new THREE.Vector3(...C.CAMERA_TARGET) };
  }

  async function runAction(action, spec) {
    if (!action) return;
    const seqOf = (tool) => cardByTool(tool)?.seq;
    if (action === "focus") room.select(seqOf(spec.focusTool));
    else if (action === "focusPair") room.select(seqOf(spec.focusTool));
    else if (action === "tamper") await room.tamper();
    else if (action === "focusTampered") room.select(C.MUTATE_SEQ);
    else if (action === "trust") room.setShowTrust(true);
    else if (action === "clearLens") { room.clearLens(); room.clearFilter(); }
    else if (action.startsWith("lens:")) room.applyLens(action.slice(5));
  }

  function tweenTo(pos, target) {
    active = {
      fromP: camera.position.clone(), toP: pos.clone(),
      fromT: controls.target.clone(), toT: target.clone(),
      t: 0, dur: C.BEAT_TWEEN_MS / 1000,
    };
  }

  async function goto(n) {
    if (n === 0) return reset();
    const beat = DEMO_BEATS.find((b) => b.n === n);
    if (!beat) return;
    current = n;
    const { pos, target } = resolveCam(beat.cam);
    tweenTo(pos, target);
    await runAction(beat.action, beat.cam);
  }

  async function reset() {
    current = 0;
    room.clearLens(); room.clearFilter(); room.setShowTrust(false); room.clearSelection();
    await room.reset();
    const { pos, target } = resolveCam({ frame: "all" });
    tweenTo(pos, target);
  }

  function update(dt) {
    if (!active) return;
    active.t += dt;
    const k = smooth(Math.min(1, active.t / active.dur));
    camera.position.lerpVectors(active.fromP, active.toP, k);
    controls.target.lerpVectors(active.fromT, active.toT, k);
    if (k >= 1) active = null;
  }

  return { goto, reset, update, get current() { return current; }, get beats() { return DEMO_BEATS; } };
}
