// demos/replay/3d/scene.js
// ─────────────────────────────────────────────────────────────────
// The Audit Room scene graph. One arc of evidence cards; the only
// animation in the product is the tamper cascade. Everything obeys the
// design principles: #000 invisible bodies (we simply don't draw a body —
// the room shows through; only edges, text, and connectors emit light),
// colour = status only, stillness until one thing happens, all UI in-scene.
//
// The scene owns visual state + the real verifier-driven tamper/heal/annotate
// flows (imported from ./verify.js). The app drives it via a small API:
// update(dt,camera), raycastSeq, select, focusEvent, filterByType,
// applyLens/clearLens, showTrustLevels, tamper/reset/annotate/export.
// ─────────────────────────────────────────────────────────────────
import * as THREE from "three";
import { makeCardFace, makeText, disposeMesh, billboardInView } from "./labels.js";
import { verifyWorking, runTamperCycle, annotate, clonePristine } from "./verify.js";
import { DEMO_BUNDLE, DEMO_PUBLIC_KEY_PEM } from "./demo-data.js";
import { anchorPanel, viewRelativeFallback } from "./annotation-anchor.js";

const DEG = Math.PI / 180;
const smooth = (k) => k * k * (3 - 2 * k);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// Review-lens predicates (Phase 4.2.1). A "declared workspace glob" and
// "sensitive path glob" would be config in production; for the demo we key
// off the tool recorded in extensions, which is what the bundle carries.
const LENS = {
  security: (ev) => {
    const t = ev.extensions?.tool;
    return t === "Bash" || t === "Write" || t === "Edit" || t === "MultiEdit"
      || /network|shell|exec/.test(ev.event_type);
  },
  compliance: (ev) => {
    const t = ev.extensions?.tool;
    return t === "Read" || ev.event_type === "human_approval" || ev.event_type === "model_call";
  },
  quality: (ev) => ev.event_type === "error" || ev.event_type === "tool_result",
};

function roundedRectPoints(w, h, r, seg = 6) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s.getPoints(seg * 4);
}

function edgeLoop(w, h, r, colorHex, opacity) {
  const pts = roundedRectPoints(w, h, r).map((p) => new THREE.Vector3(p.x, p.y, 0));
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity, toneMapped: false });
  return new THREE.LineLoop(geo, mat);
}

