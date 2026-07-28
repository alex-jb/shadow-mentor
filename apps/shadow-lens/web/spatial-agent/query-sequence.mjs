// apps/shadow-lens/web/spatial-agent/query-sequence.mjs
// §1 — durable, session-scoped query identity `<session_id>:q<sequence>`. The authority for the
// next sequence is the set of EXISTING query_ids for that session (recovered from execution/
// evidence events or persisted session state) — NOT a process-global counter. So after profile
// reconstruction / domain reload / app restart / session reload, the sequence continues rather
// than reusing q1.

export function parseSeq(sessionId, id) {
  if (typeof id !== "string" || !sessionId) return 0;
  const prefix = sessionId + ":q";
  if (!id.startsWith(prefix)) return 0;
  const n = parseInt(id.slice(prefix.length), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// The next id, given the existing ids for this session (the recovery authority).
export function nextQueryId(sessionId, existingIds = []) {
  let max = 0;
  for (const id of existingIds) { const s = parseSeq(sessionId, id); if (s > max) max = s; }
  return `${sessionId}:q${max + 1}`;
}

// Store of issued query_ids per session. hydrate() rebuilds it from persisted execution events
// on rehydration; issue() always continues from the max seen (never reuses within a session).
export class QuerySequenceStore {
  constructor(persisted = null) { this._issued = persisted && typeof persisted === "object" ? persisted : {}; }
  hydrate(sessionId, ids = []) { const cur = this._issued[sessionId] ?? (this._issued[sessionId] = []); for (const id of ids) if (parseSeq(sessionId, id) > 0) cur.push(id); }
  issue(sessionId) { const ids = this._issued[sessionId] ?? (this._issued[sessionId] = []); const id = nextQueryId(sessionId, ids); ids.push(id); return id; }
  known(sessionId) { return [...(this._issued[sessionId] ?? [])]; }
  toJSON() { return this._issued; } // persist to storage; feed back to the constructor to recover
}
