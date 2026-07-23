# Audit Room inspector — browser visual acceptance

**Status: VISUALLY VALIDATED in Chromium (real Three.js runtime, served locally, offline).** Answers
the correct critique that pure-math tests cannot prove occlusion / leader-line crossing.

## Method
- Served `demos/replay/3d/index.html` locally (http://127.0.0.1:8199), driven via chrome-devtools.
- Selection driven through the live scene API `window.__auditRoom.room.select(seq)`.
- 12 cards, world x from −3.24 (left) to +3.24 (right); anchor view region world x ∈ [−3, 3].

## Captures (reports/spatial-ux-v11/browser-acceptance/)
| File | Case | Result |
|---|---|---|
| 01-inspector-left-record.png | seq 2 (x=−2.15, left) | panel anchors upper-right (offset toward centre), leader line down to card boundary; panel above the row — does not cover the card |
| 02-inspector-right-record.png | seq 9 (x=+2.15, right) | panel anchors upper-left; leader line to card boundary; no occlusion |
| 03-inspector-edge-clamped.png | seq 11 (x=+3.24, far right) | panel clamped inside the view region (not off-screen); leader line to the session_end card; no occlusion |

## Verified
- **Selected record stays visible** — the panel sits above the card row in every case; it never covers
  the selected card.
- **Leader line terminates at the card boundary** and connects the correct card.
- **Left/right placement is coherent** — left cards' panels offset right, right cards' offset left,
  each clamped into the comfortable region.
- **View clamping works** — the far-right (out-of-region) card's panel is clamped inside the view.
- **No orphan leader lines** — after 5 repeated selections (0,5,11,2,11), the scene contains exactly
  ONE leader line (12 THREE.Line objects = 11 chain connectors + 1 leader), confirmed by traversal.
- **No console errors/warnings**; no external requests (served locally, offline bundle).

## Honest UX notes (not defects introduced by anchoring)
- The inspector panel + its text are small relative to the viewport — legibility at a glance is weak
  (this is the pre-existing inspector sizing, not the anchoring change). A larger panel / bigger
  inspector font is a follow-up polish item.
- Because the panel clamps toward centre, left/right offset is subtle at the arc's full width; the
  leader line remains the primary cue tying the panel to its card.
- This is a flat-mode desktop capture (`FLAT` HUD). SBS/ultrawide and XREAL hardware are NOT validated.
