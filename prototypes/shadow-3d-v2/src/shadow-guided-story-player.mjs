// Three.js guided-story player. Loads a PRE-COMPILED snapshot (./story-snapshots/<id>.threejs.json —
// no live compile in the browser), renders each node as a status-shaped mesh, and walks the narration
// steps. Status is shape + colour in 3D AND named text in the side panel (never colour alone). Focus+
// context: the active step's focus entities stay lit; the rest fade, and detail shows in a stable 2D
// panel without rebuilding the scene. Same-origin only, no external network. Text is rendered via
// textContent (no innerHTML sink). hover ≠ select ≠ approve.
import * as THREE from "three";
import { OrbitControls } from "../vendor/OrbitControls.js";
import { layoutScene } from "./shadow-guided-story-three-adapter.mjs";

const STORIES = ["audit-chain", "reason-code-attestation", "persona-deliberation"];
const I18N = {
  en: { prev: "◀ Step", next: "Step ▶", restart: "↻ Restart", recenter: "Recenter", mode2d: "2D fallback", rmotion: "Reduced motion",
    dims: "Trust dimensions (independent — never one green)", audit: "Nodes", story: "Story", scenario: "Scenario", step: "Step",
    note: "Isolated research prototype · pre-compiled snapshot · same-origin only · not production · positions are hints, meaning is authoritative.",
    hoverhint: "Hover reveals; it does not select. Selecting does not approve.", firstfail: "FIRST FAILURE", downstream: "AFFECTED DOWNSTREAM" },
  zh: { prev: "◀ 上一步", next: "下一步 ▶", restart: "↻ 重来", recenter: "重新居中", mode2d: "2D 回退", rmotion: "减弱动效",
    dims: "信任维度（相互独立——绝不合并为一个绿）", audit: "节点", story: "故事", scenario: "场景", step: "步骤",
    note: "隔离研究原型 · 预编译快照 · 仅同源 · 非生产 · 位置为提示,语义为权威。",
    hoverhint: "悬停仅显示,不选择。选择不等于批准。", firstfail: "首个失败", downstream: "受下游影响" },
};

let LANG = "en", STORY = STORIES[0], STEP = 0, RMOTION = false, MODE2D = false, SELECTED = null;
let snapshot = null, semantic = null, sceneModel = null;
const T = () => I18N[LANG];
const $ = (id) => document.getElementById(id);
const setText = (el, s) => { if (el) el.textContent = s; };

// ── three setup ───────────────────────────────────────────────────────────────
const stage = $("stage");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0d10);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.AmbientLight(0xffffff, 0.75));
const dir = new THREE.DirectionalLight(0xffffff, 0.55); dir.position.set(2, 3, 4); scene.add(dir);
const root = new THREE.Group(); scene.add(root);
stage.appendChild(renderer.domElement);
const CAM0 = new THREE.Vector3(0, 0.3, 4.6);
function recenter() { camera.position.copy(CAM0); controls.target.set(0, 0, 0); controls.update(); }
recenter();

function geometryFrom(spec) {
  const map = {
    Icosahedron: THREE.IcosahedronGeometry, Octahedron: THREE.OctahedronGeometry, Tetrahedron: THREE.TetrahedronGeometry,
    Box: THREE.BoxGeometry, Torus: THREE.TorusGeometry, Cylinder: THREE.CylinderGeometry, Capsule: THREE.CapsuleGeometry,
  };
  const G = map[spec.type] ?? THREE.BoxGeometry;
  return new G(...spec.args);
}

const meshes = new Map();      // id → THREE.Mesh
const edgeLines = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function clearScene() {
  for (const m of meshes.values()) { root.remove(m); m.geometry.dispose(); m.material.dispose(); }
  meshes.clear();
  for (const l of edgeLines) { root.remove(l); l.geometry.dispose(); l.material.dispose(); }
  edgeLines.length = 0;
}

function buildScene(model) {
  clearScene();
  for (const n of model.nodes) {
    const mesh = new THREE.Mesh(
      geometryFrom(n.geometry),
      new THREE.MeshStandardMaterial({ color: n.color, metalness: 0.1, roughness: 0.6, transparent: true, opacity: n.dimmed ? 0.28 : 1 })
    );
    mesh.position.set(...n.pos);
    mesh.userData = { id: n.id };
    if (n.is_first_failure) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 8, 32), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      ring.rotation.x = Math.PI / 2; mesh.add(ring);
    }
    root.add(mesh); meshes.set(n.id, mesh);
  }
  for (const e of model.edges) {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...e.from_pos), new THREE.Vector3(...e.to_pos)]);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: e.degraded ? 0xef4444 : 0x55606e, transparent: true, opacity: 0.7 }));
    root.add(line); edgeLines.push(line);
  }
}

