// demos/replay/main.js
// Wires up drop → parse → render → tamper. Read the design first:
// docs/spec/m5-replay-2d-design.md.
//
// Runs directly from `file://`. No build. No CDN. No network.
//
// URL params:
//   ?xreal=1  — activate in-glasses legibility tuning (2026-07-13 research):
//     - Bigger fonts (33 PPD birdbath optics floor)
//     - Higher contrast (never pure white; #E8ECF3 target)
//     - Narrower content column (≤ 68ch, Nielsen Norman AR ceiling)
//     - Reduced motion (fixed ~4m focal plane, avoid vergence-accommodation
//       conflict)
//     Set the flag by opening `index.html?xreal=1` or by paying the Chrome
//     cmdline zoom cost:  open -na "Google Chrome" --args --force-device-scale-factor=1.25

import { verifyBundleInBrowser } from "./verify-browser.js";
import { renderTimeline, selectRow, applyTamperVisual, clearTamperVisual } from "./timeline.js";
import { renderInspector, renderInspectorEmpty } from "./inspector.js";
import { clonePristine, runTamperCycle } from "./tamper.js";

// Read URL params before anything renders. `?xreal=1` flips a body attribute
// that a matching CSS rule ([data-xreal="true"]) uses for the overrides.
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get("xreal") === "1") {
  document.body.setAttribute("data-xreal", "true");
}

const el = {
  drop: document.getElementById("drop"),
  dropBox: document.getElementById("drop-box"),
  dropInput: document.getElementById("drop-input"),
  dropPick: document.getElementById("drop-pick"),
  pubKey: document.getElementById("pub-key"),
  workshop: document.getElementById("workshop"),
  timeline: document.getElementById("timeline"),
  inspector: document.getElementById("inspector"),
  verdictState: document.getElementById("verdict-state"),
  hdrMeta: document.getElementById("hdr-meta"),
  btnTamper: document.getElementById("btn-tamper"),
  btnReset: document.getElementById("btn-reset"),
  caption: document.getElementById("tamper-caption"),
};

// Session state — everything is in-memory. Closing the tab wipes it.
const state = {
  pristineRef: null,   // deep-frozen source of truth (from the file)
  workingBundle: null, // what the UI + verifier operate on
  publicKeyPem: "",    // whatever's in the textarea
  isTampered: false,
};

// ── drop / file input ────────────────────────────────────────

el.dropBox.addEventListener("click", () => el.dropInput.click());
el.dropPick.addEventListener("click", (e) => {
  e.stopPropagation();
  el.dropInput.click();
});
el.dropBox.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    el.dropInput.click();
  }
});
el.dropBox.addEventListener("dragover", (e) => {
  e.preventDefault();
  el.dropBox.classList.add("drag-over");
});
el.dropBox.addEventListener("dragleave", () => el.dropBox.classList.remove("drag-over"));
el.dropBox.addEventListener("drop", (e) => {
  e.preventDefault();
  el.dropBox.classList.remove("drag-over");
  const file = e.dataTransfer?.files?.[0];
  if (file) void handleFile(file);
});
el.dropInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) void handleFile(file);
});

async function handleFile(file) {
  let text;
  try {
    text = await file.text();
  } catch (err) {
    showError(`could not read file: ${err.message}`);
    return;
  }

  let bundle;
  try {
    bundle = JSON.parse(text);
  } catch (err) {
    showError(`file is not valid JSON: ${err.message}`);
    return;
  }

  if (!bundle || typeof bundle !== "object" || !Array.isArray(bundle.events)) {
    showError("file doesn't look like a Shadow evidence bundle (missing events array)");
    return;
  }

  state.pristineRef = Object.freeze(bundle);
  state.workingBundle = clonePristine(bundle);
  state.publicKeyPem = el.pubKey.value.trim();
  state.isTampered = false;

  await renderAll();

  // Reveal workshop, hide drop.
  el.drop.hidden = true;
  el.workshop.hidden = false;
}

// ── render ────────────────────────────────────────────────────

async function renderAll() {
  renderTimeline(el.timeline, state.workingBundle.events, onSelectRow);
  renderInspectorEmpty(el.inspector);
  clearTamperVisual(el.timeline);
  hideCaption();
  await refreshVerdict();
  updateHeader();
  el.btnReset.disabled = !state.isTampered;
  el.btnTamper.disabled = !state.publicKeyPem || state.isTampered;
}

