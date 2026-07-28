// shadow-explainer-embed-v1 — a minimal, allowlisted postMessage contract for parent↔embedded-explainer
// control. Iframes are kept INDEPENDENT by default (no messaging needed); this validator exists so that
// IF messaging is enabled, every message is origin/source/protocol/id/type checked and nothing arbitrary
// (command strings, eval, selectors, URLs, HTML) is ever honored. Pure + host-testable; the parent page
// inlines the same logic.
export const EMBED_PROTOCOL = "shadow-explainer-embed-v1";
export const EXPLAINER_IDS = Object.freeze(["audit-chain", "reason-code", "persona-deliberation"]);
export const PARENT_TO_CHILD = Object.freeze(["READY_QUERY", "PLAY", "PAUSE", "RESTART", "SET_LOCALE", "SET_REDUCED_MOTION", "SET_SCENARIO"]);
export const CHILD_TO_PARENT = Object.freeze(["READY", "STEP_CHANGED", "SCENARIO_CHANGED", "COMPLETED", "ERROR"]);

// Validate a message BEFORE acting on it. Returns { ok, reason }.
// - event.origin must be in allowedOrigins (same-origin only)
// - event.source must be the expected window (the live iframe), when provided
// - payload must be a plain object with the exact protocol, a known explainer_id, and an allowlisted type
export function validateMessage(event, { allowedOrigins, expectedSource = null, direction = "child_to_parent" } = {}) {
  if (!event || typeof event !== "object") return { ok: false, reason: "no-event" };
  if (!Array.isArray(allowedOrigins) || !allowedOrigins.includes(event.origin)) return { ok: false, reason: "bad-origin" };
  if (expectedSource && event.source && event.source !== expectedSource) return { ok: false, reason: "bad-source" };
  const m = event.data;
  if (!m || typeof m !== "object" || Array.isArray(m)) return { ok: false, reason: "bad-payload" };
  if (m.protocol !== EMBED_PROTOCOL) return { ok: false, reason: "bad-protocol" };
  if (!EXPLAINER_IDS.includes(m.explainer_id)) return { ok: false, reason: "unknown-explainer" };
  const allowed = direction === "parent_to_child" ? PARENT_TO_CHILD : CHILD_TO_PARENT;
  if (!allowed.includes(m.message_type)) return { ok: false, reason: "type-not-allowlisted" };
  // never honor arbitrary executable content in the payload
  const raw = JSON.stringify(m.payload ?? null);
  if (/<script|javascript:|onerror=|["']?\s*eval\s*\(|new Function/i.test(raw)) return { ok: false, reason: "unsafe-payload" };
  return { ok: true, reason: "ok", message: { type: m.message_type, id: m.explainer_id, payload: m.payload ?? null } };
}
