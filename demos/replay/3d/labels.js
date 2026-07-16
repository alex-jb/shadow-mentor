// demos/replay/3d/labels.js
// ─────────────────────────────────────────────────────────────────
// In-scene text (design principle 7: all UI as scene objects, never DOM
// overlays — a DOM overlay spans both eyes in SBS and destroys stereo).
//
// DELIBERATE DEVIATION from the spec's "troika-three-text" wording, and
// why: the binding constraint is Phase 7.4 — the demo MUST run offline
// from file:// with zero network. troika loads its default font over the
// network, and on a file:// page Chrome's CORS rules block *every* fetch
// (fonts and JSON alike), so troika text silently fails to appear on
// stage — precisely the failure mode the reliability kit exists to kill.
// Canvas-textured planes render from system fonts with no fetch, are just
// as much "scene objects" as troika meshes (no DOM, correct per-eye in
// SBS), and we render them at high DPI so they stay crisp at ~33 PPD.
//
// This file is the ONLY place text is produced. To switch to troika later
// (embedding a font as a data: URL to stay offline), replace this module
// alone — nothing else touches how glyphs are drawn.
// ─────────────────────────────────────────────────────────────────
import * as THREE from "three";

const PX_PER_UNIT = 900; // canvas resolution per world unit — high for 33 PPD
const SANS = '-apple-system, "SF Pro Display", "Segoe UI", "PingFang SC", system-ui, sans-serif';
const MONO = '"SF Mono", "JetBrains Mono", "Cascadia Code", ui-monospace, Menlo, monospace';

function makeCanvasMesh(canvas, worldW, worldH) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  const geo = new THREE.PlaneGeometry(worldW, worldH);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData._tex = tex;
  return mesh;
}

// Wrap `text` to `maxPx` at a given canvas font; returns array of lines.
function wrapLines(ctx, text, maxPx) {
  const out = [];
  for (const paragraph of String(text).split("\n")) {
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const w of words) {
      const trial = line ? line + " " + w : w;
      if (ctx.measureText(trial).width > maxPx && line) { out.push(line); line = w; }
      else line = trial;
    }
    out.push(line);
  }
  return out;
}

// Generic multi-line text block. worldWidth fixed; worldHeight derived
// from wrapped line count so the plane never distorts the glyphs.
export function makeText(text, {
  size = 0.05, color = "#E8E8E8", worldWidth = 1.0,
  align = "left", weight = 600, mono = false, lineHeight = 1.32, padEm = 0.35,
} = {}) {
  const fontPx = size * PX_PER_UNIT;
  const maxTextPx = worldWidth * PX_PER_UNIT;
  const family = mono ? MONO : SANS;

  const meas = document.createElement("canvas").getContext("2d");
  meas.font = `${weight} ${fontPx}px ${family}`;
  const lines = wrapLines(meas, text, maxTextPx - fontPx * padEm * 2);

  const lineH = fontPx * lineHeight;
  const padPx = fontPx * padEm;
  const cW = Math.max(1, Math.ceil(worldWidth * PX_PER_UNIT));
  const cH = Math.max(1, Math.ceil(lines.length * lineH + padPx * 2));

  const canvas = document.createElement("canvas");
  canvas.width = cW; canvas.height = cH;
  const ctx = canvas.getContext("2d");
  ctx.font = `${weight} ${fontPx}px ${family}`;
  ctx.textBaseline = "top";
  ctx.fillStyle = color;
  ctx.textAlign = align;
  const x = align === "center" ? cW / 2 : align === "right" ? cW - padPx : padPx;
  lines.forEach((ln, i) => ctx.fillText(ln, x, padPx + i * lineH));

  const worldH = cH / PX_PER_UNIT;
  const mesh = makeCanvasMesh(canvas, worldWidth, worldH);
  mesh.userData.worldH = worldH;
  return mesh;
}

// The card face: one word (event type) + small #seq + optional broken glyph.
// Colour is STATUS only (principle 5); type is the word itself. Returns a
// mesh with `.repaint(status)` where status ∈ intact|tampered|broken.
export function makeCardFace(evt, C) {
  const worldW = C.CARD_W, worldH = C.CARD_H;
  const cW = Math.ceil(worldW * PX_PER_UNIT);
  const cH = Math.ceil(worldH * PX_PER_UNIT);
  const canvas = document.createElement("canvas");
  canvas.width = cW; canvas.height = cH;
  const ctx = canvas.getContext("2d");

  function paint(status) {
    ctx.clearRect(0, 0, cW, cH);
    const typeColor = status === "tampered" ? C.STATUS.tampered
      : status === "broken" ? C.STATUS.tampered : C.INK.text;
    const dim = status === "broken";
    const pad = cW * 0.075;

    // one word — the event type
    const typePx = C.FONT_SIZE_TYPE * PX_PER_UNIT;
    ctx.font = `650 ${typePx}px ${SANS}`;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.globalAlpha = dim ? 0.5 : 1.0;
    ctx.fillStyle = typeColor;
    ctx.fillText(evt.event_type, pad, pad);

    // small #seq under it
    const seqPx = C.FONT_SIZE_SEQ * PX_PER_UNIT;
    ctx.font = `500 ${seqPx}px ${MONO}`;
    ctx.fillStyle = C.INK.textDim;
    ctx.globalAlpha = dim ? 0.4 : 0.9;
    ctx.fillText(`#${evt.seq}`, pad, pad + typePx * 1.25);

    // broken-link glyph, top-right, only when downstream of a break
    if (status === "broken" || status === "tampered") {
      ctx.font = `600 ${seqPx * 1.15}px ${MONO}`;
      ctx.fillStyle = C.STATUS.tampered;
      ctx.textAlign = "right";
      ctx.globalAlpha = 1.0;
      ctx.fillText("⛓✗", cW - pad, pad);
    }
    ctx.globalAlpha = 1.0;
    mesh.userData._tex.needsUpdate = true;
  }

  const mesh = makeCanvasMesh(canvas, worldW, worldH);
  mesh.repaint = paint;
  paint("intact");
  return mesh;
}

export function disposeMesh(mesh) {
  if (!mesh) return;
  mesh.userData._tex?.dispose?.();
  mesh.geometry?.dispose?.();
  mesh.material?.dispose?.();
}

// Place a scene object at a fixed spot in the CURRENT view and face it at the
// camera. Because it stays a scene object (not a camera child), it still
// renders correctly in BOTH eyes in SBS — but it tracks the head/beat camera
// so HUD text and the money-shot caption never fly off-frame. x/y are view-
// space offsets (right/up), d is distance in front of the camera.
const _r = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3(), _p = new THREE.Vector3();
export function billboardInView(obj, camera, { x = 0, y = 0, d = 2.0 } = {}) {
  const e = camera.matrixWorld.elements;
  _r.set(e[0], e[1], e[2]);
  _u.set(e[4], e[5], e[6]);
  _f.set(-e[8], -e[9], -e[10]);
  camera.getWorldPosition(_p);
  obj.position.copy(_p).addScaledVector(_f, d).addScaledVector(_r, x).addScaledVector(_u, y);
  obj.quaternion.copy(camera.quaternion);
}
