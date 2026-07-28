// Priority playback queue + barge-in rules. Pure + deterministic (no timers here — the host drives
// tick()). Priorities P0(highest)..P4. A higher-priority utterance interrupts a lower one; an ordinary
// status update never interrupts an in-progress verbatim evidence quote; duplicates are suppressed;
// a language switch or reset clears stale utterances; the queue length is bounded.
const RANK = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
const MAX_QUEUE = 64;

export class ShadowVoiceQueue {
  constructor() { this.queue = []; this.current = null; this.dropped = 0; this.suppressed = 0; }

  // Try to enqueue. Returns { accepted, interrupted } — interrupted is the utterance that was barged.
  enqueue(u) {
    // duplicate suppression: same utterance_id already current or queued
    if ((this.current && this.current.utterance_id === u.utterance_id) || this.queue.some((q) => q.utterance_id === u.utterance_id)) {
      this.suppressed++; return { accepted: false, interrupted: null };
    }
    let interrupted = null;
    if (this.current && this.shouldInterrupt(u, this.current)) { interrupted = this.current; this.current = null; }
    this.queue.push(u);
    this.queue.sort((a, b) => RANK[a.priority] - RANK[b.priority]);
    while (this.queue.length > MAX_QUEUE) { this.queue.pop(); this.dropped++; }
    return { accepted: true, interrupted };
  }

  // Barge-in policy: a strictly higher priority interrupts; but nothing ordinary interrupts a
  // NON_INTERRUPTIBLE current OR a current whose active segment is a verbatim quote.
  shouldInterrupt(incoming, current) {
    if (current.interruptibility === "NON_INTERRUPTIBLE") return false;
    if (current._activeIsVerbatimQuote && RANK[incoming.priority] > RANK.P0) return false; // only P0 safety interrupts a quote
    return RANK[incoming.priority] < RANK[current.priority];
  }

  // Advance: if nothing is playing, take the highest-priority queued item.
  next() { if (!this.current && this.queue.length) this.current = this.queue.shift(); return this.current; }

  // User barge-in (an explicit interaction) stops the current utterance.
  userInterrupt() { const c = this.current; this.current = null; return c; }

  // Back / Cancel / Reset stop speech and clear the queue.
  stopAll() { const had = this.current || this.queue.length; this.current = null; this.queue = []; return !!had; }

  // Language switch cancels utterances of the old locale (keep only the new one).
  clearLocaleExcept(locale) {
    this.queue = this.queue.filter((u) => u.locale === locale);
    if (this.current && this.current.locale !== locale) this.current = null;
  }

  // App pause: stop current; keep nothing obsolete to replay.
  onPause() { this.current = null; }

  get length() { return this.queue.length; }
}
