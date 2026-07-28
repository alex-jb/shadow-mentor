# Audit Workspace — architecture (core V1)

**Status: AUDIT WORKSPACE CORE V1 IMPLEMENTED (Unity runtime) + EditMode-verified. Visual/OST
validation not claimed.**

## Layering (tested logic vs renderer)
The workspace splits into pure, EditMode-testable LOGIC and a thin MonoBehaviour renderer, so the
correctness contract is verifiable headlessly and the rendering stays a renderer responsibility.

| File | Kind | Responsibility |
|---|---|---|
| `Workspace/ShadowPresentationMode.cs` | pure | mode enum (PrimitiveDiagnostic / AuditWorkspace) + preserved `ShadowWorkspaceState` + `SwitchMode` |
| `Workspace/ShadowStatusGlyph.cs` | pure | status → GENERATED token + procedural glyph name; unknown → `UNKNOWN STATUS` (fail closed, never VERIFIED) |
| `Workspace/ShadowLabelMetrics.cs` | pure | deterministic preferred-size (CJK full-width, Latin proportional, emoji/surrogate = 1 glyph); overflow flag + truncation affordance — no `maxLen*0.55` |
| `Workspace/ShadowTrackingBanner.cs` | pure | 7 tracking states, exact SCANNING copy EN/ZH, degraded-state preservation |
| `Workspace/ShadowAuditWorkspaceModel.cs` | pure | derives Current Focus / Source / Trust Strip (4 groups) / Evidence Rail from the REAL guided-story state |
| `Workspace/ShadowAuditWorkspace.cs` | MonoBehaviour | renders the 2.5D layout (TOP/LEFT/CENTER/RIGHT/BOTTOM) via TextMesh + shared materials; incremental per-region rebuild |

## Data flow (no duplication)
`ShadowGuidedStoryState` (real story) → `ShadowAuditWorkspaceModel.Build*` (view-models) →
`ShadowAuditWorkspace` (meshes). The workspace does not copy or invent story data; status identity
comes from the generated token table; colours from `ShadowDesignTokens.Resolve(profile)`.

## Information layout (§7)
TOP session header + tracking + `SIMULATED — NOT DEVICE VALIDATED` boundary · LEFT Source Card ·
CENTER dominant Current Focus Card · RIGHT Trust Strip (4 groups) · BOTTOM Evidence Rail + actions.

## Preserved invariants
integrity ≠ correctness · verification ≠ approval · human review ≠ human approval · selected ≠
confirmed · SCANNING ≠ LIMITED ≠ LOST · first failure ≠ downstream · unknown status fails closed.

## Verification (this environment)
Unity 6000.0.23f1 batchmode EditMode: **total 133 · passed 133 · failed 0** (includes the 10 new
`ShadowAuditWorkspaceTests`). The Workspace assembly compiles (a compile error would have broken the
dependent Tests assembly). Visual PlayMode captures + browser acceptance are separate steps.