function updateHeader() {
  const h = state.workingBundle.header;
  const evts = state.workingBundle.events.length;
  const sid = h.session_id ? String(h.session_id).slice(0, 12) + "…" : "no session_id";
  const agent = `${h.agent?.name ?? "?"}@${h.agent?.version ?? "?"}`;
  const model = h.models?.[0]?.model_id ?? "?";
  el.hdrMeta.replaceChildren();
  el.hdrMeta.append(
    badge(`sid ${sid}`),
    badge(`${evts} events`),
    badge(`agent ${agent}`),
    badge(`model ${model}`),
  );
}

function badge(text, cls) {
  const b = document.createElement("span");
  b.className = "hdr-badge" + (cls ? " " + cls : "");
  b.textContent = text;
  return b;
}

function onSelectRow(event, index) {
  selectRow(el.timeline, index);
  renderInspector(el.inspector, event, state.workingBundle);
}

async function refreshVerdict() {
  const pem = state.publicKeyPem.trim();
  if (!pem) {
    setVerdict("pending", "no public key — paste one below to verify");
    return;
  }
  const result = await verifyBundleInBrowser(state.workingBundle, pem);
  if (result.ok) {
    setVerdict("ok", `signature valid · ${result.trustLevel}`);
  } else {
    setVerdict("tampered", `verify failed: ${result.reason}${
      typeof result.failedSeq === "number" ? ` (seq ${result.failedSeq})` : ""
    }`);
  }
}

function setVerdict(cls, text) {
  el.verdictState.className = "verdict-state " + cls;
  el.verdictState.textContent = text;
}

// ── tamper / reset ────────────────────────────────────────────

el.btnTamper.addEventListener("click", async () => {
  if (state.isTampered) return;
  const pem = state.publicKeyPem.trim();
  if (!pem) {
    showError("paste the public key below before tampering — verify needs it");
    return;
  }
  try {
    const { tamperedSeq, verify, caption } = await runTamperCycle({
      workingBundle: state.workingBundle,
      publicKeyPem: pem,
    });
    state.isTampered = true;
    applyTamperVisual(el.timeline, tamperedSeq, verify.failedSeq ?? null);
    setVerdict("tampered", `verify failed: ${verify.reason}`);
    showCaption(caption);
    el.btnReset.disabled = false;
    el.btnTamper.disabled = true;
    // Re-render inspector on the tampered event so an auditor sees the
    // new (mutated) payload_hash without having to click.
    selectRow(el.timeline, tamperedSeq);
    renderInspector(el.inspector, state.workingBundle.events[tamperedSeq], state.workingBundle);
  } catch (err) {
    showError(`tamper failed: ${err.message}`);
  }
});

el.btnReset.addEventListener("click", async () => {
  state.workingBundle = clonePristine(state.pristineRef);
  state.isTampered = false;
  await renderAll();
});

el.pubKey.addEventListener("input", async () => {
  state.publicKeyPem = el.pubKey.value.trim();
  if (state.workingBundle) {
    await refreshVerdict();
    el.btnTamper.disabled = !state.publicKeyPem || state.isTampered;
  }
});

// ── caption / errors ─────────────────────────────────────────

function showCaption({ seq, reason, impact }) {
  el.caption.hidden = false;
  el.caption.replaceChildren();
  appendKV(el.caption, "seq",    seq === null || seq === undefined ? "—" : String(seq));
  appendKV(el.caption, "reason", reason);
  appendKV(el.caption, "impact", impact, true);
}

function hideCaption() {
  el.caption.hidden = true;
  el.caption.replaceChildren();
}

function appendKV(host, key, val, isImpact) {
  const k = document.createElement("div");
  k.className = "caption-key";
  k.textContent = key;
  const v = document.createElement("div");
  v.className = "caption-val" + (isImpact ? " impact" : "");
  v.textContent = val;
  host.append(k, v);
}

function showError(msg) {
  el.caption.hidden = false;
  el.caption.replaceChildren();
  appendKV(el.caption, "error", msg);
}
