// Shadow 3D v2 layout research prototype. Renders the SAME shadow-3d-scene-v1 fixture in four
// layouts. Status is encoded by SHAPE + TEXT + COLOR (never colour alone). Focus+context: selecting a
// node highlights it and its immediate neighbours, fades the rest, and shows detail in a stable 2D
// panel WITHOUT rotating/rebuilding the scene. Same-origin only; no external network at runtime.
import * as THREE from "three";
import { OrbitControls } from "./vendor/OrbitControls.js";

const I18N = {
  en: { title: "Shadow 3D v2", tamper: ["Show tampered", "Show clean"], stepb: "◀ Step", stepf: "Step ▶", recenter: "Recenter", reset: "Reset", mode2d: "2D Audit", rmotion: "Reduced motion", ver: "Verification (six independent checks)", audit: "Audit sequence", seq: "seq", node: "node", status: "status", note: "Isolated research prototype · same-origin only · not production · positions are hints, semantics are authoritative.",
    checks: { record_integrity: "Record Integrity", signature: "Signature", hash_chain: "Hash Chain", profile: "Profile", source_resolution: "Source Resolution", external_anchor: "External Anchor", analytical_correctness: "Analytical correctness" }, NOT_EVALUATED: "NOT EVALUATED — not judged" },
  zh: { title: "Shadow 3D v2", tamper: ["显示被篡改", "显示正常"], stepb: "◀ 上一步", stepf: "下一步 ▶", recenter: "重新居中", reset: "重置", mode2d: "2D 审计", rmotion: "减弱动效", ver: "验证（六项独立检查）", audit: "审计序列", seq: "序号", node: "节点", status: "状态", note: "隔离研究原型 · 仅同源 · 非生产 · 位置为提示，语义为权威。",
    checks: { record_integrity: "记录完整性", signature: "数字签名", hash_chain: "哈希链", profile: "配置档", source_resolution: "来源解析", external_anchor: "外部锚定", analytical_correctness: "分析正确性" }, NOT_EVALUATED: "不评估——不判断" } };
const STATUS_TEXT = { VERIFIED: { en: "VERIFIED", zh: "已验证" }, TAMPERED: { en: "TAMPERED", zh: "已篡改" }, NOT_VERIFIED: { en: "NOT VERIFIED", zh: "未验证" }, NOT_PRESENT: { en: "NOT PRESENT", zh: "不存在" } };
const COL = { VERIFIED: 0x4ade80, TAMPERED: 0xef4444, NOT_VERIFIED: 0x8a92a0, dim: 0x3a4150, edge: 0x556, edgeBad: 0xef4444, focus: 0x60a5fa };

let LANG = "en", LAYOUT = "arc", TAMPERED = false, RMOTION = false, FOCUS = null;
const T = () => I18N[LANG];

const scenes = {};
async function load() {
  scenes.clean = await (await fetch("./fixtures/banking-seven-node.json")).json();
  scenes.tampered = await (await fetch("./fixtures/banking-tampered.json")).json();
  boot();
}
const cur = () => (TAMPERED ? scenes.tampered : scenes.clean);

// ── three setup ──
const stage = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0d10);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dir = new THREE.DirectionalLight(0xffffff, 0.6); dir.position.set(2, 3, 4); scene.add(dir);
const root = new THREE.Group(); scene.add(root);
stage.appendChild(renderer.domElement);
const CAM0 = new THREE.Vector3(0, 0.2, 4.2);
function recenter() { camera.position.copy(CAM0); controls.target.set(0, -0.1, 0); controls.update(); }

function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener("resize", resize);

// label sprite (billboard) — status text baked in, so status is legible without colour
function labelSprite(text, sub) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 96; const g = c.getContext("2d");
  g.fillStyle = "rgba(18,22,28,0.92)"; g.fillRect(0, 0, 256, 96); g.strokeStyle = "#232830"; g.strokeRect(0, 0, 256, 96);
  g.fillStyle = "#e6e6e6"; g.font = "bold 22px system-ui"; g.fillText(text.slice(0, 18), 10, 34);
  g.fillStyle = "#8a92a0"; g.font = "16px ui-monospace"; g.fillText(sub, 10, 66);
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sp.scale.set(0.7, 0.26, 1); return sp;
}
function nodeMesh(status) {
  // SHAPE encodes status too: verified=icosahedron, tampered=octahedron, else=box
  const geo = status === "VERIFIED" ? new THREE.IcosahedronGeometry(0.09, 0) : status === "TAMPERED" ? new THREE.OctahedronGeometry(0.11, 0) : new THREE.BoxGeometry(0.13, 0.13, 0.13);
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COL[status] ?? COL.dim, roughness: 0.5 }));
}

