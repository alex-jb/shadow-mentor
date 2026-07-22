// Safe voice-command router. A recognized phrase maps to a CLOSED action set (no LLM in the routing
// path). Navigation is allowed directly; regulated/destructive actions enter ACTION_PENDING and wait
// for an explicit NON-VOICE confirmation. A recognized phrase is never authorization. Pure + deterministic.
export const VOICE_ACTIONS = Object.freeze([
  "NEXT", "PREVIOUS", "PLAY", "PAUSE", "OPEN_DETAILS", "CLOSE_DETAILS", "SELECT_PROFILE",
  "REQUEST_SOURCE", "REQUEST_QUOTE", "REQUEST_RESET", "REQUEST_RECENTER", "SWITCH_LANGUAGE",
]);

// Actions voice may NEVER perform alone (require explicit non-voice confirmation) — listed so a test
// can assert none of them are directly routable.
export const VOICE_FORBIDDEN = Object.freeze([
  "APPROVE_DECISION", "CONFIRM_REGULATED", "SIGN_BUNDLE", "DELETE_EVIDENCE", "GRANT_PERMISSION",
  "RETAIN_CAMERA_FRAME", "ACCEPT_OCR_CORRECTION", "CONFIRM_TAMPER",
]);

// Navigation actions that dispatch immediately.
const DIRECT = new Set(["NEXT", "PREVIOUS", "PLAY", "PAUSE", "OPEN_DETAILS", "CLOSE_DETAILS", "SELECT_PROFILE", "REQUEST_SOURCE", "REQUEST_QUOTE", "SWITCH_LANGUAGE"]);
// Actions that must arm a pending confirmation rather than dispatch.
const NEEDS_CONFIRM = new Set(["REQUEST_RESET"]);

const PHRASES = [
  [/\b(next|forward|continue|下一步|继续)\b/i, "NEXT"],
  [/\b(back|previous|上一步|返回)\b/i, "PREVIOUS"],
  [/\b(play|resume|播放)\b/i, "PLAY"],
  [/\b(pause|stop speaking|暂停)\b/i, "PAUSE"],
  [/\b(details?|详细|详情|展开)\b/i, "OPEN_DETAILS"],
  [/\b(close|collapse|收起)\b/i, "CLOSE_DETAILS"],
  [/\b(profile|persona|视角|角色)\b/i, "SELECT_PROFILE"],
  [/\b(source|来源|依据)\b/i, "REQUEST_SOURCE"],
  [/\b(quote|原文|引用)\b/i, "REQUEST_QUOTE"],
  [/\b(reset|重置|重来|返回银行)\b/i, "REQUEST_RESET"],
  [/\b(recenter|re-center|重新居中)\b/i, "REQUEST_RECENTER"],
  [/\b(language|中文|english|切换语言)\b/i, "SWITCH_LANGUAGE"],
];

export class ShadowVoiceRouter {
  constructor() { this.pending = null; }

  // Returns { action, dispatched, state, requiresConfirmation }.
  route(phrase) {
    const text = String(phrase ?? "");
    let action = null;
    for (const [re, a] of PHRASES) if (re.test(text)) { action = a; break; }
    if (!action) return { action: null, dispatched: false, state: this.pending ? "ACTION_PENDING" : "IDLE", requiresConfirmation: false };
    if (action === "REQUEST_RECENTER") return { action, dispatched: true, state: "IDLE", requiresConfirmation: false }; // safe reorientation
    if (NEEDS_CONFIRM.has(action)) { this.pending = action; return { action, dispatched: false, state: "ACTION_PENDING", requiresConfirmation: true }; }
    if (DIRECT.has(action)) return { action, dispatched: true, state: this.pending ? "ACTION_PENDING" : "IDLE", requiresConfirmation: false };
    return { action: null, dispatched: false, state: "IDLE", requiresConfirmation: false };
  }

  // Explicit NON-VOICE confirmation resolves a pending action. Voice can never call this path.
  confirmByNonVoice() { const a = this.pending; this.pending = null; return a; }
  cancelPending() { this.pending = null; }

  // A voice phrase can NEVER authorize a forbidden action — always false.
  static canVoiceAuthorize(/* action */) { return false; }
}