// ── data ──────────────────────────────────────────────────────────────────────
async function loadStory(id) {
  const res = await fetch(`./story-snapshots/${id}.threejs.json`);
  snapshot = await res.json();
  semantic = snapshot.semantic;
  STEP = 0; SELECTED = null;
  render();
}

function currentStep() { return semantic.steps[Math.max(0, Math.min(STEP, semantic.steps.length - 1))]; }

function render() {
  const step = currentStep();
  const scenarioId = step.scenario_ref ?? semantic.scenarios[0].id;
  const layout = step.layout_intent ?? "timeline";
  sceneModel = layoutScene(semantic, { scenarioId, layout, focusEntities: step.focus_entities ?? [] });
  if (!MODE2D) buildScene(sceneModel); else clearScene();
  renderPanels(step, scenarioId);
  renderLabels();
  markDirty();   // a state change must trigger a redraw even under render-on-demand
}

function renderPanels(step, scenarioId) {
  document.documentElement.lang = LANG;
  setText($("story-title"), semantic.title[LANG]);
  setText($("t-note"), T().note);
  setText($("t-hoverhint"), T().hoverhint);
  setText($("t-dims"), T().dims);
  setText($("t-audit"), T().audit);
  const sc = semantic.scenarios.find((s) => s.id === scenarioId);
  setText($("scenario-label"), `${T().scenario}: ${sc.label[LANG]}`);
  setText($("step-label"), `${T().step} ${step.index + 1}/${semantic.steps.length}`);
  setText($("narration"), step.narration[LANG]);
  // trust dimensions — each named + status text, never colour alone
  const dl = $("dims"); dl.replaceChildren();
  for (const d of sceneModel.trust_dimensions) {
    const li = document.createElement("li");
    const name = document.createElement("span"); setText(name, d.dimension.replaceAll("_", " "));
    const st = document.createElement("b"); st.className = "st"; st.dataset.sev = d.status; setText(st, d.status.replaceAll("_", " "));
    li.append(name, st); dl.append(li);
  }
  // nodes list
  const al = $("audit-list"); al.replaceChildren();
  for (const n of sceneModel.nodes) {
    const li = document.createElement("li");
    li.dataset.id = n.id;
    if (n.id === SELECTED) li.className = "sel";
    const lab = document.createElement("span"); setText(lab, `${n.sequence}. ${n.label_en === n.label_zh ? n[`label_${LANG}`] : n[`label_${LANG}`]}`);
    const st = document.createElement("b"); st.className = "st"; st.dataset.sev = n.severity; setText(st, LANG === "en" ? n.status_text_en : n.status_text_zh);
    li.append(lab, st);
    li.tabIndex = 0;
    li.addEventListener("click", () => selectNode(n.id));
    li.addEventListener("keydown", (e) => { if (e.key === "Enter") selectNode(n.id); });
    al.append(li);
  }
  // selected detail
  const det = $("detail");
  if (SELECTED) {
    const n = sceneModel.nodes.find((x) => x.id === SELECTED);
    if (n) { det.hidden = false; setText($("detail-body"), `${n[`label_${LANG}`]} — ${LANG === "en" ? n.a11y_en : n.a11y_zh}`); }
  } else det.hidden = true;
}

function renderLabels() {
  // project focus-node positions to screen for small HTML labels (crisp text, no WebGL font)
  const layer = $("labels"); layer.replaceChildren();
  if (MODE2D || !sceneModel) return;
  const rect = renderer.domElement.getBoundingClientRect();
  for (const n of sceneModel.nodes) {
    if (!n.focused) continue;
    const mesh = meshes.get(n.id); if (!mesh) continue;
    const v = mesh.position.clone().project(camera);
    const x = (v.x * 0.5 + 0.5) * rect.width, y = (-v.y * 0.5 + 0.5) * rect.height;
    if (v.z > 1) continue;
    const tag = document.createElement("div"); tag.className = "tag";
    if (n.is_first_failure) tag.dataset.k = "fail"; else if (n.is_downstream) tag.dataset.k = "down";
    setText(tag, `${n[`label_${LANG}`]} · ${LANG === "en" ? n.status_text_en : n.status_text_zh}`);
    tag.style.left = `${x}px`; tag.style.top = `${y}px`;
    layer.append(tag);
  }
}