// ── layouts: position hints per node (semantics come from the scene) ──
function layoutPos(scene, i, n) {
  const N = scene.nodes.length;
  if (LAYOUT === "arc") { const a = (-60 + (120 * i) / (N - 1)) * Math.PI / 180; return new THREE.Vector3(Math.sin(a) * 1.6, -0.35, -Math.cos(a) * 1.6 + 1.4); }
  if (LAYOUT === "timeline") return new THREE.Vector3((i - (N - 1) / 2) * 0.55, n.type === "evidence" || n.type === "feature" || n.type === "diff" ? 0.4 : 0, 0);
  if (LAYOUT === "dag") { const layer = i, col = 0; return new THREE.Vector3((i - (N - 1) / 2) * 0.5, 0.5 - (i % 2) * 1.0, -layer * 0.15); }
  // hybrid: 3D detail only for the focused node region; others compressed on a line
  return new THREE.Vector3((i - (N - 1) / 2) * 0.42, i === FOCUS ? 0.25 : 0, i === FOCUS ? 0.3 : 0);
}

let meshes = [];
function build() {
  while (root.children.length) root.remove(root.children[0]);
  meshes = [];
  const sc = cur();
  // edges
  for (const e of sc.edges) {
    const a = sc.nodes.findIndex((n) => n.id === e.from), b = sc.nodes.findIndex((n) => n.id === e.to);
    const pa = layoutPos(sc, a, sc.nodes[a]), pb = layoutPos(sc, b, sc.nodes[b]);
    const bad = sc.nodes[a].status !== "VERIFIED" || sc.nodes[b].status !== "VERIFIED";
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([pa, pb]), new THREE.LineBasicMaterial({ color: bad ? COL.edgeBad : COL.edge }));
    line.userData.edge = true; root.add(line);
  }
  // nodes
  sc.nodes.forEach((n, i) => {
    const grp = new THREE.Group(); grp.position.copy(layoutPos(sc, i, n));
    const m = nodeMesh(n.status); grp.add(m);
    const lbl = labelSprite(LANG === "zh" ? n.label_full : n.label_short, `#${n.sequence} ${STATUS_TEXT[n.status]?.[LANG] ?? n.status}`);
    lbl.position.set(0, -0.22, 0); grp.add(lbl);
    grp.userData = { i, n }; root.add(grp); meshes.push(grp);
  });
  applyFocus();
  renderSide();
}

// focus + context: highlight focus + immediate neighbours (by sequence), fade the rest. No scene rotation.
function applyFocus() {
  const sc = cur();
  meshes.forEach((g) => {
    const i = g.userData.i, near = FOCUS === null ? true : Math.abs(i - FOCUS) <= 1;
    const mesh = g.children.find((c) => c.isMesh);
    if (mesh) mesh.material.opacity = near ? 1 : 0.25, mesh.material.transparent = !near;
    const spr = g.children.find((c) => c.isSprite); if (spr) spr.material.opacity = near ? 1 : 0.2;
    if (mesh) mesh.material.emissive = new THREE.Color(i === FOCUS ? COL.focus : 0x000000), mesh.material.emissiveIntensity = i === FOCUS ? 0.5 : 0;
  });
}

