# V11 — deep-audit convergence status (this phase)

Branch `feat/shadow-spatial-ux-asset-audit-v11`. Consolidates the deep-audit reconciliation + fixes phase.
Honest: this is the P0 concrete-defect + report-reconciliation portion of the 28-section spec — the large
design-convergence (Audit Workspace primary UI, cross-surface token parity, tracking wiring, OST positive/
negative, CJK wrapping, graphical PlayMode lane) is the next multi-session increment.

## §28 status flags (honest)
| Flag | Value |
|---|---|
| TWO-REPORT-RECONCILIATION-COMPLETE | ✅ (the two PDFs are byte-identical — ONE report; fully reconciled) |
| ATTEST-METADATA-VERSION-CORRECT | ✅ (derived from package.json + contract test) |
| UNTRUSTED-INNERHTML-REMOVED | ⚠️ PARTIAL (demo/xreal.html done + browser-verified; spatial-finance is fixture-only STATIC_TRUSTED, documented, escape-at-API-boundary deferred) |
| THREEJS-ALLOCATIONS-REDUCED | ✅ (scene.js scratch vectors; 0 per-frame alloc) |
| HIT-PROXY-DRAW-COST-REMOVED | ✅ (visible=false; raycast-parity test on r160) |
| AMBIENT-COUNCIL-DEFECTS-RESOLVED | ✅ (badge overlap 0, multiline clamp, approval≠verified-green + ✓ stamp, responsive) |
| GUIDED-STORY-CONSUMES-OST-BRIGHT | ✅ (dark text + bright backplate; EditMode 120/120) |
| CROSS-SURFACE-STATUS-TOKENS-UNIFIED | ❌ (Ambient Council approval-green fixed as a start; full parity NOT done) |
| AUDIT-WORKSPACE-IMPLEMENTED | ❌ (next increment) |
| EVIDENCE-RAIL-IMPLEMENTED | ❌ |
| TRACKING-STATE-PRESERVATION-PASSED | ❌ (state machine exists + pinned; render-controller wiring not done) |
| OST-POSITIVE-AUTHORED / OST-NEGATIVE-AUTHORED | ⚠️ XrealOstBright exists; distinct positive/negative pair NOT split |
| CJK-WRAPPING-PASSED | ❌ (Intl.Segmenter fix deferred) |
| GRAPHICAL-PLAYMODE-LANE-COMPLETE | ❌ (8 pre-existing failures characterized, lane not built) |
| FULL-NODE-SUITE-PASSED | ✅ 1992 / 1989 pass / 0 fail / 3 skip |
| UNITY-EDITMODE-PASSED | ✅ 120 / 120 |
| SEMANTIC-HASHES-UNCHANGED | ✅ (V1/V2 signing semantics untouched; only the metadata version FIELD now correct) |
| STABLE-APK-UNCHANGED | ✅ | FROZEN-VERIFIER-UNCHANGED | ✅ |

### Kept false (no device evidence exists)
BEAM-PRO-INSTALLED · XREAL-LOADER-DEVICE-VALIDATED · XREAL-3DOF/EYE-6DOF-DEVICE-VALIDATED ·
BEAM-PRO-CONTROLLER-VALIDATED · DEVICE-TTS-VALIDATED · CAMERA-FRAME-VALIDATED · OCR-DEVICE-VALIDATED ·
OST-READABILITY-DEVICE-VALIDATED · DEVICE-PERFORMANCE-MEASURED · PRODUCTION-READY ·
INDEPENDENT-CRYPTO-AUDIT-COMPLETED · FORMAL-USER-STUDY-COMPLETED — **all false**.

## Commits this phase
- `b516dfa` reconcile report + P0-1 attest metadata, P0-2 alloc, P0-3 hit-proxy, P1-5 xreal innerHTML
- `9d054dd` CORS no-credentials-with-wildcard invariant + prod-allowlist doc
- `37ea94f` Ambient Council layout (badge/clamp/approval/responsive)
- `adb27c3` guided-story consumes XREAL_OST_BRIGHT (dark-on-bright backplate)

## Next increment (ordered)
1. Cross-surface semantic token parity (Unity/Three.js/CSS) + tests — approval never reuses verification green anywhere.
2. Audit Workspace as the primary Unity product UI (card/rail/focus); primitives → diagnostic mode.
3. Tracking-health → presentation auto-fallback wiring + state-preservation tests.
4. Graphical PlayMode lane for the 8 headless-incompatible tests (RequiresGraphicsContext).
5. CJK wrapping (Intl.Segmenter); OST positive/negative split; spatial-finance API-boundary escaping.
