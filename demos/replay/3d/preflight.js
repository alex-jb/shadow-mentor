// demos/replay/3d/preflight.js
// ─────────────────────────────────────────────────────────────────
// On-device WebXR PREFLIGHT + diagnostics panel. The point: make the on-device
// test decidable in ONE shot, WITHOUT a remote debugger — the panel is visible in
// the flat browser view BEFORE you tap the XR button (so a failure-to-start is
// diagnosable), and it updates AFTER a session grants.
//
// It ASSERTS NOTHING. It reports what the runtime actually says: isSessionSupported
// for immersive-ar / immersive-vr, then (post-session) the granted mode from
// environmentBlendMode, input sources, and whether the viewer POSE actually
// translates (real 6DoF) vs only rotates (3DoF). world-lock/30s + device/firmware/
// eye are MANUAL — a web page cannot reliably detect them, so the tester fills them.
// ─────────────────────────────────────────────────────────────────

export function initPreflight({ renderer, mount = document.body, appCommit = "" }) {
  const panel = document.createElement("div");
  panel.id = "xr-preflight";
  mount.appendChild(panel);

  const state = {
    tested_at: null,
    app_commit: appCommit,
    browser: navigator.userAgent,
    android_device: "",           // manual
    xreal_model: "XREAL One Pro",
    eye_attached: null,           // manual
    firmware: "",                 // manual
    secure_context: window.isSecureContext,
    navigator_xr: !!navigator.xr,
    immersive_ar_supported: null,
    immersive_vr_supported: null,
    requested_mode: "immersive-ar (button probes ar → vr)",
    granted_mode: null,
    environment_blend_mode: null,
    reference_space: null,
    input_sources: [],
    translation_detected: null,   // true once viewer pose moves > 8cm
    world_lock_30s: null,         // manual observation
    notes: "",
  };

  let pmin = null, pmax = null, translationLatched = false;

  async function probe() {
    if (navigator.xr) {
      try { state.immersive_ar_supported = await navigator.xr.isSessionSupported("immersive-ar"); } catch { state.immersive_ar_supported = false; }
      try { state.immersive_vr_supported = await navigator.xr.isSessionSupported("immersive-vr"); } catch { state.immersive_vr_supported = false; }
    }
    render();
  }

  function onSessionStart() {
    const s = renderer.xr.getSession?.();
    const blend = s?.environmentBlendMode;
    state.granted_mode = (blend && blend !== "opaque") ? "immersive-ar" : "immersive-vr";
    state.environment_blend_mode = blend ?? "unknown";
    state.input_sources = (s?.inputSources ?? []).map((i) => i.targetRayMode);
    state.tested_at = new Date().toISOString();
    pmin = pmax = null; translationLatched = false;
    render();
  }

  // Called from the XR frame loop with the viewer pose position {x,y,z}.
  function updatePose(p) {
    if (!p || translationLatched) return;
    if (!pmin) { pmin = { x: p.x, y: p.y, z: p.z }; pmax = { x: p.x, y: p.y, z: p.z }; return; }
    pmin.x = Math.min(pmin.x, p.x); pmin.y = Math.min(pmin.y, p.y); pmin.z = Math.min(pmin.z, p.z);
    pmax.x = Math.max(pmax.x, p.x); pmax.y = Math.max(pmax.y, p.y); pmax.z = Math.max(pmax.z, p.z);
    const range = Math.max(pmax.x - pmin.x, pmax.y - pmin.y, pmax.z - pmin.z);
    if (range > 0.08) { state.translation_detected = true; translationLatched = true; render(); } // >8cm = real 6DoF
    else if (state.translation_detected == null) state.translation_detected = false;
  }

  function cell(label, val) {
    const disp = val === null ? "NOT TESTED" : val === true ? "YES" : val === false ? "NO" : String(val);
    const cls = val === true ? "ok" : val === false ? "bad" : "muted";
    return `<div class="pf-row"><span>${label}</span><b class="${cls}">${disp}</b></div>`;
  }

  function render() {
    panel.innerHTML =
      `<div class="pf-title">SHADOW XR PREFLIGHT</div>` +
      cell("Secure context", state.secure_context) +
      cell("WebXR API", state.navigator_xr) +
      cell("Immersive AR", state.immersive_ar_supported) +
      cell("Immersive VR", state.immersive_vr_supported) +
      cell("Requested mode", state.requested_mode) +
      cell("Granted mode", state.granted_mode) +
      cell("Environment blend", state.environment_blend_mode) +
      cell("Input sources", state.input_sources.length ? state.input_sources.join(",") : null) +
      cell("6DoF translation", state.translation_detected) +
      cell("World-lock 30s (manual)", state.world_lock_30s) +
      `<div class="pf-manual">manual: ` +
        `<label>Eye <input type="checkbox" id="pf-eye"></label>` +
        `<input id="pf-dev" placeholder="Android device">` +
        `<input id="pf-fw" placeholder="firmware">` +
      `</div>` +
      `<div class="pf-btns"><button id="pf-copy">COPY</button><button id="pf-dl">DOWNLOAD REPORT</button><button id="pf-min">–</button></div>`;

    const eye = panel.querySelector("#pf-eye"); if (eye) { eye.checked = !!state.eye_attached; eye.onchange = () => { state.eye_attached = eye.checked; }; }
    const dev = panel.querySelector("#pf-dev"); if (dev) { dev.value = state.android_device; dev.oninput = () => { state.android_device = dev.value; }; }
    const fw = panel.querySelector("#pf-fw"); if (fw) { fw.value = state.firmware; fw.oninput = () => { state.firmware = fw.value; }; }
    panel.querySelector("#pf-copy").onclick = () => { try { navigator.clipboard.writeText(JSON.stringify(state, null, 2)); } catch {} };
    panel.querySelector("#pf-dl").onclick = () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "shadow-xr-report.json"; a.click();
    };
    panel.querySelector("#pf-min").onclick = () => panel.classList.toggle("min");
  }

  renderer.xr.addEventListener("sessionstart", onSessionStart);
  renderer.xr.addEventListener("sessionend", render);
  probe();
  return { updatePose, state, render };
}
