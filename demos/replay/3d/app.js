// demos/replay/3d/app.js
// ─────────────────────────────────────────────────────────────────
// The Audit Room — orchestrator. Wires the scene, stereo renderer, voice,
// beats, and (lazily) WebXR into one offline app driven from file://.
//
// Discipline baked in here:
//   • The KEYBOARD IS AUTHORITATIVE (Phase 4.1.3). Voice and keys dispatch
//     through the SAME handler; if the mic dies on stage nothing changes.
//   • The only DOM is a fatal-error div and a mode splash (principle 7);
//     every other pixel is a scene object, so SBS stereo is never broken.
//   • A presenter watchdog (Phase 7.2) catches any uncaught error, logs it,
//     and soft-reloads into the last beat within ~2 s.
// ─────────────────────────────────────────────────────────────────
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildConstants } from "./constants.js";
import { createAuditRoom } from "./scene.js";
import { createStereo } from "./stereo.js";
import { createVoice, parseIntent } from "./voice.js";
import { createBeats } from "./beats.js";
import { createWebXR } from "./webxr.js";
import { initPreflight } from "./preflight.js";
import { createGamepad } from "./gamepad.js";
import { makeText, billboardInView } from "./labels.js";

const params = new URLSearchParams(location.search);
const preset = params.get("xreal") === "1" ? "xreal" : "laptop";
const C = buildConstants(preset);
const presenter = params.get("presenter") === "1";
const startMode = params.get("mode") || "flat";
const startBeat = parseInt(params.get("beat") || "0", 10);

const fatalDiv = document.getElementById("fatal");
const splashDiv = document.getElementById("splash");

function fatal(msg) {
  if (!fatalDiv) return;
  fatalDiv.textContent = msg;
  fatalDiv.style.display = "block";
}

