// apps/shadow-lens/web/spatial-agent/client-actions.mjs
// §6 — Closed client-side action allowlist. The model may request ONLY these actions; the
// browser is what actually performs the visual action. Before execution we validate the
// action name, its argument schema, and that any referenced object/source/node exists in the
// REAL scene graph. Arbitrary JS / DOM selectors / URLs / file or shell ops are rejected.
import { sceneHasObject } from "./scene-graph.mjs";

const MODES = ["document", "source", "risk", "review", "audit"];

// name → required arg schema (validated below). Modes take no id; focus/highlight take an id.
// The full visible client action set (shared by the endpoint + the web/Unity clients).
export const CLIENT_ACTIONS = {
  select_object: { id: "object_id" },
  focus_object: { id: "object_id" },
  highlight_source: { id: "source_id" },
  highlight_claim: { id: "claim_id" },
  highlight_metric: { id: "object_id" },
  move_camera_to_object: { id: "object_id" },
  open_document_mode: {},
  open_source_mode: {},
  open_risk_mode: {},
  open_review_mode: {},
  open_audit_mode: {},
  open_experiment_mode: {},
  open_code_replay_mode: {},
  show_tamper_diff: {},
  show_verification_failure: {},
  start_audit_walkthrough: {},
  start_experiment_walkthrough: {},
  start_code_walkthrough: {},
  return_to_workspace: {},
  clear_selection: {},
};

/**
 * Validate a single requested action against the allowlist + scene. Returns
 * {ok, action?} or {ok:false, error}. NEVER mutates anything (the browser performs the action).
 */
export function validateAction(action, scene) {
  if (!action || typeof action.name !== "string") return { ok: false, code: "unknown_action", error: "action.name required" };
  const spec = CLIENT_ACTIONS[action.name];
  if (!spec) return { ok: false, code: "unknown_action", error: `unknown action "${action.name}"` };

  const args = action.args ?? {};
  // reject anything that isn't in the tiny declared arg set (no arbitrary props smuggling in)
  const allowedArgKeys = spec.id ? [spec.id] : [];
  const extra = Object.keys(args).filter((k) => !allowedArgKeys.includes(k));
  if (extra.length) return { ok: false, code: "bad_args", error: `unexpected args: ${extra.join(",")}` };

  if (spec.id) {
    const id = args[spec.id];
    if (typeof id !== "string" || !id) return { ok: false, code: "bad_args", error: `${action.name}: ${spec.id} required` };
    // referenced object must exist in the real scene graph (no invented ids)
    if (!sceneHasObject(scene, id)) return { ok: false, code: "target_not_found", error: `${action.name}: "${id}" not in the scene` };
    return { ok: true, code: "ok", action: { name: action.name, args: { [spec.id]: id } } };
  }
  return { ok: true, code: "ok", action: { name: action.name, args: {} } };
}

/** Validate a list; returns only the valid actions + the rejected ones with reasons. */
export function validateActions(actions, scene) {
  const valid = [], rejected = [];
  for (const a of actions ?? []) {
    const r = validateAction(a, scene);
    if (r.ok) valid.push(r.action); else rejected.push({ requested: a?.name, error: r.error });
  }
  return { valid, rejected };
}

export { MODES };
