// demos/replay/3d/axis-layout.js
// Pure sequence/time axis layout for the Audit Room. Maps events to a 1-D parameter t ∈ [0,1] under
// an EXPLICIT mode, plus honest axis labels. The viewer must always know whether position means
// sequence order or elapsed time — scene distance is never hidden time semantics. No Three.js import.

export const AXIS_MODE = Object.freeze({ SEQUENCE: "sequence", TIME: "time" });

// SEQUENCE MODE — deterministic equal spacing by seq. Sequence number is primary.
export function sequenceLayout(events) {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  const n = sorted.length;
  return {
    mode: AXIS_MODE.SEQUENCE,
    items: sorted.map((e, i) => ({ seq: e.seq, t: n <= 1 ? 0.5 : i / (n - 1), lane: "main", break_before: false, same_time_tie: false })),
    labels: { mode: "SEQUENCE", tz: null, start: sorted[0]?.seq ?? null, end: sorted[n - 1]?.seq ?? null },
    unknown_time_count: 0,
    compressed_gaps: 0,
  };
}

export function parseTs(ts) {
  if (ts == null || ts === "") return null;
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? ms : null;
}

// TIME MODE — position reflects ts_utc. Large gaps are bounded-compressed with a visible break
// marker (no fake precision). Equal/similar timestamps stay distinguishable via a sequence tie-break
// (disclosed, not invented time). Missing timestamps fail closed into an explicit unknown-time lane.
export function timeLayout(events, { tz = "UTC", maxGapCompressionRatio = 6 } = {}) {
  const timed = [];
  const unknown = [];
  for (const e of events) {
    const ms = parseTs(e.ts_utc);
    if (ms == null) unknown.push(e); else timed.push({ ...e, _ms: ms });
  }
  timed.sort((a, b) => (a._ms - b._ms) || (a.seq - b.seq));

  // raw gaps between consecutive timed events
  const rawGaps = [];
  for (let i = 1; i < timed.length; i++) rawGaps.push(timed[i]._ms - timed[i - 1]._ms);
  const positive = rawGaps.filter((g) => g > 0).sort((a, b) => a - b);
  const median = positive.length ? positive[Math.floor(positive.length / 2)] : 1;
  const cap = Math.max(1, median * maxGapCompressionRatio); // bounded compression ceiling

  let compressed = 0;
  const effGaps = rawGaps.map((g) => {
    if (g > cap) { compressed++; return { eff: cap, broke: true }; }
    return { eff: Math.max(g, 0), broke: false };
  });

  // cumulative effective position; ties (eff 0) get a minimal disclosed nudge so they don't collapse
  const cum = [0];
  const tie = [false];
  const TIE_EPS = median * 0.15 || 1;
  for (let i = 0; i < effGaps.length; i++) {
    let step = effGaps[i].eff;
    let isTie = false;
    if (step <= 0) { step = TIE_EPS; isTie = true; } // same/near-equal timestamp, tie-broken by seq
    cum.push(cum[i] + step);
    tie.push(isTie);
  }
  const span = cum[cum.length - 1] || 1;

  const items = timed.map((e, i) => ({
    seq: e.seq,
    ts: e.ts_utc,
    t: span ? cum[i] / span : 0.5,
    lane: "main",
    break_before: i > 0 ? effGaps[i - 1].broke : false,
    same_time_tie: tie[i],
  }));
  // unknown-time lane: explicit, ordered by seq, never mixed into the timed axis
  const unknownSorted = [...unknown].sort((a, b) => a.seq - b.seq);
  const unknownItems = unknownSorted.map((e, i) => ({
    seq: e.seq, ts: null, t: unknownSorted.length <= 1 ? 0.5 : i / (unknownSorted.length - 1),
    lane: "unknown-time", break_before: false, same_time_tie: false,
  }));

  return {
    mode: AXIS_MODE.TIME,
    items,
    unknown_items: unknownItems,
    labels: {
      mode: "TIME",
      tz,
      start: timed[0]?.ts_utc ?? null,
      end: timed[timed.length - 1]?.ts_utc ?? null,
      unknown_time_lane: unknownItems.length > 0,
    },
    unknown_time_count: unknownItems.length,
    compressed_gaps: compressed,
  };
}

// Convenience: layout under a chosen mode.
export function layoutAxis(events, mode, opts = {}) {
  return mode === AXIS_MODE.TIME ? timeLayout(events, opts) : sequenceLayout(events);
}
