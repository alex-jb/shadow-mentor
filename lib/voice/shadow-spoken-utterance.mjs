// Shadow spoken-utterance contract: validation + text normalization, treating all strings as
// UNTRUSTED. The canonical utterance carries no SSML and no executable markup; provider adapters
// render SSML from validated segments. Pure + deterministic (no Date.now/Math.random).
export const SPOKEN_CONTRACT_VERSION = "shadow-spoken-utterance-v1";

export const LOCALES = Object.freeze(["en-US", "zh-CN"]);
export const ROLES = Object.freeze(["SYSTEM_NARRATOR", "EVIDENCE_READER", "PERSPECTIVE", "SAFETY", "HELP"]);
export const SEGMENT_ROLES = Object.freeze(["result", "source", "limitation", "detail", "label", "quote", "prompt", "warning"]);
export const PROSODY_PROFILES = Object.freeze(["SYSTEM_NEUTRAL", "EVIDENCE_READER", "VERIFICATION_SUCCESS", "VERIFICATION_FAILURE", "LIMITATION", "PERSPECTIVE", "ACCESSIBILITY_CLEAR"]);
export const PRIORITIES = Object.freeze(["P0", "P1", "P2", "P3", "P4"]);

// Forbidden default filler (EN + zh) the planner must not emit unless the literal content requires it.
export const FORBIDDEN_FILLER = Object.freeze([
  "certainly", "absolutely", "based on the information provided", "based on my comprehensive analysis",
  "as an ai", "i am pleased to inform you", "it is important to note that", "in conclusion",
  "according to my expertise", "i strongly believe",
  "根据当前所提供的信息", "综合分析", "根据我的专业", "值得注意的是", "综上所述",
]);

const CAPS = { segments: 24, textLen: 400, queue: 64, bytes: 65536, depth: 8 };
const PROTO_KEYS = new Set(["__proto__", "prototype", "constructor"]);
// Executable / markup payloads rejected anywhere in spoken text.
const EXEC = [/<\s*speak/i, /<\s*[a-z]+[^>]*>/i, /<\s*\/\s*[a-z]+\s*>/i, /&[a-z]+;/i, /javascript\s*:/i, /\bon\w+\s*=/i, /\$\{/, /`/];

class UtteranceError extends Error {}
const fail = (m) => { throw new UtteranceError(m); };

function walkSafe(v, depth = 0) {
  if (depth > CAPS.depth) fail("depth cap");
  if (typeof v === "string") { if (v.length > 2000) fail("string too long"); return; }
  if (Array.isArray(v)) { v.forEach((x) => walkSafe(x, depth + 1)); return; }
  if (v && typeof v === "object") for (const k of Object.keys(v)) { if (PROTO_KEYS.has(k)) fail(`proto key ${k}`); walkSafe(v[k], depth + 1); }
}

// Rejects executable markup / SSML injection in a spoken string.
export function assertPlainSpeech(text) {
  const s = String(text ?? "");
  for (const re of EXEC) if (re.test(s)) fail(`executable/markup rejected in spoken text: ${re}`);
  return s;
}

export function validateUtterance(u) {
  if (!u || typeof u !== "object" || Array.isArray(u)) fail("utterance must be an object");
  walkSafe(u);
  if (u.contract_version !== SPOKEN_CONTRACT_VERSION) fail("bad contract_version");
  if (!/^[a-z0-9][a-z0-9:_-]{0,63}$/.test(u.utterance_id || "")) fail("bad utterance_id");
  if (!LOCALES.includes(u.locale)) fail(`bad locale ${u.locale}`);
  if (!ROLES.includes(u.role)) fail(`bad role ${u.role}`);
  if (!/^[A-Z][A-Z0-9_]{1,47}$/.test(u.intent || "")) fail("bad intent");
  if (!PROSODY_PROFILES.includes(u.prosody_profile)) fail("bad prosody_profile");
  if (!PRIORITIES.includes(u.priority)) fail("bad priority");
  if (typeof u.confirmation_required !== "boolean") fail("confirmation_required must be bool");
  if (!["FIXTURE", "LIVE", "DEVICE"].includes(u.fixture_live_device_status)) fail("bad fixture_live_device_status");
  if (!Array.isArray(u.spoken_segments) || u.spoken_segments.length < 1) fail("spoken_segments required");
  if (u.spoken_segments.length > CAPS.segments) fail("too many segments");
  const segIds = new Set();
  for (const s of u.spoken_segments) {
    if (!/^[a-z0-9][a-z0-9:_-]{0,63}$/.test(s.segment_id || "")) fail("bad segment_id");
    if (segIds.has(s.segment_id)) fail(`dup segment_id ${s.segment_id}`);
    segIds.add(s.segment_id);
    if (typeof s.text !== "string" || s.text.length < 1 || s.text.length > CAPS.textLen) fail(`bad segment text ${s.segment_id}`);
    assertPlainSpeech(s.text);
    if (!SEGMENT_ROLES.includes(s.semantic_role)) fail(`bad semantic_role ${s.semantic_role}`);
  }
  return true;
}

// ── text normalization (do not read UI/Markdown/URLs/underscores/full hashes/tables) ──
const MD = [
  [/```[\s\S]*?```/g, " "], [/`([^`]*)`/g, "$1"], [/^\s{0,3}#{1,6}\s+/gm, ""],
  [/\*\*([^*]+)\*\*/g, "$1"], [/\*([^*]+)\*/g, "$1"], [/_([^_]+)_/g, "$1"],
  [/^\s*[-*+]\s+/gm, ""], [/^\s*\|.*\|\s*$/gm, " "], [/\[([^\]]+)\]\([^)]*\)/g, "$1"],
];
const HASH_RE = /\b[0-9a-f]{16,}\b/gi;
const URL_RE = /https?:\/\/\S+/gi;

export function normalizeSpokenText(text, locale = "en-US") {
  let s = String(text ?? "");
  for (const [re, rep] of MD) s = s.replace(re, rep);
  s = s.replace(URL_RE, locale === "zh-CN" ? "一个链接" : "a link");
  // abbreviate long hex hashes: speak only a short prefix + say the rest is on screen
  s = s.replace(HASH_RE, (h) => (locale === "zh-CN" ? `哈希 ${h.slice(0, 4)}(完整值见屏幕)` : `hash ${h.slice(0, 4)}, shown in full on screen`));
  s = s.replace(/([A-Za-z0-9])_([A-Za-z0-9])/g, "$1 $2"); // underscores → space (not "underscore")
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// Detects forbidden default filler (used by the planner's safety guard + tests).
export function findForbiddenFiller(text) {
  const low = String(text ?? "").toLowerCase();
  return FORBIDDEN_FILLER.filter((f) => low.includes(f.toLowerCase()));
}

export const VOICE_CAPS = CAPS;