// ── renderer / scene / camera ──
const renderer = new THREE.WebGLRenderer({
  antialias: true, alpha: true, powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 1); // black pixels read as transparent on optical see-through
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(C.CAMERA_FOV, innerWidth / innerHeight, 0.05, 200);
camera.position.set(...C.CAMERA_POS);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(...C.CAMERA_TARGET);
controls.minDistance = 1.2;
controls.maxDistance = 14;
const lim = C.ORBIT_LIMIT_DEG * Math.PI / 180;
controls.minAzimuthAngle = -lim;
controls.maxAzimuthAngle = lim;
controls.minPolarAngle = Math.PI / 2 - lim;
controls.maxPolarAngle = Math.PI / 2 + lim;

// Light is the only material — edges/text/connectors are unlit (MeshBasic /
// LineBasic), so the scene needs no lights. A faint ambient only keeps any
// stray lit material from going pure black. We use none by design.

// ── the room ──
const room = createAuditRoom({ C });
scene.add(room.group);

// ── in-scene HUD (world-anchored → shows in BOTH eyes in SBS) ──
const hud = new THREE.Group();
scene.add(hud);
const statusText = makeText("verifying…", {
  size: C.FONT_SIZE_BADGE * 0.8, worldWidth: 5.0, align: "center", color: C.INK.textDim, mono: true, weight: 500,
});
statusText.position.set(0, C.ARC_Y - C.CARD_H * 1.6, C.CAMERA_POS[2] - 1.2);
hud.add(statusText);
function setStatus(text, color) {
  statusText.geometry.dispose(); statusText.material.map.dispose();
  const next = makeText(text, { size: C.FONT_SIZE_BADGE * 0.8, worldWidth: 5.0, align: "center", color: color || C.INK.textDim, mono: true, weight: 500 });
  next.position.copy(statusText.position);
  hud.remove(statusText); hud.add(next);
  hudRef.status = next;
}
const hudRef = { status: statusText };

// mic indicator — a small ring, shown only while the mic is hot (Phase 4.1.1)
const micDot = new THREE.Mesh(
  new THREE.RingGeometry(0.03, 0.05, 24),
  new THREE.MeshBasicMaterial({ color: 0xff4a4a, transparent: true, opacity: 0.0, toneMapped: false }),
);
micDot.position.set(-2.4, C.ARC_Y - C.CARD_H * 1.6, C.CAMERA_POS[2] - 1.2);
hud.add(micDot);

// presenter beat indicator (in-scene, not DOM)
let beatText = null;
if (presenter) {
  beatText = makeText("BEAT —", { size: C.FONT_SIZE_BADGE * 0.8, worldWidth: 3.0, align: "center", color: C.STATUS.healed, mono: true, weight: 600 });
  beatText.position.set(0, C.ARC_Y + C.CARD_H * 2.4, C.CAMERA_POS[2] - 1.2);
  hud.add(beatText);
}
function setBeatText(n) {
  if (!beatText) return;
  const b = beats.beats.find((x) => x.n === n);
  const label = n === 0 ? "BEAT 0 · reset" : b ? `BEAT ${n}/8 · ${b.name}` : `BEAT ${n}`;
  const next = makeText(label, { size: C.FONT_SIZE_BADGE * 0.8, worldWidth: 3.4, align: "center", color: C.STATUS.healed, mono: true, weight: 600 });
  next.position.copy(beatText.position);
  hud.remove(beatText); hud.add(next); beatText = next;
}

// ── stereo, beats, voice ──
const stereo = createStereo({ renderer, scene, camera, C });
const beats = createBeats({ camera, controls, room, C });
let webxr = null; // lazy
let preflight = null; // WebXR diagnostics panel (created on entering webxr mode)

stereo.onChange(({ mode, eyeSep }) => {
  const es = `eye ${(eyeSep * 1000).toFixed(0)}mm`;
  setStatus(`${lastVerdict}   ·   ${mode.toUpperCase()}   ·   ${es}`, lastVerdictColor);
});

// ── verdict (initial + after actions), sourced from the real verifier ──
let lastVerdict = "verifying…";
let lastVerdictColor = C.INK.textDim;
async function refreshVerdict() {
  const v = await room.verifyWorking();
  if (v.ok) {
    lastVerdict = `${v.trustLevel?.split(" ")[0] || "SELF_SIGNED"} · valid · ${v.batchRoot.slice(0, 10)}…`;
    lastVerdictColor = C.STATUS.healed;
  } else {
    lastVerdict = `verify FAILED · ${v.error.reason}${v.error.seq != null ? " @ seq " + v.error.seq : ""}`;
    lastVerdictColor = C.STATUS.tampered;
  }
  const st = stereo.getState();
  setStatus(`${lastVerdict}   ·   ${st.mode.toUpperCase()}   ·   eye ${(st.eyeSep * 1000).toFixed(0)}mm`, lastVerdictColor);
}

// ── central dispatch: keyboard AND voice both come through here ──
async function dispatch(intent) {
  switch (intent.intent) {
    case "TRIGGER_TAMPER": await room.tamper(); await refreshVerdict(); break;
    case "RESET": await room.reset(); await refreshVerdict(); break;
    case "APPLY_LENS": room.applyLens(intent.lens); flash(`lens · ${intent.lens}`); break;
    case "CLEAR_LENS": room.clearLens(); room.clearFilter(); flash("lens cleared"); break;
    case "FILTER_BY_TYPE": { const hits = room.filterByType(intent.query); flash(`filter · ${intent.query} (${hits.length})`); break; }
    case "FOCUS_EVENT": if (!room.focusEvent(intent.seq)) flash(`no event ${intent.seq}`); break;
    case "EXPLAIN_EVENT": flash(room.explainEvent(intent.seq), 4000); break;
    case "GOTO_BEAT": await beats.goto(intent.n); setBeatText(intent.n); if (intent.n === 5) await refreshVerdict(); break;
    case "SHOW_TRUST_LEVELS": room.setShowTrust(true); flash("trust levels"); break;
    case "UNKNOWN": flash("didn't catch that"); break;
    default: break;
  }
}

// transient in-scene flash line (lens name, "didn't catch that", explain text)
let flashMesh = null, flashUntil = 0;
function flash(text, ms = 2000) {
  if (flashMesh) { hud.remove(flashMesh); flashMesh.material.map.dispose(); flashMesh.geometry.dispose(); }
  flashMesh = makeText(text, { size: C.FONT_SIZE_BADGE * 0.85, worldWidth: 5.2, align: "center", color: C.INK.text, mono: true, weight: 500 });
  flashMesh.position.set(0, C.ARC_Y - C.CARD_H * 2.4, C.CAMERA_POS[2] - 1.2);
  hud.add(flashMesh);
  flashUntil = performance.now() + ms;
}

// ── voice (push-to-talk) ──
const voice = createVoice({
  onIntent: (intent) => dispatch(intent),
  onState: ({ available, listening }) => {
    micDot.material.opacity = listening ? 0.9 : 0.0;
    if (!available && voiceHintShown === false) { voiceHintShown = true; }
  },
});
let voiceHintShown = false;

// ── mode system ──
function showSplash(text) {
  if (!splashDiv) return;
  splashDiv.textContent = text;
  splashDiv.style.opacity = "1";
  clearTimeout(showSplash._t);
  showSplash._t = setTimeout(() => { splashDiv.style.opacity = "0"; }, 900);
}
function setMode(mode) {
  if (mode === "webxr") {
    try {
      if (!webxr) {
        webxr = createWebXR({ renderer, scene, camera, room, C, mountButton: (btn) => {
          btn.style.position = "fixed"; btn.style.bottom = "16px"; btn.style.left = "50%";
          btn.style.transform = "translateX(-50%)"; document.body.appendChild(btn);
        } });
        renderer.setAnimationLoop(xrLoop);
      }
      if (!preflight) preflight = initPreflight({ renderer, appCommit: (globalThis.__SHADOW_BUILD__ || "") });
    } catch (e) { fatal("WebXR unavailable: " + e.message); }
    stereo.setMode("flat");
    showSplash("WEBXR");
    return;
  }
  stereo.setMode(mode);
  showSplash(mode.toUpperCase());
}

// ── keyboard: AUTHORITATIVE. Every voice verb has a key here. ──
let lensCycle = [null, "security", "compliance", "quality"];
let lensIdx = 0;
const orderedSeqs = () => room.cards.map((c) => c.seq).sort((a, b) => a - b);
function selectionSeq(dir) {
  const seqs = orderedSeqs();
  const cur = room.selectedSeq;
  let i = cur == null ? (dir > 0 ? -1 : 0) : seqs.indexOf(cur);
  i = Math.max(0, Math.min(seqs.length - 1, i + dir));
  return seqs[i];
}
function moveSelection(dir) { dispatch({ intent: "FOCUS_EVENT", seq: selectionSeq(dir) }); }
function beatDelta(d) { const n = Math.max(1, Math.min(8, (beats.current || 0) + d)); dispatch({ intent: "GOTO_BEAT", n }); }

// optional presenter gamepad — keyboard stays authoritative
const gamepad = createGamepad({
  dispatch,
  nextBeat: () => beatDelta(1),
  prevBeat: () => beatDelta(-1),
  gotoBeat: (n) => dispatch({ intent: "GOTO_BEAT", n }),
  voice,
});
gamepad.setSelectionMover(selectionSeq);

addEventListener("keydown", (e) => {
  if (e.repeat && e.code !== "Space") return;
  const k = e.key;
  // push-to-talk
  if (e.code === "Space") { e.preventDefault(); voice.start(); return; }
  // beats 0..8
  if (/^[0-8]$/.test(k)) { const n = parseInt(k, 10); dispatch({ intent: "GOTO_BEAT", n }); setBeatText(n); return; }
  switch (k.toLowerCase()) {
    case "t": dispatch({ intent: "TRIGGER_TAMPER" }); break;
    case "r": dispatch({ intent: "RESET" }); break;
    case "e": room.exportWorking(); flash("exported working bundle"); break;
    case "l": lensIdx = (lensIdx + 1) % lensCycle.length; { const ln = lensCycle[lensIdx]; ln ? dispatch({ intent: "APPLY_LENS", lens: ln }) : dispatch({ intent: "CLEAR_LENS" }); } break;
    case "k": lensIdx = 0; dispatch({ intent: "CLEAR_LENS" }); break;
    case "h": dispatch({ intent: "FILTER_BY_TYPE", query: "shell" }); break;
    case "b": dispatch({ intent: "SHOW_TRUST_LEVELS" }); break;
    case "i": if (room.selectedSeq != null) dispatch({ intent: "EXPLAIN_EVENT", seq: room.selectedSeq }); break;
    case "n": room.annotateSelected().then((v) => flash(v.ok ? "annotation signed · re-verifies clean" : "annotate: " + (v.reason || v.error?.reason))); break;
    case "m": voice.available ? (voice.listening ? voice.kill() : voice.revive()) : flash("mic unavailable"); break;
    case "[": stereo.adjustEyeSep(0.9); break;
    case "]": stereo.adjustEyeSep(1.1); break;
    case ";": stereo.adjustConvergence(-0.15); break;
    case "'": stereo.adjustConvergence(0.15); break;
    case "arrowleft": moveSelection(-1); break;
    case "arrowright": moveSelection(1); break;
    default: break;
  }
  if (k === "F1") { e.preventDefault(); setMode("flat"); }
  if (k === "F2") { e.preventDefault(); setMode("sbs"); }
  if (k === "F3") { e.preventDefault(); setMode("webxr"); }
});
addEventListener("keyup", (e) => { if (e.code === "Space") voice.stop(); });

// ── click / hover select (the keyboard/mouse equivalent of FOCUS_EVENT) ──
const raycaster = new THREE.Raycaster();
const ptr = new THREE.Vector2();
function pick(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  // in SBS a click lands in one eye's half; map it back to full-frame NDC
  let x = (ev.clientX - r.left) / r.width;
  if (stereo.mode === "sbs") x = (x % 0.5) * 2;
  ptr.x = x * 2 - 1;
  ptr.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(ptr, camera);
  return room.raycastSeq(raycaster);
}
renderer.domElement.addEventListener("click", (ev) => {
  const seq = pick(ev);
  if (seq != null) dispatch({ intent: "FOCUS_EVENT", seq });
});

// ── watchdog (Phase 7.2): log + soft-reload into last beat within ~2s ──
function armWatchdog() {
  const handler = (msg) => {
    try {
      const log = JSON.parse(localStorage.getItem("shadow.auditroom.errors") || "[]");
      log.push({ msg: String(msg), beat: beats.current, at: performance.now() });
      localStorage.setItem("shadow.auditroom.errors", JSON.stringify(log.slice(-20)));
    } catch {}
    fatal("recovering…");
    const url = new URL(location.href);
    url.searchParams.set("beat", String(beats.current || 1));
    setTimeout(() => location.replace(url.toString()), 1200);
  };
  addEventListener("error", (e) => handler(e.message));
  addEventListener("unhandledrejection", (e) => handler(e.reason?.message || e.reason));
}
if (presenter) armWatchdog();

// ── resize ──
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── fps ──
let fpsLast = performance.now(), fpsFrames = 0;
const fpsEl = { text: "" };

// ── main loop (flat/sbs). XR uses setAnimationLoop(xrLoop) instead. ──
let prev = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
  step(dt, now);
  if (!renderer.xr.isPresenting) stereo.render();
  if (!renderer.xr.isPresenting) requestAnimationFrame(frame);
}
function xrLoop(now, xrFrame) {
  const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
  step(dt, now);
  if (webxr) webxr.update(dt);
  // Feed the viewer pose to preflight so it can tell 6DoF (real translation) from 3DoF.
  if (preflight && xrFrame) {
    const rs = renderer.xr.getReferenceSpace?.();
    const vp = rs ? xrFrame.getViewerPose(rs) : null;
    if (vp) preflight.updatePose(vp.transform.position);
  }
  renderer.render(scene, camera);
}
function step(dt, now) {
  gamepad.poll();
  controls.update();
  beats.update(dt);
  room.update(dt, camera);
  // HUD as a camera-relative, billboarded in-scene layer (renders in both
  // eyes in SBS, but tracks the head/beat camera so it never flies off-frame).
  billboardInView(hudRef.status, camera, { x: 0, y: -0.78, d: 2.2 });
  billboardInView(micDot, camera, { x: -1.05, y: -0.78, d: 2.2 });
  if (beatText) billboardInView(beatText, camera, { x: 0, y: 0.98, d: 2.2 });
  if (flashMesh) billboardInView(flashMesh, camera, { x: 0, y: -0.5, d: 2.0 });
  if (flashMesh && now > flashUntil) { hud.remove(flashMesh); flashMesh.material.map.dispose(); flashMesh.geometry.dispose(); flashMesh = null; }
  fpsFrames++;
  if (now - fpsLast > 1000) { fpsEl.text = `${Math.round(fpsFrames * 1000 / (now - fpsLast))} fps`; fpsFrames = 0; fpsLast = now; }
}

// ── boot ──
(async function boot() {
  try {
    await refreshVerdict();
    setMode(startMode === "sbs" ? "sbs" : startMode === "webxr" ? "webxr" : "flat");
    if (startBeat > 0) { await beats.goto(startBeat); setBeatText(startBeat); if (startBeat >= 5) await refreshVerdict(); }
    requestAnimationFrame(frame);
  } catch (e) {
    fatal("boot failed: " + (e?.message || e));
    // still try to render something
    requestAnimationFrame(frame);
  }
})();

// expose a tiny surface for the smoke test / console
window.__auditRoom = { room, beats, stereo, dispatch, parseIntent, C, get fps() { return fpsEl.text; } };
