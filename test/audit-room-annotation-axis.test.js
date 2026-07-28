// Pure-math guards for the Audit Room's Flow-inspired improvements: annotation anchoring with a
// leader line, and explicit sequence/time axes. No DOM/Three.js — the numbers are the contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseAnnotationSide, anchorPanel, viewRelativeFallback } from "../demos/replay/3d/annotation-anchor.js";
import { AXIS_MODE, sequenceLayout, timeLayout, parseTs, layoutAxis } from "../demos/replay/3d/axis-layout.js";

const VIEW = { minX: -3, maxX: 3, minY: -2, maxY: 2 };
const PANEL = { halfW: 0.6, halfH: 0.35 };
const mkCard = (x) => ({ x, y: 0, z: -1, halfW: 0.4, halfH: 0.26 });

test("LEFT/RIGHT placement: left cards anchor upper-right, right cards upper-left", () => {
  assert.equal(chooseAnnotationSide(-1.5, 0), "upper-right");
  assert.equal(chooseAnnotationSide(1.5, 0), "upper-left");
  assert.equal(anchorPanel({ card: mkCard(-1.5), panel: PANEL, view: VIEW }).side, "upper-right");
  assert.equal(anchorPanel({ card: mkCard(1.5), panel: PANEL, view: VIEW }).side, "upper-left");
});

test("view clamping: panel stays inside the comfortable region for edge cards", () => {
  for (const x of [-2.9, 2.9, -1, 1, 0]) {
    const r = anchorPanel({ card: mkCard(x), panel: PANEL, view: VIEW });
    assert.ok(r.position.x - PANEL.halfW >= VIEW.minX - 1e-9, `left overflow at ${x}`);
    assert.ok(r.position.x + PANEL.halfW <= VIEW.maxX + 1e-9, `right overflow at ${x}`);
    assert.ok(r.position.y - PANEL.halfH >= VIEW.minY - 1e-9, `bottom overflow at ${x}`);
    assert.ok(r.position.y + PANEL.halfH <= VIEW.maxY + 1e-9, `top overflow at ${x}`);
  }
});

test("no overlap with the selected card bounds", () => {
  for (const x of [-2.9, -1, 0, 1, 2.9]) {
    const card = mkCard(x);
    const r = anchorPanel({ card, panel: PANEL, view: VIEW });
    assert.equal(r.overlaps, false, `overlap at ${x}`);
    // panel bottom edge is above the card top edge
    assert.ok(r.position.y - PANEL.halfH >= card.y + card.halfH - 1e-9, `panel not above card at ${x}`);
  }
});

test("leader line targets the card boundary, not its center", () => {
  const card = mkCard(-1.5);
  const r = anchorPanel({ card, panel: PANEL, view: VIEW });
  // start x is on the card's side edge (card.x + halfW for a left card → panel on the right)
  assert.ok(Math.abs(r.leaderStart.x - (card.x + card.halfW)) < 1e-9);
  // leader ends on the panel edge, not its center
  assert.ok(Math.abs(r.leaderEnd.y - (r.position.y - PANEL.halfH)) < 1e-9);
});

test("Tracking Lost fallback: stable view-relative panel, no leader line", () => {
  const r = viewRelativeFallback({ panel: PANEL, view: VIEW });
  assert.equal(r.side, "view-fixed");
  assert.equal(r.leaderStart, null);
  assert.equal(r.leaderEnd, null);
  assert.ok(r.position.x + PANEL.halfW <= VIEW.maxX + 1e-9 && r.position.y + PANEL.halfH <= VIEW.maxY + 1e-9);
});

// ── axes ──
const EVENTS = [
  { seq: 1, ts_utc: "2026-01-01T00:00:00Z" },
  { seq: 2, ts_utc: "2026-01-01T00:00:10Z" },
  { seq: 3, ts_utc: "2026-01-01T00:00:20Z" },
  { seq: 4, ts_utc: "2026-01-01T02:00:00Z" }, // large gap → break marker
];

test("SEQUENCE mode: deterministic equal spacing, ordered by seq, mode is explicit", () => {
  const r = sequenceLayout([...EVENTS].reverse());
  assert.equal(r.mode, AXIS_MODE.SEQUENCE);
  assert.deepEqual(r.items.map((i) => i.seq), [1, 2, 3, 4]);
  const ts = r.items.map((i) => i.t);
  assert.deepEqual(ts, [0, 1 / 3, 2 / 3, 1]);
  assert.equal(r.labels.mode, "SEQUENCE");
});

test("TIME mode: position reflects ts, timezone explicit, big gap breaks, order preserved", () => {
  const r = timeLayout(EVENTS, { tz: "UTC" });
  assert.equal(r.mode, AXIS_MODE.TIME);
  assert.equal(r.labels.tz, "UTC");
  assert.deepEqual(r.items.map((i) => i.seq), [1, 2, 3, 4]);
  // monotonic non-decreasing t
  const t = r.items.map((i) => i.t);
  for (let i = 1; i < t.length; i++) assert.ok(t[i] >= t[i - 1] - 1e-9);
  // the 2-hour gap before seq 4 is compressed + flagged as a break
  assert.equal(r.compressed_gaps, 1);
  assert.equal(r.items[3].break_before, true);
  assert.equal(r.items[1].break_before, false);
});

test("TIME mode: equal timestamps stay distinguishable (disclosed tie), no collapse", () => {
  const eq = [
    { seq: 1, ts_utc: "2026-01-01T00:00:00Z" },
    { seq: 2, ts_utc: "2026-01-01T00:00:00Z" },
    { seq: 3, ts_utc: "2026-01-01T00:00:05Z" },
  ];
  const r = timeLayout(eq);
  assert.notEqual(r.items[0].t, r.items[1].t, "equal timestamps must not collapse to one position");
  assert.equal(r.items[1].same_time_tie, true);
  assert.equal(r.items[2].same_time_tie, false);
});

test("TIME mode: missing timestamps fail closed into an explicit unknown-time lane", () => {
  const mixed = [
    { seq: 1, ts_utc: "2026-01-01T00:00:00Z" },
    { seq: 2, ts_utc: null },
    { seq: 3, ts_utc: "" },
    { seq: 4, ts_utc: "2026-01-01T00:00:10Z" },
  ];
  const r = timeLayout(mixed);
  assert.equal(r.unknown_time_count, 2);
  assert.equal(r.labels.unknown_time_lane, true);
  assert.deepEqual(r.unknown_items.map((i) => i.seq), [2, 3]);
  for (const it of r.unknown_items) assert.equal(it.lane, "unknown-time");
  // timed items never include the unknowns
  assert.deepEqual(r.items.map((i) => i.seq), [1, 4]);
});

test("parseTs: valid ISO parses, junk/empty/missing → null (no fake precision)", () => {
  assert.equal(typeof parseTs("2026-01-01T00:00:00Z"), "number");
  assert.equal(parseTs(null), null);
  assert.equal(parseTs(""), null);
  assert.equal(parseTs("not-a-date"), null);
});

test("first-failure + downstream keep their sequence position in both modes", () => {
  // a failure at seq 3 and downstream at seq 4 must not be reordered by either layout
  for (const mode of [AXIS_MODE.SEQUENCE, AXIS_MODE.TIME]) {
    const r = layoutAxis(EVENTS, mode);
    const seqs = r.items.map((i) => i.seq);
    assert.ok(seqs.indexOf(3) < seqs.indexOf(4), `${mode}: downstream must stay after first failure`);
  }
});
