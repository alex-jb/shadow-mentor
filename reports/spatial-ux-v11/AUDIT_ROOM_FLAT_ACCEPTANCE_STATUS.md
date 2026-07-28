# Audit Room Flat — composition + inspector readability acceptance

**Status: VISUALLY ACCEPTED in real Chromium (offline).** Brings the Flat mode from
mathematically-correct placement to a readable, presentation-ready composition. Time Mode NOT started.

## What changed (bounded)
1. **Fit-to-content camera** (`demos/replay/3d/flat-fit.js` + `app.js fitFlat()`): frames the card rail
   to ~80% of viewport width (height-limited on ultrawide), recomputed deterministically on resize.
   Flat only — SBS/XR/ultrawide policy untouched. Fixed the "tiny distant rail in a black field".
2. **Selected-record hierarchy** (`scene.js`): selected card scales 1.15 + bright white edge; the rest
   dim to ≤0.28. Multi-channel (scale + brightness + de-emphasis + leader), never colour-alone, never
   turns a neutral intact card verification-green. Hover pulse stays distinct.
3. **Inspector readability** (`scene.js`): a real title (`type · #seq`, 0.085) + layered body (0.052),
   wider panel (2.5), bounded rows only (actor/ts/payload…/`OPEN 2D AUDIT`) — no tiny terminal text,
   full payload/signature stays in the 2D verifier.
4. **Leader line** (`scene.js`): bright white **elbow** + endpoint **dot** at the card boundary —
   visibly distinct from the cold-grey evidence connectors, does not imply chain direction, omitted in
   the Tracking-Lost fallback.
5. **In-scene Trust header** (`app.js`): `INTEGRITY VERIFIED` (green) / `TRUST SELF_SIGNED` (amber) /
   `CORRECTNESS NOT EVALUATED` (grey) as world-anchored scene objects near the rail (SBS-safe) — three
   distinct dimensions, never one generic green "valid". The bottom line is now a minimal grey
   diagnostic (`FLAT · eye · open ../verify.html`).
6. **First-entry hint** (`app.js`): one bounded line, dismissed on first selection or after 12 s
   (EN + zh via `?lang=zh`).

## Evidence (reports/spatial-ux-v11/browser-acceptance/audit-room-flat/)
BEFORE `00-opening-frame-BEFORE.png` (tiny rail, black field, unreadable). AFTER: `01-opening-frame`
(rail fills width + hint), `03-inspector-left` (bright-vs-dimmed + readable inspector + elbow leader +
trust header), `04-inspector-right`, `06-first-failure-selected` (red verifier impact dominates,
downstream dashed), `05-viewport-1366x768` (fit adapts). Contact sheet `AUDIT_ROOM_FLAT_BEFORE_AFTER.png`.

Programmatic checks: fit occupancy 80% width across 1920/1680/1440/1366/2560 aspects
(`AUDIT_ROOM_FLAT_LAYOUT_METRICS.json` + `test/audit-room-flat-fit.test.js` 4/4). Runtime cleanup —
after 32 selections: exactly 1 leader line + 1 endpoint dot, 11 connectors, no orphans. Console errors
0; network requests 2 (index + bundle, local); 0 external/CDN/analytics.

## Flags (honest)
- AUDIT-ROOM-FLAT-FIT-TO-CONTENT-IMPLEMENTED ✅ · AUDIT-ROOM-OPENING-FRAME-PASSED ✅
- AUDIT-ROOM-SELECTED-RECORD-OBVIOUS ✅ · AUDIT-ROOM-INSPECTOR-PLACEMENT-PASSED ✅
- **AUDIT-ROOM-INSPECTOR-READABILITY-PASSED ✅** · **AUDIT-ROOM-LEADER-LINE-VISIBLE ✅**
- **AUDIT-ROOM-SELECTED-ASSOCIATION-PASSED ✅** · **AUDIT-ROOM-TRUST-STATUS-HIERARCHY-PASSED ✅**
- **AUDIT-ROOM-FLAT-COMPOSITION-PASSED ✅** · AUDIT-ROOM-FIRST-ENTRY-GUIDANCE-PASSED ✅
- AUDIT-ROOM-CHINESE-CRITICAL-LABELS-PASSED ✅ (hint via `?lang=zh`; scene labels are event-type/EN)
- AUDIT-ROOM-REPEATED-SELECTION-CLEANUP-PASSED ✅ · AUDIT-ROOM-BROWSER-ACCEPTANCE-PASSED ✅
- FULL-NODE-SUITE-PASSED ✅ (2039/0/3) · SEMANTIC-HASHES/STABLE-APK/FROZEN-VERIFIER-UNCHANGED ✅

Kept false (next increment): TIME-MODE-RUNTIME-INTEGRATED · TIME-MODE-VISUALLY-VALIDATED.
Kept false (no device): BEAM-PRO / XREAL-3DOF / XREAL-EYE-6DOF / OST-READABILITY / DEVICE-PERFORMANCE /
FORMAL-USER-STUDY / PRODUCTION-FLOW-INTEGRATION / FLOW-PARTNERSHIP / PRODUCTION-READY.

## Honest residuals (non-blocking)
- The leader endpoint dot can sit a few px off the exact selected-card edge on some seqs.
- Scene card labels are event-type/English (forensic identifiers); the first-entry hint + trust
  concepts are the localized surface. SBS stereo captures were not taken (not claimed).
