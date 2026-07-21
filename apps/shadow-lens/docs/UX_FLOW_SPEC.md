# Shadow Lens — UX / Flow spec (the 2-minute banking decision)

## Narrative state diagram
```
READY ──Next──> CASE ──Next──> COUNCIL ──Next──> DECISION ──Next──> FLOW_OR_AUDIT
  ^               │              │                  │                    │
  └── Reset Demo (from ANY state) ──────────────────┴────────────────────┘
Back steps one state toward READY (never below READY). Reset Demo → Banking READY from anywhere.
```

## Per-state visible elements (one obvious primary action = **Next Step**)
| State | Central 3D | Left (Council) | Right (Decision/Evidence) | Bottom (stage controls) |
|---|---|---|---|---|
| **READY** | dim case node only | collapsed | "Ready" + FIXTURE MODEL / REAL SIGNED | Next Step · Reset Demo |
| **CASE** | case node + metric halo | collapsed | borrower + 3 key metrics (DTI/FICO/LTV) | Back · Next Step · Reset Demo |
| **COUNCIL** | 5 voice nodes revealed, one dominant | active voice: stance/confidence/1 reason/vote | evidence the voice cites | Back · Next Step · Reset Demo |
| **DECISION** | edges (cites/disagrees) lit | all 5 collapsed to stance chips | recommendation/risk/compliance/confidence/dissent/evidence count/signed/audit | Back · Next Step · Reset Demo |
| **FLOW_OR_AUDIT** | full graph | collapsed | Flow handoff card (prepared, offline) OR audit chain | Back · **Explore in Flow** · Reset Demo |

Only **one** council voice is visually dominant at a time during COUNCIL. No large paragraphs — one
reason line per voice.

## 3D semantic encoding (exact — see the encoding constants in `ShadowSemanticEncoding.cs`)
- **central object** = the banking case / borrower / portfolio decision.
- **surrounding nodes** = the five Shadow council voices.
- **node size** = the voice's exposure/importance to this decision (mapped from its confidence·weight).
- **distance from center** = relevance to the decision (higher relevance → closer).
- **edges** = evidence citation (`cites`), dependency, or **disagreement** (`disagrees`, shown in the
  Tampered/Warning color).
- **height/depth** = risk severity (applied consistently only to metric nodes; voices stay on one plane).
- **animation** = the transition between narrative states only — no continuous decoration.

## Stage interaction behavior
- **Next Step** is the primary action (largest, semantic color). **Back** steps toward READY.
- **Explore in Flow** appears in FLOW_OR_AUDIT; it opens the offline Flow handoff card (no network).
- **Reset Demo** is always visible + distinct (Warning color), works from every state → Banking READY.
- Pointer/touch only — no keyboard dependency.

## Fallback behavior
- If Flow is unavailable/offline → FLOW_OR_AUDIT shows the **audit chain** instead, and the Flow card
  reads "prepared offline — launched separately." Never a network error on stage.
- The 3D semantic model must return to **Banking READY** after Reset from any state, with no
  duplicated panels and no stale dominant voice.

## Automatic bootstrap (Wednesday: no manual component wiring)
`ShadowLensRuntimeBootstrap` boots the guided stage automatically + deterministically — no dragging
components, binding buttons, or saving a scene by hand.

- **Path:** `AutoBoot` (RuntimeInitializeOnLoad, once) → `Awake` (singleton guard) → `BuildHierarchy` →
  `TryEnsureGuidedStage(root)`. If the stage initializes to READY, `GuidedStageActive = true` and the
  legacy UI is **not** built (no overlap). `useGuidedStage` (default true) can be turned off to force
  the legacy MockView/panel.
- **Idempotency:** the stage is fetched with `GetComponent<ShadowStageController>()` first and only
  `AddComponent`ed if absent; `Build()` is `_built`-guarded; `OnState` registers once and is removed in
  `OnDestroy`. Calling `BuildHierarchy` again creates no second stage / `StageWorld` / `ShadowStageHUD`
  / `EventSystem`. Reset never instantiates a new root.
- **Legacy fallback:** if guided-stage init throws, it logs **one** material error (never per-frame,
  never re-thrown), destroys the half-built stage, and falls back to the legacy MockView + spatial
  panel. Working legacy objects are never destroyed merely because the guided stage exists.
- **Deterministic initial state after bootstrap:** narrative = READY · Banking · no selected voice
  (voices hidden) · READY geometry · FIXTURE MODEL + REAL SIGNED visible · Reset Demo visible ·
  Flow presenter = `ShadowOfflineFlowPresenter` · `network_used = false`.

### Expected Play Mode hierarchy (guided path)
```
ShadowLensRuntimeBootstrap
EventSystem
XR Origin (Mock Camera)
ShadowLensMockDemoRoot        (+ ShadowStageController)
  ├─ ShadowStageHUD           (title · FIXTURE MODEL · REAL SIGNED · state · council-left · decision-right · Back/Next Step/Explore in Flow/⟲ Reset Demo)
  └─ StageWorld
       ├─ CaseNode            (central sphere = the banking case)
       └─ Nodes/Voice_*       (5 council spheres — size=importance, distance=relevance, one plane)
```

## Test-count reconciliation (2026-07-21)
This UX/Flow phase added exactly **+12 Node tests** (9 `shadow-flow-export` + 3 `shadow-narrative-contract`;
isolation-verified: suite 1736 without the two files → 1748 with them). A prior report said "+21" —
that was wrong. The bootstrap slice added **+3 Node** (`shadow-bootstrap-contract`) → **1751** total.
Unity authored: **9 EditMode** (`ShadowNarrativeTests`) + **7 + 6 PlayMode** (`ShadowStagePlayModeTests`
+ `ShadowStageBootstrapPlayModeTests`) — authored, executed in the Unity editor, not on the Node host.
