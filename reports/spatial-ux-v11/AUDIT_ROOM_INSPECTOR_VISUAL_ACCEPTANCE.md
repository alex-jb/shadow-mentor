# Audit Room inspector — browser visual acceptance

**Status: NOT VISUALLY ACCEPTED. Placement math + runtime creation PASS; Flat-mode composition +
readability FAIL.** The prior version of this doc wrongly implied full visual validation — that was an
over-claim and is corrected here.

## Honest classification (from the actual 3200×1496 Chromium captures)
| Aspect | Verdict |
|---|---|
| INSPECTOR-PLACEMENT-MATH | **PASS** — left→upper-right, right→upper-left, edge clamped into view |
| INSPECTOR-RUNTIME-CREATION | **PASS** — panel + leader line created; exactly 1 leader after repeated selection (no orphans); no console errors; offline |
| INSPECTOR-READABILITY | **FAIL** — inspector text is microscopic in the full-res capture |
| SELECTED-ASSOCIATION | **FAIL** — the selected card is not visually obvious; panel↔card don't read as one group |
| LEADER-LINE-VISIBILITY | **FAIL / INCONCLUSIVE** — leader line is too faint to read against black |
| FLAT-COMPOSITION | **FAIL** — ~80% of the viewport is empty black; the rail occupies ~half width, tiny height; card text (seq/hashes) unreadable |
| FIRST-FRAME-COMPREHENSION | **FAIL** — a first-time viewer cannot tell where to look |
| TIME-AXIS | **NOT TESTED** — axis not wired into the live scene |
| SBS | **NOT TESTED** |

## BEFORE artifacts (preserved, do NOT overwrite)
- `browser-acceptance/01-inspector-left-record.png` (seq 2) — BEFORE / FAIL
- `browser-acceptance/02-inspector-right-record.png` (seq 9) — BEFORE / FAIL
- `browser-acceptance/03-inspector-edge-clamped.png` (seq 11) — BEFORE / FAIL

These stay as failure evidence. AFTER captures will use `*-AFTER.png` names and a BEFORE/AFTER
contact sheet.

## Root causes to fix (bounded Flat-mode correction — NOT a redesign)
1. **Flat camera framing** is effectively fixed/too far → the rail is small and text unreadable.
   Fix: deterministic fit-to-content so the rail fills ~70–82% width / ~25–40% height at 16:9,
   recomputed on resize; SBS/XR/ultrawide presets unchanged.
2. **Selected card has no visual weight** → add stroke + moderate scale (1.12–1.18) + a selection
   glyph + de-emphasis of others (adjacent ~0.8, distant ~0.5). Never colour alone; hover ≠ selection.
3. **Inspector too small** → 1.5–2× larger, layered (type/seq/actor/summary/status), bounded excerpt,
   readable body; still view-clamped; never covers the selected card; EN+ZH.
4. **Leader line invisible** → brighter/thicker + a distinct line style from evidence connectors;
   never implies chain direction; safe in Tracking-Lost fallback.
5. **Trust/status line detached at the bottom** → move into a compact Session/Trust header near the
   content; distinguish INTEGRITY / TRUST posture / CORRECTNESS (not one generic green "valid").
6. **First-entry hint** → one bounded "Select a record to inspect it. Press ? for controls." that
   dismisses after selection.

## Flags (corrected)
- AUDIT-ROOM-INSPECTOR-PLACEMENT-PASSED ✅
- AUDIT-ROOM-INSPECTOR-READABILITY-PASSED ❌
- AUDIT-ROOM-LEADER-LINE-VISIBLE ❌
- AUDIT-ROOM-SELECTED-ASSOCIATION-PASSED ❌
- AUDIT-ROOM-FLAT-COMPOSITION-PASSED ❌
- TRUST-STATUS-HIERARCHY-PASSED ❌
- **AUDIT-ROOM-INSPECTOR-VISUALLY-VALIDATED: false** (was wrongly true)
