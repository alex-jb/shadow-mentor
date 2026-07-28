# Audit Room Flat composition

The Flat scene now uses deterministic fit-to-content instead of a fixed camera. `flat-fit.js`
computes the camera distance so the card rail fills a target fraction of the viewport (width AND
height constrained), recomputed on resize; `app.js fitFlat()` applies it from the live card bounds.
Flat only — SBS/XR/ultrawide camera policy is untouched (guarded by `preset === "xreal"` / XR checks).

Composition layers (top→bottom): first-entry hint · inspector (on selection) · card rail (fills
~80% width) · in-scene Trust header (INTEGRITY / TRUST / CORRECTNESS) · minimal grey diagnostic line.
Selected record is emphasised (scale + bright edge) while the rest dim; the leader elbow + dot ties
the inspector to its card. First failure (red verifier impact + dashed downstream) outranks selection.

Metrics: `AUDIT_ROOM_FLAT_LAYOUT_METRICS.json` (80% width across 5 target aspects) + browser-confirmed
at 1920×748 and 1366×748. Tests: `test/audit-room-flat-fit.test.js` (4). Acceptance +
BEFORE/AFTER evidence: AUDIT_ROOM_FLAT_ACCEPTANCE_STATUS.md.