export function createAuditRoom({ C, bundle = DEMO_BUNDLE } = {}) {
  const group = new THREE.Group();
  const cards = [];
  const connectors = [];
  const anims = [];
  let workingBundle = clonePristine(bundle);
  let state = "PRISTINE";
  let selectedSeq = null;
  let activeLens = null;
  let filterType = null;
  let showTrust = false;
  const _tmp = new THREE.Vector3();
  // Reusable scratch vectors for the per-frame proximity loop — avoids ~48 Vector3 allocations/frame
  // (P0 fix from the 2026-07 deep-audit: was camPos.clone() + a new Vector3 per card, every frame).
  const _camPos = new THREE.Vector3();
  const _cardPos = new THREE.Vector3();

  // ── tween scheduler (frame-driven, pausable — no setTimeout) ──
  function tween(delayMs, durMs, fn, done) {
    anims.push({ t: -delayMs / 1000, dur: durMs / 1000, fn, done, started: false });
  }
  function stepAnims(dt) {
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i];
      a.t += dt;
      if (a.t < 0) continue;
      const k = a.dur <= 0 ? 1 : clamp01(a.t / a.dur);
      a.fn(smooth(k));
      if (k >= 1) { a.done?.(); anims.splice(i, 1); }
    }
  }
  function clearAnims() { anims.length = 0; }

  // ── card factory ──
  function makeCard(evt, i, total) {
    const cg = new THREE.Group();
    const edge = edgeLoop(C.CARD_W, C.CARD_H, C.CARD_CORNER, new THREE.Color(C.INK.text).getHex(), C.EDGE_EMISSIVE);
    cg.add(edge);

    const face = makeCardFace(evt, C);
    face.position.z = 0.002;
    cg.add(face);

    // detail line (Phase 5.1 proximity disclosure) — hidden until near
    const summary = summarize(evt);
    const detail = makeText(`#${evt.seq} · ${evt.actor}\n${summary}`, {
      size: C.FONT_SIZE_SEQ * 0.9, color: C.INK.textDim, worldWidth: C.CARD_W, align: "left", mono: true, weight: 500,
    });
    detail.position.set(0, -C.CARD_H / 2 - detail.userData.worldH / 2 - 0.02, 0.002);
    detail.material.opacity = 0;
    cg.add(detail);

    // invisible raycast target
    const hit = new THREE.Mesh(
      new THREE.PlaneGeometry(C.CARD_W, C.CARD_H),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    // P0 (2026-07 deep-audit): non-rendered — the renderer skips visible=false, saving one draw call per
    // card (two under SBS), while Raycaster ignores .visible so pointer/controller selection is unchanged.
    // Proven in test/audit-room-hit-proxy-raycast.test.js against the shipped three revision.
    hit.visible = false;
    cg.add(hit);

    // arc placement (principle 2: depth via arc + scale, never Z-stacking).
    // Concave circle of radius R: centre card farthest (z = -R), edges wrap
    // nearer; all cards in front of the viewer.
    const t = total > 1 ? i / (total - 1) : 0.5;
    const ang = (t - 0.5) * C.ARC_SPREAD_DEG * DEG * C.ARC_CURVATURE;
    const R = C.ARC_RADIUS;
    cg.position.set(Math.sin(ang) * R, C.ARC_Y, -Math.cos(ang) * R);
    cg.lookAt(0, C.ARC_Y, C.CAMERA_POS[2]); // face the default viewer point
    // nearer cards (arc edges) grow slightly — a parallax depth cue
    const depth = 1 - Math.cos(ang); // 0 at centre → larger toward edges
    const sc = C.CARD_SCALE * (1 + depth * C.CARD_DEPTH_SCALE);
    cg.scale.setScalar(sc);

    const card = {
      seq: evt.seq, evt, group: cg, edge, edgeMat: edge.material, face, detail, hit,
      status: "intact", baseScale: sc, lensMatch: true, targetDetail: 0, curDetail: 0,
      pulse: false,
    };
    hit.userData.card = card;
    group.add(cg);
    cards.push(card);
    return card;
  }

  function summarize(ev) {
    const t = ev.extensions?.tool;
    if (ev.event_type === "tool_call" && t) return `${t.toLowerCase()} call`;
    if (ev.event_type === "tool_result" && t) return `${t.toLowerCase()} result`;
    if (ev.event_type === "prompt") return "user prompt";
    if (ev.event_type === "review_annotation") return "reviewer note";
    return ev.event_type.replace(/_/g, " ");
  }

  function buildConnectors() {
    connectors.forEach((c) => { group.remove(c.line); disposeMesh(c.line); });
    connectors.length = 0;
    for (let i = 1; i < cards.length; i++) {
      const a = cards[i - 1].group.position.clone();
      const b = cards[i].group.position.clone();
      const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color(C.INK.connector).getHex(), transparent: true, opacity: C.CONNECTOR_ALPHA, toneMapped: false,
      });
      const line = new THREE.Line(geo, mat);
      group.add(line);
      connectors.push({ line, mat, from: i - 1, to: i });
    }
  }

  // ── trust badges at the end of the arc (Phase 5.4) ──
  let trustGroup = null;
  function buildTrustBadges() {
    if (trustGroup) { group.remove(trustGroup); }
    trustGroup = new THREE.Group();
    const earned = new Set(["SELF_SIGNED"]); // this bundle carries only a self-signature
    if (Array.isArray(workingBundle.external_anchors) && workingBundle.external_anchors.length) earned.add("TIME_ANCHORED");
    if (workingBundle.rekor_entries?.length) earned.add("LOG_ANCHORED");
    const ladder = ["SELF_SIGNED", "TIME_ANCHORED", "LOG_ANCHORED"];
    const last = cards[cards.length - 1];
    const base = last ? last.group.position.clone() : new THREE.Vector3(0, 0, 0);
    ladder.forEach((name, i) => {
      const has = earned.has(name);
      const label = makeText(has ? name : `${name} · —`, {
        size: C.FONT_SIZE_BADGE, worldWidth: 1.2, align: "left",
        color: has ? C.STATUS.healed : C.INK.textDim, weight: 600, mono: true,
      });
      label.position.set(base.x + 0.9, base.y + 0.35 - i * (C.FONT_SIZE_BADGE * 2.4), base.z);
      label.material.opacity = has ? 0.95 : 0.35;
      label.userData.earned = has;
      trustGroup.add(label);
    });
    group.add(trustGroup);
  }

  // ── big in-scene caption (Phase 3.4). Camera-relative + billboarded so it
  // is always readable — large and centred for CAPTION_HOLD_MS, then docked
  // to the upper-left of the view — no matter which beat the camera is on. ──
  let caption = null;
  function setCaption(obj) {
    if (caption) { group.remove(caption); disposeMesh(caption); caption = null; }
    if (!obj) return;
    const text = `SEQ     ${obj.seq}\nREASON  ${obj.reason}\nIMPACT  ${obj.impact}`;
    caption = makeText(text, {
      size: C.FONT_SIZE_CAPTION, worldWidth: 4.4, align: "left",
      color: obj.tone === "ok" ? C.STATUS.healed : C.STATUS.tampered, weight: 600, mono: true,
    });
    caption.userData.slot = "center";
    caption.userData.age = 0;
    group.add(caption);
  }
  function placeCaption(camera) {
    if (!caption) return;
    if (caption.userData.slot === "center") {
      caption.scale.setScalar(1);
      billboardInView(caption, camera, { x: 0, y: 0.55, d: 2.4 });
    } else {
      caption.scale.setScalar(0.62);
      billboardInView(caption, camera, { x: -0.95, y: 0.95, d: 2.4 });
    }
  }

  // ── build ──
  function layout() {
    cards.forEach((c) => { group.remove(c.group); });
    cards.length = 0;
    const total = workingBundle.events.length;
    workingBundle.events.forEach((e, i) => makeCard(e, i, total));
    buildConnectors();
    buildTrustBadges();
  }
  layout();

  // ── per-card visual application ──
  function paintCard(card, status, { animateEdge = false } = {}) {
    card.status = status;
    const col = status === "broken" || status === "tampered" ? C.STATUS.tampered
      : status === "error" ? C.STATUS.error
      : status === "healed" ? C.STATUS.healed : C.INK.text;
    const target = new THREE.Color(col);
    if (animateEdge) {
      const from = card.edgeMat.color.clone();
      tween(0, C.CASCADE_EDGE_MS, (k) => card.edgeMat.color.lerpColors(from, target, k));
    } else {
      card.edgeMat.color.copy(target);
    }
    card.face.repaint(status === "tampered" ? "tampered" : status === "broken" ? "broken" : "intact");
  }

  function connectorInto(seq) { return connectors.find((c) => c.to === seq); }

  // ── PRISTINE → TAMPERED (Phase 3) ──
  async function tamper() {
    if (state !== "PRISTINE") return null;
    // The REAL path: same tamper mutation + same verifier the 2D replay and
    // verify.html use, so exporting this working bundle reproduces the
    // identical failure (Phase 3.1 + 3.6 parity).
    const { tamperedSeq, verify, caption: cap } = await runTamperCycle({
      workingBundle, publicKeyPem: DEMO_PUBLIC_KEY_PEM,
    });
    state = "TAMPERED";
    const brokenFrom = verify?.error?.seq ?? tamperedSeq + 1;

    // mutation site → red immediately (the altered event)
    const site = cards.find((c) => c.seq === tamperedSeq);
    if (site) paintCard(site, "tampered", { animateEdge: true });

    // downstream cards dim sequentially (principle: propagation IS the story)
    const downstream = cards.filter((c) => c.seq >= brokenFrom).sort((a, b) => a.seq - b.seq);
    downstream.forEach((card, idx) => {
      const delay = idx * C.CASCADE_STEP_MS;
      // traveling break pulse on the incoming connector
      const conn = connectorInto(card.seq);
      if (conn) {
        tween(delay, 220, (k) => {
          conn.mat.color.lerpColors(new THREE.Color(C.INK.connector), new THREE.Color(C.STATUS.tampered), k);
          conn.mat.opacity = C.CONNECTOR_ALPHA + 0.4 * Math.sin(k * Math.PI);
        }, () => { conn.mat.color.set(C.STATUS.tampered); conn.mat.opacity = 0.85; });
      }
      tween(delay, C.CASCADE_EDGE_MS, (k) => {
        card.edgeMat.color.lerpColors(new THREE.Color(C.INK.text), new THREE.Color(C.STATUS.tampered), k);
        const op = C.EDGE_EMISSIVE + (C.DIM_OPACITY - C.EDGE_EMISSIVE) * k;
        card.edgeMat.opacity = op;
      }, () => { card.status = "broken"; card.face.repaint("broken"); card.targetDetail = 0; });
    });

    setCaption({ ...cap, tone: "bad" });
    if (caption) caption.userData.age = 0;
    return cap;
  }

  // ── reset → heal (Phase 3.5): reverse-order re-brighten in green ──
  async function reset() {
    if (state !== "TAMPERED") return;
    clearAnims();
    workingBundle = clonePristine(bundle);
    const rev = [...cards].sort((a, b) => b.seq - a.seq);
    rev.forEach((card, idx) => {
      const delay = idx * (C.CASCADE_STEP_MS * 0.8);
      const conn = connectorInto(card.seq);
      tween(delay, 300, (k) => {
        card.edgeMat.color.lerpColors(new THREE.Color(C.STATUS.tampered), new THREE.Color(C.STATUS.healed), k);
        card.edgeMat.opacity = C.DIM_OPACITY + (C.EDGE_EMISSIVE - C.DIM_OPACITY) * k;
        if (conn) conn.mat.color.lerpColors(new THREE.Color(C.STATUS.tampered), new THREE.Color(C.STATUS.healed), k);
      }, () => {
        // settle to intact
        tween(0, 260, (k) => {
          card.edgeMat.color.lerpColors(new THREE.Color(C.STATUS.healed), new THREE.Color(C.INK.text), k);
          if (conn) conn.mat.color.lerpColors(new THREE.Color(C.STATUS.healed), new THREE.Color(C.INK.connector), k);
        }, () => { if (conn) conn.mat.opacity = C.CONNECTOR_ALPHA; });
        card.status = "intact"; card.face.repaint("intact");
      });
    });
    state = "PRISTINE";
    setCaption(null);
    // re-verify pristine to confirm the healed chain is authentic again
    const v = await verifyWorking(workingBundle);
    return v;
  }

  // ── export tampered working bundle to disk (Phase 3.6) ──
  function exportWorking() {
    const blob = new Blob([JSON.stringify(workingBundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `working-bundle-${state.toLowerCase()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ── selection + inspector (Phase 5.2) + Flow-inspired anchored annotation (V11) ──
  let inspector = null;
  let trackingLost = false;
  function setInspectorTrackingLost(v) { trackingLost = !!v; }
  function clearInspector() {
    if (inspector) { group.remove(inspector); inspector.traverse((o) => disposeMesh(o)); inspector = null; }
  }
  // `card` carries .evt + .group (world-positioned on the arc). The panel now ANCHORS beside the
  // selected card with a leader line to its boundary, instead of docking at a fixed world point.
  function buildInspector(card) {
    clearInspector();
    inspector = new THREE.Group();
    const w = 1.7, rows = inspectorRows(card.evt);
    const body = makeText(rows, {
      size: C.FONT_SIZE_INSPECTOR, worldWidth: w - 0.14, align: "left", color: C.INK.text, mono: true, weight: 500,
    });
    const h = Math.max(0.7, body.userData.worldH + 0.16);
    const frame = edgeLoop(w, h, 0.05, new THREE.Color(C.INK.text).getHex(), 0.5);
    body.position.set(0, 0, 0.002);
    inspector.add(frame); inspector.add(body);

    const cardPos = card.group.getWorldPosition(_cardPos);
    const panel = { halfW: w / 2, halfH: h / 2 };
    const view = { minX: -3, maxX: 3, minY: C.ARC_Y - 1.5, maxY: C.ARC_Y + 1.5 };
    const spec = trackingLost
      ? viewRelativeFallback({ panel, view }) // Tracking Lost → stable view-relative, no leader line
      : anchorPanel({
          card: { x: cardPos.x, y: cardPos.y, z: cardPos.z, halfW: C.CARD_W / 2, halfH: C.CARD_H / 2 },
          panel, view, arcCenterX: 0,
        });
    inspector.position.set(spec.position.x, spec.position.y, spec.position.z);
    // leader line: card boundary → panel edge (omitted in the tracking-lost fallback)
    if (spec.leaderStart && spec.leaderEnd) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(spec.leaderStart.x - spec.position.x, spec.leaderStart.y - spec.position.y, spec.leaderStart.z - spec.position.z),
        new THREE.Vector3(spec.leaderEnd.x - spec.position.x, spec.leaderEnd.y - spec.position.y, spec.leaderEnd.z - spec.position.z),
      ]);
      const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(C.INK.textDim).getHex(), transparent: true, opacity: 0.6, toneMapped: false });
      inspector.add(new THREE.Line(geo, mat));
    }
    group.add(inspector);
  }
  function inspectorRows(ev) {
    const short = (h) => (h ? h.slice(0, 12) : "—");
    const lines = [
      `type       ${ev.event_type}`,
      `actor      ${ev.actor}`,
      `seq        ${ev.seq}`,
      `ts         ${ev.ts_utc}`,
      `payload    ${short(ev.payload_hash)}…`,
      `prev_hash  ${short(ev.prev_hash)}…`,
    ];
    const t = ev.extensions?.tool;
    if (ev.event_type === "tool_call" && t) lines.push(`tool       ${t}`);
    if (ev.event_type === "review_annotation") lines.push(`note       ${ev.extensions?.review?.note ?? ""}`);
    lines.push("", "› open full payload in 2D inspector"); // Phase 5.3: never render full payload in-scene
    return lines.join("\n");
  }
  function select(seq) {
    selectedSeq = seq;
    const card = cards.find((c) => c.seq === seq);
    if (!card) return;
    buildInspector(card);
    // brief focus pulse
    card.pulse = true;
    tween(0, 600, () => {}, () => { card.pulse = false; });
  }
  function clearSelection() { selectedSeq = null; clearInspector(); }

  // ── voice/keyboard-driven queries ──
  function focusEvent(seq) {
    const card = cards.find((c) => c.seq === seq);
    if (!card) return false;
    select(seq);
    return true;
  }
  function filterByType(type) {
    filterType = type;
    return cards.filter((c) => matchesQuery(c.evt, type)).map((c) => c.seq);
  }
  function matchesQuery(ev, q) {
    if (!q) return true;
    const s = String(q).toLowerCase();
    if (ev.event_type.toLowerCase().includes(s)) return true;
    if ((ev.extensions?.tool ?? "").toLowerCase().includes(s)) return true;
    if (s === "shell" || s === "command") return ev.extensions?.tool === "Bash";
    return false;
  }
  function clearFilter() { filterType = null; }
  function explainEvent(seq) {
    const ev = cards.find((c) => c.seq === seq)?.evt;
    if (!ev) return `No event at seq ${seq}.`;
    return `seq ${seq} · ${ev.event_type}${ev.extensions?.tool ? " (" + ev.extensions.tool + ")" : ""} by ${ev.actor}. `
      + `Own hash chains to prev ${ev.prev_hash.slice(0, 8)}…; ${summarize(ev)}.`;
  }
  function applyLens(name) { activeLens = LENS[name] ? name : null; return activeLens; }
  function clearLens() { activeLens = null; }
  function setShowTrust(v) { showTrust = v; }

  // ── annotation (Phase 4.2.3) ──
  async function annotateSelected(note = "reviewed — consistent with policy") {
    if (selectedSeq == null) return { ok: false, reason: "no_selection" };
    await annotate(workingBundle, selectedSeq, note);
    layout(); // rebuild to include the new review_annotation card
    const v = await verifyWorking(workingBundle);
    // tag the annotated target with an error-amber pulse ring briefly
    const card = cards.find((c) => c.seq === selectedSeq);
    if (card) { card.face.repaint("intact"); }
    return v;
  }

  // ── per-frame update ──
  function update(dt, camera) {
    stepAnims(dt);

    // caption dwell → dock, always kept in view + billboarded to the camera
    if (caption) {
      if (caption.userData.slot === "center") {
        caption.userData.age += dt * 1000;
        if (caption.userData.age > C.CAPTION_HOLD_MS) caption.userData.slot = "docked";
      }
      placeCaption(camera);
    }

    const camPos = camera.getWorldPosition(_camPos);       // reused scratch — no per-frame alloc
    const t = performance.now() * 0.001;
    for (const card of cards) {
      // billboard detail + face toward camera is not needed (cards face arc
      // centre); but proximity disclosure IS per-camera-distance.
      const d = card.group.getWorldPosition(_cardPos).distanceTo(camPos);  // reused scratch — no per-card alloc
      card.targetDetail = d <= C.PROXIMITY_THRESHOLD && card.status !== "broken" ? 1 : 0;
      const rate = dt / (C.FADE_MS / 1000);
      card.curDetail += Math.sign(card.targetDetail - card.curDetail) * rate;
      card.curDetail = clamp01(card.curDetail);
      card.detail.material.opacity = card.curDetail * 0.9;

      // lens / filter dimming + highlight pulse (Phase 4.2.2)
      let match = true;
      if (activeLens) match = LENS[activeLens](card.evt);
      else if (filterType) match = matchesQuery(card.evt, filterType);
      card.lensMatch = match;

      const lensActive = activeLens || filterType;
      let baseOpacity = card.status === "broken" ? C.DIM_OPACITY : C.EDGE_EMISSIVE;
      if (lensActive && !match) baseOpacity = Math.min(baseOpacity, C.LENS_DIM_OPACITY);
      // don't fight an in-flight colour tween on broken cards
      if (!anims.length || card.status === "intact") {
        let op = baseOpacity;
        if ((lensActive && match) || card.pulse) {
          const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * C.LENS_PULSE_HZ);
          op = baseOpacity + (1 - baseOpacity) * pulse;
          // white edge pulse when lens-matched
          if (lensActive && match && card.status === "intact") {
            card.edgeMat.color.lerp(new THREE.Color(C.INK.lensPulse), 0.15);
          }
        } else if (lensActive && !match && card.status === "intact") {
          card.edgeMat.color.lerp(new THREE.Color(C.INK.text), 0.1);
        }
        card.edgeMat.opacity = op;
      }
    }

    // trust badge emphasis
    if (trustGroup) {
      trustGroup.children.forEach((label) => {
        const target = label.userData.earned ? (showTrust ? 1.0 : 0.9) : (showTrust ? 0.5 : 0.3);
        label.material.opacity += (target - label.material.opacity) * Math.min(1, dt * 6);
      });
    }
  }

  function raycastSeq(raycaster) {
    const hits = raycaster.intersectObjects(cards.map((c) => c.hit), false);
    return hits.length ? hits[0].object.userData.card.seq : null;
  }

  return {
    group, cards, connectors, update, raycastSeq,
    select, clearSelection, focusEvent, filterByType, clearFilter,
    explainEvent, applyLens, clearLens, setShowTrust,
    tamper, reset, exportWorking, annotateSelected, setCaption,
    get state() { return state; },
    get selectedSeq() { return selectedSeq; },
    get workingBundle() { return workingBundle; },
    verifyWorking: () => verifyWorking(workingBundle),
    _clearAnims: clearAnims,
  };
}
