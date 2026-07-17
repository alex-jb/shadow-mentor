// demos/replay/3d/voice.js
// ─────────────────────────────────────────────────────────────────
// The Jarvis layer — voice (Phase 4.1). Voice is the "how is this
// possible" moment; discipline is what keeps it from being a toy.
//
//   • Push-to-talk only (held key / gamepad trigger) — NEVER always-on.
//   • transcript → parseIntent → a CLOSED enumerated command set. The
//     parser may only ever emit one of the enum verbs; anything it can't
//     confidently map becomes UNKNOWN, which the UI answers with a polite
//     "didn't catch that" and NO improvised action.
//   • Every voice verb has a keyboard equivalent, and the keyboard is
//     authoritative (that mapping lives in app.js). If the mic dies on
//     stage, the demo proceeds identically.
//   • If SpeechRecognition is unavailable, the mic indicator shows
//     disabled and nothing else changes.
//
// parseIntent is exported standalone so it can be unit-tested in Node with
// no browser (test/replay-3d-voice-intent.test.js).
// ─────────────────────────────────────────────────────────────────

export const INTENTS = Object.freeze([
  "FOCUS_EVENT", "FILTER_BY_TYPE", "APPLY_LENS", "CLEAR_LENS", "GOTO_BEAT",
  "TRIGGER_TAMPER", "RESET", "SHOW_TRUST_LEVELS", "EXPLAIN_EVENT", "UNKNOWN",
]);

const NUM_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

function firstNumber(s) {
  const digit = s.match(/\b(\d{1,2})\b/);
  if (digit) return parseInt(digit[1], 10);
  for (const [w, n] of Object.entries(NUM_WORDS)) {
    if (new RegExp(`\\b${w}\\b`).test(s)) return n;
  }
  return null;
}

// The ONLY place free-form speech becomes a bounded command. Deterministic,
// offline, no model required. Returns {intent, ...args} where intent ∈ INTENTS.
export function parseIntent(transcript) {
  const s = String(transcript || "").toLowerCase().trim();
  if (!s) return { intent: "UNKNOWN", transcript };

  // order matters: most specific first
  if (/\b(reset|heal|restore|undo)\b/.test(s)) return { intent: "RESET", transcript };
  if (/\b(tamper|break the chain|forge|falsif|mutate|alter)\b/.test(s)) return { intent: "TRIGGER_TAMPER", transcript };
  if (/\b(clear|remove|drop|no)\b.*\blens\b/.test(s) || /\bclear lens\b/.test(s)) return { intent: "CLEAR_LENS", transcript };
  if (/\btrust\b|\bsigned\b|\banchor/.test(s)) return { intent: "SHOW_TRUST_LEVELS", transcript };

  const lens = s.match(/\b(security|compliance|quality)\b/);
  if (lens && /\blens|highlight|review|show me\b/.test(s) && !/\bexplain|focus\b/.test(s)) {
    return { intent: "APPLY_LENS", lens: lens[1], transcript };
  }

  if (/\bbeat\b/.test(s)) {
    const n = firstNumber(s);
    if (n != null) return { intent: "GOTO_BEAT", n, transcript };
  }

  if (/\bexplain|what (is|happened)|describe\b/.test(s)) {
    const seq = firstNumber(s);
    if (seq != null) return { intent: "EXPLAIN_EVENT", seq, transcript };
  }

  if (/\bfocus|go to|jump to|select|show me event\b/.test(s)) {
    const seq = firstNumber(s);
    if (seq != null) return { intent: "FOCUS_EVENT", seq, transcript };
  }

  // "show me every shell command", "filter to bash", "just the reads"
  if (/\bshell|command|bash\b/.test(s)) return { intent: "FILTER_BY_TYPE", query: "shell", transcript };
  if (/\bevery|all the|filter|only|just the\b/.test(s)) {
    const q = s.match(/\b(read|edit|write|grep|bash|prompt|tool_call|tool_result|tool call|tool result)\b/);
    if (q) return { intent: "FILTER_BY_TYPE", query: q[1].replace(" ", "_"), transcript };
  }
  if (lens) return { intent: "APPLY_LENS", lens: lens[1], transcript };

  return { intent: "UNKNOWN", transcript };
}

// Browser controller. Push-to-talk: app calls start() on key-down, stop()
// on key-up. Emits state so the app can show/hide the in-scene mic dot.
export function createVoice({ onIntent, onState, llmParse = null } = {}) {
  const SR = typeof window !== "undefined"
    ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const available = !!SR;
  let rec = null;
  let listening = false;
  let killed = false;

  function state(extra) { onState?.({ available, listening, killed, ...extra }); }

  if (available) {
    rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.onresult = async (e) => {
      const transcript = e.results[e.results.length - 1][0].transcript;
      let result = parseIntent(transcript);
      // Optional LLM refinement — but its output is VALIDATED against the
      // enum; a non-conforming answer degrades to the local match, never to
      // free-form control.
      if (result.intent === "UNKNOWN" && llmParse) {
        try {
          const llm = await llmParse(transcript);
          if (llm && INTENTS.includes(llm.intent) && llm.intent !== "UNKNOWN") result = { ...llm, transcript };
        } catch { /* ignore — keep UNKNOWN */ }
      }
      onIntent?.(result);
    };
    rec.onend = () => { listening = false; state({ transcript: null }); };
    rec.onerror = () => { listening = false; state({ error: true }); };
  }

  function start() {
    if (!available || killed || listening) return;
    try { rec.start(); listening = true; state(); } catch { /* already started */ }
  }
  function stop() {
    if (!available || !listening) return;
    try { rec.stop(); } catch {}
    listening = false; state();
  }
  function kill() { killed = true; stop(); state(); }
  function revive() { killed = false; state(); }

  state();
  return { available, start, stop, kill, revive, get listening() { return listening; } };
}
