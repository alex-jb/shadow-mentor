// bundle-loader.js
// ─────────────────────────────────────────────────────────────────────────────
// "Load your own signed bundle into the 3D room." Turns the demo from a movie
// into a tool: an auditor drops (or picks) a real attest-core evidence bundle
// and the room re-renders their chain through the SAME verifier the canned demo
// uses. Zero network — parse is local, verification is the room's own path.
//
// Design (lowest-risk, reuses the entire verified boot path):
//   drop/pick → parse+validate JSON → sessionStorage → location.reload()
//   → on boot, loadedBundle() returns it → createAuditRoom({ C, bundle }).
// A reload gives a clean state machine every time; no partial teardown of the
// live scene, so loading a bundle can never leave the room half-rebuilt.
//
// Honesty: a file that is not a plausible attest-core bundle is REJECTED with a
// visible reason and the scene is left UNCHANGED — never a silent swap, never a
// guess. Same anti-silent-failure stance as the command layer.

const STORAGE_KEY = "shadow-audit-room:loaded-bundle";

/** Returns the operator-loaded bundle for this session, or null for the demo. */
export function loadedBundle() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** True when the room is showing an operator-loaded bundle (not the demo). */
export function isLoaded() {
  return loadedBundle() != null;
}

/** Clear the loaded bundle and return to the canned demo on next load. */
export function clearLoaded() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Structural validation — is this shaped like an attest-core evidence bundle?
 * We check shape only; cryptographic verification happens in the room
 * (verifyWorking), which honestly reports SELF_SIGNED / tampered / wrong-key.
 * Returns { ok:true } or { ok:false, reason } — never throws.
 */
export function validateBundle(obj) {
  if (!obj || typeof obj !== "object") return { ok: false, reason: "not a JSON object" };
  if (!obj.header || typeof obj.header !== "object") return { ok: false, reason: "missing header{}" };
  if (!Array.isArray(obj.events)) return { ok: false, reason: "missing events[]" };
  if (obj.events.length === 0) return { ok: false, reason: "events[] is empty" };
  if (!Array.isArray(obj.signatures) || obj.signatures.length === 0)
    return { ok: false, reason: "missing signatures[] — an unsigned bundle cannot be attested" };
  // batch_root is optional on older single-signature bundles; don't require it.
  for (const e of obj.events) {
    if (typeof e.seq !== "number") return { ok: false, reason: "an event is missing a numeric seq" };
  }
  return { ok: true };
}

/**
 * Wire a drop target + file input. onError(message) surfaces rejections in the
 * existing splash/fatal UI. onLoaded() runs just before reload (e.g. to persist
 * stereo settings). Everything is local; no fetch anywhere.
 */
export function initBundleLoader({ dropEl, inputEl, onError = () => {}, onLoaded = () => {} } = {}) {
  async function handleFile(file) {
    let text;
    try {
      text = await file.text();
    } catch (err) {
      onError(`could not read file: ${err?.message ?? err}`);
      return;
    }
    let obj;
    try {
      obj = JSON.parse(text);
    } catch (err) {
      onError(`not valid JSON — nothing changed (${err?.message ?? err})`);
      return;
    }
    const v = validateBundle(obj);
    if (!v.ok) {
      onError(`not an evidence bundle: ${v.reason} — nothing changed`);
      return;
    }
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (err) {
      onError(`could not stash bundle (storage full?): ${err?.message ?? err}`);
      return;
    }
    onLoaded();
    location.reload();
  }

  if (dropEl) {
    dropEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropEl.classList.add("drag-over");
    });
    dropEl.addEventListener("dragleave", () => dropEl.classList.remove("drag-over"));
    dropEl.addEventListener("drop", (e) => {
      e.preventDefault();
      dropEl.classList.remove("drag-over");
      const file = e.dataTransfer?.files?.[0];
      if (file) void handleFile(file);
    });
  }
  if (inputEl) {
    inputEl.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
    });
  }
  // Whole-window drag-drop so the operator can drop anywhere over the scene.
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) void handleFile(file);
  });

  return { handleFile };
}
