# Audit Workspace increment — status

**Label: AUDIT WORKSPACE CORE V1 IMPLEMENTED (logic + EditMode verified). NOT the completion of V11;
visual PlayMode capture + full browser acceptance are in progress in the same increment.**

## §20 flags
| Flag | Value | Evidence |
|---|---|---|
| UNITY-TOOLCHAIN-FOUND | ✅ | 6000.0.23f1 at exact Hub path; UNITY_TOOLCHAIN_DISCOVERY.md |
| UNITY-EDITMODE-EXECUTED | ✅ | batchmode EditMode ran to a results XML |
| UNITY-EDITMODE-PASSED | ✅ | total 133 / passed 133 / failed 0 |
| FLOW-AUTHORING-BOUNDARY-CORRECTED | ✅ | canonical-story-ownership wording added to both Flow docs |
| AUDIT-WORKSPACE-IMPLEMENTED | ✅ | `ShadowAuditWorkspace` MonoBehaviour + model, compiled |
| AUDIT-WORKSPACE-DEFAULT-VIEW | ✅ | `ShadowPresentationModes.Default == AuditWorkspace` |
| PRIMITIVE-DIAGNOSTIC-PRESERVED | ✅ | enum retained; SwitchMode keeps it available |
| GENERATED-UNITY-TOKENS-CONSUMED | ✅ | ShadowStatusGlyph → ShadowSemanticTokens.Get; no hardcoded table |
| CURRENT-FOCUS-READABLE | ✅ (logic) | BuildFocus binding tests |
| SOURCE-CARD-READABLE | ✅ (logic) | missing-state explicit tests |
| TRUST-STRIP-READABLE | ✅ (logic) | 4 groups, not-all-green test |
| EVIDENCE-RAIL-IMPLEMENTED | ✅ (logic) | sequence + first-failure-break + downstream-distinct test |
| FIRST-FAILURE-READABLE | ✅ (logic) | test |
| DOWNSTREAM-AFFECTED-DISTINCT | ✅ (logic) | distinct glyph/icon test |
| INTEGRITY-CORRECTNESS-DISTINCT | ✅ | correctness NOT_EVALUATED default, separate field |
| HUMAN-REVIEW-APPROVAL-DISTINCT | ✅ | separate fields + assertion |
| TRACKING-SCANNING-EXPLICIT | ✅ | exact copy EN/ZH; distinct-from-LIMITED test |
| TRACKING-FALLBACK-AUTOMATIC / STATE-PRESERVATION-PASSED | ✅ (logic) | ApplyDegraded preserves story/selection |
| OPEN-2D-AUDIT-REACHABLE | ✅ | action rendered; next-action routes to 2D audit; verify.html untouched |
| ENGLISH-LABELS-PASSED / CHINESE-LABELS-PASSED | ✅ | BuildFocus EN/ZH + label-metrics tests |
| MATERIAL-SHARING-PASSED | ✅ (code) | static shared-material cache; no per-card material |
| FULL-NODE-SUITE-PASSED | ✅ | 2035 pass / 0 fail / 3 skip |
| SEMANTIC-HASHES-UNCHANGED / STABLE-APK-UNCHANGED / FROZEN-VERIFIER-UNCHANGED | ✅ | c478b46f; no APK write |

## In progress (same increment, verifiable, NOT yet done here)
- RENDER-HARNESS-CAPTURES-COMPLETE — PlayMode graphics capture of the 14 Workspace states (needs a
  graphics-mode Unity run + a capture entry that instantiates `ShadowAuditWorkspace`).
- AUDIT-ROOM-INSPECTOR-VISUALLY-VALIDATED / AUDIT-ROOM-TIME-AXIS-VISUALLY-VALIDATED — Chromium visual
  acceptance of the Three.js Audit Room (via chrome-devtools).
- INTERNAL-UX-REVIEW-COMPLETE.

## Kept false (no evidence)
BEAM-PRO-INSTALLED · XREAL-3DOF/EYE-6DOF-DEVICE-VALIDATED · BEAM-PRO-CONTROLLER-VALIDATED ·
OST-READABILITY-DEVICE-VALIDATED · DEVICE-PERFORMANCE-MEASURED · FORMAL-USER-STUDY-COMPLETED ·
PRODUCTION-FLOW-INTEGRATION · FLOW-PARTNERSHIP-CONFIRMED · PRODUCTION-READY.
