# Audit Room sequence/time axis — visual acceptance status

**Status: NOT YET VISUALLY VALIDATED — honestly blocked, not faked.**

## Why
The sequence/time axis LOGIC is implemented and tested (`demos/replay/3d/axis-layout.js` +
`test/audit-room-annotation-axis.test.js`, 11 pure-math tests: sequence spacing, time position,
bounded gap-break, equal-timestamp tie-break, unknown-time lane, first-failure/downstream ordering).

But the axis module is **not yet wired into the live scene's card layout or in-scene tick labels**.
The current Audit Room renders sequence spacing (equal arc) with no visible AXIS MODE label, no time
ticks, and no Time-Mode toggle. So there is nothing new to capture for Time Mode, gap-break markers,
equal-timestamp distinguishability, or the unknown-time lane in the live scene yet.

Fabricating a "Time Mode" screenshot would be dishonest, so none is produced.

## What the current scene does show (sequence)
The arc IS sequence mode (equal spacing by seq); the browser-acceptance captures 01–03 show that
layout. What is missing visually: an explicit `AXIS: SEQUENCE` label, a timezone label, real time
ticks under the chain, and the Time-Mode alternative.

## Next step (to close §4 visually)
Wire `layoutAxis(events, mode)` into the scene: add an axis-mode toggle, in-scene tick labels
(session start/end + major ticks + selected timestamp + current mode + tz), and a Time-Mode card
re-layout with visible gap-break markers + an unknown-time lane. Then capture 08–15. The tested
`axis-layout.js` is the exact contract for that rendering.

## Flags
- SEQUENCE-MODE-EXPLICIT: logic ✅ / in-scene label ❌ (not visually validated)
- TIME-MODE-EXPLICIT: logic ✅ / in-scene render ❌ (not visually validated)
- AUDIT-ROOM-TIME-AXIS-VISUALLY-VALIDATED: **false** (honest)
