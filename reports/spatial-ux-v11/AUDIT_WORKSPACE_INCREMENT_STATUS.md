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
| EVIDENCE-RAIL-IMPLEMENTED | ✅ | sequence + first-failure-break + downstream-distinct test |
| INTEGRITY-CORRECTNESS-DISTINCT | ✅ (logic) | correctness NOT_EVALUATED default, separate field |
| HUMAN-REVIEW-APPROVAL-DISTINCT | ✅ (logic) | separate fields + assertion |
| TRACKING-SCANNING-EXPLICIT | ✅ (logic) | exact copy EN/ZH; distinct-from-LIMITED test |
| TRACKING-STATE-PRESERVATION-PASSED | ✅ (logic) | ApplyDegraded preserves story/selection |
| OPEN-2D-AUDIT-REACHABLE | ✅ (logic) | action rendered; next-action routes to 2D audit; verify.html untouched |
| MATERIAL-SHARING-PASSED | ✅ (code) | static shared-material cache; no per-card material |

### VISUAL_ACCEPTANCE_PENDING — logic bound + tested, but NOT visually accepted (no graphical capture inspected yet)
Per the correction: "logic readable" ≠ "画面可读". These are **not** claimed visually passed until the
14 graphical Workspace captures are produced + inspected:
- CURRENT-FOCUS-READABLE → LOGIC_BINDING_PASSED · VISUAL_ACCEPTANCE_PENDING
- SOURCE-CARD-READABLE → LOGIC_BINDING_PASSED · VISUAL_ACCEPTANCE_PENDING
- TRUST-STRIP-READABLE → LOGIC_BINDING_PASSED · VISUAL_ACCEPTANCE_PENDING
- FIRST-FAILURE-READABLE → LOGIC_BINDING_PASSED · VISUAL_ACCEPTANCE_PENDING
- DOWNSTREAM-AFFECTED-VISUALLY-DISTINCT → LOGIC_BINDING_PASSED · VISUAL_ACCEPTANCE_PENDING
- ENGLISH-LABELS-VISUALLY-PASSED / CHINESE-LABELS-VISUALLY-PASSED → TEXT_SIZING_TESTS_PASSED · VISUAL_ACCEPTANCE_PENDING
- TRACKING-BANNER-VISUALLY-PASSED → VISUAL_ACCEPTANCE_PENDING
- RENDER-HARNESS-CAPTURES-COMPLETE → false (no captures yet)
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
