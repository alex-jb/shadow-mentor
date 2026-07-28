# Current-tree finding matrix (report @ 57e175c → V11 @ 34fe8aa)

Full data in `CURRENT_TREE_FINDING_MATRIX.csv`. Classifications per the task spec:
CONFIRMED_CURRENT · ALREADY_FIXED · PARTIALLY_FIXED · OBSOLETE_BY_ARCHITECTURE · VALID_BUT_DEFERRED ·
CANNOT_CONFIRM · REPORT_INCORRECT.

## Fixed this pass (CONFIRMED_CURRENT → resolved, with tests)
| # | Finding | Current loc | Fix | Evidence |
|---|---|---|---|---|
| P0-1 | `attest_core` hardcoded `2.0.0` (pkg now **2.3.0**) | `packages/attest-core/session.js:70` | derive from `package.json` (single source) + contract test | `test/attest-core-metadata-version.test.js` PASS; new bundles stamp `2.3.0`; 23 attest tests green |
| P0-2 | per-frame `Vector3` allocation (~48/frame) | `scene.js:427,432` | module scratch `_camPos`/`_cardPos`; 0 per-frame alloc | behavior-identical; bundle rebuilt |
| P0-3 | hit proxy rendered (draw cost, ×2 SBS) | `scene.js:106-113` | `hit.visible=false` (Raycaster ignores `.visible`) | `test/audit-room-hit-proxy-raycast.test.js` PASS (selection identical on r160) |
| P1-5 | untrusted `innerHTML` of LLM `/api/ambient-turn` | `demo/xreal.html:276,303` | `createElement` + `textContent` | browser-verified: `pwned=0`, `<img/script/svg>` render as literal text |

## Confirmed-current but DEFERRED (evidence-backed, scheduled — not done this pass)
- **P1-3 CORS `*`** (10 `api/` endpoints) — documented allowlist requirement; not blindly changed (callers
  unknown). → `../spatial-ux-v11/` API security note.
- **P0-4 SBS squeeze vs frame-packed** — cannot resolve without Beam Pro → device-day matrix.
- **Ambient Council layout** (badge overlap / ellipsis / wide-screen) — this pass fixed only the innerHTML
  security; layout → §14 next increment.
- **flat-mode framing + tiny `#seq`** — §13F next increment.
- **edge-merge / instancing** — `PERFORMANCE_DECISION_MATRIX` (needs 40-60 event fixture + measured Δ).
- **anchors.js ASN.1 fuzz + allowlist** — separate bounded security task.

## PARTIALLY_FIXED
- **XR OST + CJK** — `XREAL_OST_BRIGHT` profile already implemented in V11; CJK wrapping still untested and
  the guided-story surface still fails bright-bg (open P0 design item, tracked in V11 OST review).
- **npm publish lag** — package now declares `2.3.0`; publishing is forbidden this phase (external Alex
  action).

## Not defects (report confirmations)
Zero-LLM-dep attest-core, crash-recovery, presentation-order/calibration single-source, verify.html trust
posture, honesty labels — all **confirmed accurate** by the report; no action needed.

## Provenance caveats
- Report is against **main @ 57e175c**; some line numbers shifted on V11 (recorded in the CSV).
- No finding was classified by intuition — each was re-read in the current tree and, where a code change was
  made, backed by an executed test.