function selectNode(id) { SELECTED = (SELECTED === id ? null : id); render(); }   // select ≠ approve; purely informational

// ── interaction ─────────────────────────────────────────────────────────────
renderer.domElement.addEventListener("pointermove", (e) => {
  const r = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects([...meshes.values()], true)[0];
  const id = hit ? (hit.object.userData.id ?? hit.object.parent?.userData.id) : null;
  setText($("hover"), id ? (sceneModel.nodes.find((n) => n.id === id)?.[`label_${LANG}`] ?? "") : "");   // hover reveals, never selects
});
renderer.domElement.addEventListener("click", (e) => {
  const r = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects([...meshes.values()], true)[0];
  if (hit) selectNode(hit.object.userData.id ?? hit.object.parent?.userData.id);
});

function next() { if (STEP < semantic.steps.length - 1) { STEP++; render(); } }
function prev() { if (STEP > 0) { STEP--; render(); } }
function restart() { STEP = 0; SELECTED = null; render(); }

// ── boot ─────────────────────────────────────────────────────────────────────
function wire() {
  const sel = $("story-select");
  for (const id of STORIES) { const o = document.createElement("option"); o.value = id; setText(o, id); sel.append(o); }
  sel.value = STORY;
  sel.addEventListener("change", () => { STORY = sel.value; loadStory(STORY); });
  $("next").addEventListener("click", next);
  $("prev").addEventListener("click", prev);
  $("restart").addEventListener("click", restart);
  $("recenter").addEventListener("click", recenter);
  $("lang-en").addEventListener("click", () => { LANG = "en"; syncBtns(); render(); });
  $("lang-zh").addEventListener("click", () => { LANG = "zh"; syncBtns(); render(); });
  $("rmotion").addEventListener("change", (e) => {
    RMOTION = e.target.checked; controls.enableDamping = !RMOTION;
    // adaptive DPR: official guidance is to cap (not use raw devicePixelRatio) and render lighter
    // under load — drop to 1.5 under reduced motion, otherwise cap at 2.
    const dpr = RMOTION ? Math.min(devicePixelRatio, 1.5) : Math.min(devicePixelRatio, 2);
    renderer.setPixelRatio(dpr); perf.dpr = dpr; resize(); markDirty();
  });
  $("mode2d").addEventListener("change", (e) => { MODE2D = e.target.checked; stage.dataset.hidden = MODE2D ? "1" : ""; render(); });
  document.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") next(); else if (e.key === "ArrowLeft") prev(); });
  syncBtns();
}
function syncBtns() {
  for (const [id, key] of [["next", "next"], ["prev", "prev"], ["restart", "restart"], ["recenter", "recenter"], ["t-mode2d", "mode2d"], ["t-rmotion", "rmotion"]]) setText($(id), T()[key]);
  $("lang-en").setAttribute("aria-pressed", String(LANG === "en"));
  $("lang-zh").setAttribute("aria-pressed", String(LANG === "zh"));
}

function resize() {
  const w = stage.clientWidth || window.innerWidth, h = stage.clientHeight || Math.round(window.innerHeight * 0.62);
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener("resize", () => { resize(); renderLabels(); markDirty(); });

// Render-on-demand (official three.js pattern). When reduced motion is on we do NOT run a continuous
// loop — we render only when something changes (step / select / camera / resize). When it is off we
// render every frame so OrbitControls damping stays smooth. Perf counters are exposed for acceptance.
let _dirty = true;
const perf = { revision: THREE.REVISION, frames: 0, draws: 0, dpr: renderer.getPixelRatio() };
function markDirty() { _dirty = true; }
controls.addEventListener("change", markDirty);
window.__perf = perf;

function drawOnce() { controls.update(); renderer.render(scene, camera); renderLabels(); perf.draws++; _dirty = false; }
function loop() {
  perf.frames++;
  if (!RMOTION || _dirty) drawOnce();   // continuous when animating; on-demand under reduced motion
  requestAnimationFrame(loop);
}

wire(); resize(); markDirty();
loadStory(STORY).then(() => { resize(); markDirty(); loop(); window.__ready = true; })
  .catch((err) => { setText($("narration"), "load error: " + err.message); window.__ready = true; });