// ── DOM side panel: verification matrix + audit table + focus detail (always available = 2D fallback) ──
function renderSide() {
  const sc = cur();
  const ver = document.getElementById("ver"); ver.innerHTML = "";
  const add = (label, val, cls) => { const dt = document.createElement("dt"); dt.textContent = label; const dd = document.createElement("dd"); if (cls) dd.className = "s " + cls; dd.textContent = val; ver.append(dt, dd); };
  const map = { VERIFIED: "ok", FAILED: "bad", NOT_PRESENT: "dim", NOT_CHECKED: "warn" };
  for (const [k, v] of Object.entries(sc.verification)) {
    if (k === "analytical_correctness") add(T().checks[k], T().NOT_EVALUATED, "dim");
    else add(T().checks[k], v, map[v] || "dim");
  }
  const tb = document.getElementById("atbody"); tb.innerHTML = "";
  sc.nodes.forEach((n, i) => {
    const tr = document.createElement("tr"); if (i === FOCUS) tr.className = "focus";
    tr.tabIndex = 0; tr.onclick = () => setFocus(i); tr.onkeydown = (e) => { if (e.key === "Enter") setFocus(i); };
    const cls = n.status === "VERIFIED" ? "ok" : n.status === "TAMPERED" ? "bad" : "dim";
    tr.innerHTML = `<td>${n.sequence}</td><td>${esc(LANG === "zh" ? n.label_full : n.label_short)}</td><td class="st s ${cls}">${esc((STATUS_TEXT[n.status]?.[LANG]) ?? n.status)}</td>`;
    tb.appendChild(tr);
  });
  const d = document.getElementById("detail");
  if (FOCUS === null) d.innerHTML = `<span class="k">${LANG === "zh" ? "选择一个节点查看：声明 → 证据 → 来源" : "Select a node: claim → evidence → source"}</span>`;
  else { const n = sc.nodes[FOCUS]; d.innerHTML = `<div><b>#${n.sequence} ${esc(n.label_short)}</b></div><div class="k">${esc(n.accessibility)}</div>` +
    `<div>claim: ${esc((n.claim_ids || []).join(", ") || "—")}</div><div>evidence: ${esc((n.evidence_ids || []).join(", ") || "—")}</div><div>source: ${esc((n.source_ids || []).join(", ") || "—")}</div>` +
    (sc.tamper && n.sequence === sc.tamper.failed_sequence ? `<div class="s bad">${LANG === "zh" ? "篡改点，下游序号：" : "tamper point; downstream:"} ${sc.tamper.downstream_sequences.join(", ")}</div>` : ""); }
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function setFocus(i) { FOCUS = i; applyFocus(); renderSide(); }

// ── picking ──
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
renderer.domElement.addEventListener("pointerdown", (e) => {
  const r = renderer.domElement.getBoundingClientRect();
  mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  for (const hit of ray.intersectObjects(root.children, true)) { let g = hit.object; while (g && g.userData.i === undefined) g = g.parent; if (g) { setFocus(g.userData.i); break; } }
});

// ── controls ──
function applyLang() {
  document.documentElement.lang = LANG === "zh" ? "zh-CN" : "en";
  document.getElementById("t-title").textContent = T().title;
  document.getElementById("tamper").textContent = T().tamper[TAMPERED ? 1 : 0];
  for (const id of ["stepb", "stepf", "recenter", "reset", "mode2d", "rmotion"]) document.querySelector(`#${id}`).textContent = T()[id];
  document.getElementById("t-ver").textContent = T().ver; document.getElementById("t-audit").textContent = T().audit;
  document.getElementById("t-seq").textContent = T().seq; document.getElementById("t-node").textContent = T().node; document.getElementById("t-status").textContent = T().status;
  document.getElementById("t-note").textContent = T().note;
  document.getElementById("lang-en").setAttribute("aria-pressed", String(LANG === "en"));
  document.getElementById("lang-zh").setAttribute("aria-pressed", String(LANG === "zh"));
  build();
}
document.querySelectorAll(".lay").forEach((b) => b.onclick = () => { LAYOUT = b.dataset.l; document.querySelectorAll(".lay").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); build(); });
document.getElementById("tamper").onclick = () => { TAMPERED = !TAMPERED; document.getElementById("tamper").setAttribute("aria-pressed", String(TAMPERED)); FOCUS = TAMPERED ? cur().tamper.failed_sequence : null; applyLang(); };
document.getElementById("stepf").onclick = () => setFocus(Math.min((FOCUS ?? -1) + 1, cur().nodes.length - 1));
document.getElementById("stepb").onclick = () => setFocus(Math.max((FOCUS ?? cur().nodes.length) - 1, 0));
document.getElementById("recenter").onclick = recenter;
document.getElementById("reset").onclick = () => { TAMPERED = false; FOCUS = null; LAYOUT = "arc"; document.querySelectorAll(".lay").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.l === "arc"))); document.getElementById("tamper").setAttribute("aria-pressed", "false"); recenter(); applyLang(); };
document.getElementById("mode2d").onclick = (e) => { const on = document.body.dataset.mode2d !== "true"; document.body.dataset.mode2d = on; e.target.setAttribute("aria-pressed", String(on)); render2D(on); };
document.getElementById("rmotion").onclick = (e) => { RMOTION = !RMOTION; e.target.setAttribute("aria-pressed", String(RMOTION)); controls.enableDamping = !RMOTION; };
document.getElementById("lang-en").onclick = () => { LANG = "en"; applyLang(); };
document.getElementById("lang-zh").onclick = () => { LANG = "zh"; applyLang(); };

function render2D(on) {
  const el = document.getElementById("canv2d"); if (!on) return;
  const sc = cur();
  el.innerHTML = `<h2>${LANG === "zh" ? "2D 审计表（回退视图）" : "2D audit table (fallback)"}</h2>` +
    `<table class="audit"><thead><tr><th>${T().seq}</th><th>${T().node}</th><th>type</th><th>${T().status}</th><th>label priority</th></tr></thead><tbody>` +
    sc.nodes.map((n) => `<tr><td>${n.sequence}</td><td>${esc(LANG === "zh" ? n.label_full : n.label_short)}</td><td>${esc(n.type)}</td><td class="s ${n.status === "VERIFIED" ? "ok" : n.status === "TAMPERED" ? "bad" : "dim"}">${esc((STATUS_TEXT[n.status]?.[LANG]) ?? n.status)}</td><td>${n.label_priority}</td></tr>`).join("") +
    `</tbody></table>` + (sc.tamper ? `<p class="s bad">${LANG === "zh" ? "篡改序号" : "tamper sequence"} ${sc.tamper.failed_sequence} → ${LANG === "zh" ? "下游" : "downstream"} ${sc.tamper.downstream_sequences.join(", ")}</p>` : "");
}

function boot() { resize(); recenter(); applyLang(); loop(); window.__ready = true; }
function loop() { requestAnimationFrame(loop); if (!RMOTION) controls.update(); renderer.render(scene, camera); }
load();
