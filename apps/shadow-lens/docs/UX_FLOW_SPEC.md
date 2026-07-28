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
| **READY** | **labeled case core** (core sphere + one static ring + 3-line label: MID-MARKET LOAN / CASE #SL-2026-014 / $8.4M REQUEST); voices hidden | collapsed | "Ready" + FIXTURE MODEL / REAL SIGNED | Next Step · Reset Demo |
| **CASE** | case node + metric halo | collapsed | borrower + 3 key metrics (DTI/FICO/LTV) | Back · Next Step · Reset Demo |
| **COUNCIL** | 5 voice nodes revealed **each with a flat perspective label** (name + vote), one dominant | active voice: stance / **STANCE STRENGTH** / 1 reason / vote | evidence the voice cites | Back · Next Step · Reset Demo |
| **DECISION** | edges (cites/disagrees) lit | all 5 collapsed to stance chips | recommendation/risk/compliance/**council strength**/dissent/evidence count/signed/audit | Back · Next Step · Reset Demo |
| **FLOW_OR_AUDIT** | **3D provenance audit arc** (source→snapshot→evidence→claim→recommendation→signature→audit_record; VERIFIED green, at/after a broken link → NOT VERIFIED, frozen) | collapsed | Flow handoff card (prepared, offline) OR audit chain | Back · **Explore in Flow** · Reset Demo |

### XR interaction + Rule-15 3D (Slice E)
- **Audit arc** is the one element that genuinely earns its 3D (Rule 15): built once in FLOW_OR_AUDIT from the tested `SpatialLayout.AuditArc()` geometry, walking the Claim–Evidence provenance spine (`ShadowAuditChainData`, mirrored from `provenanceChain()`). STATIC verification state — no timed coroutine; the cascade timing is data (`CascadeDelaysSec`) for the device build. Council spheres stay as perspective **topology** (kept, now labelled), not deleted.
- **Head-directed focus** (`ShadowHeadDirectedFocus`) = a ray from the camera's **head-forward** direction (3DoF; **not** eye tracking, no Eye add-on). Hover + highlight **only** — never approves, submits, or dwells-to-confirm. Pointer/controller (Beam Pro) remains the sole action path. XRI-compatible: swap in an XR Gaze Interactor without changing the contract.
- **Confidence semantics**: per-voice numbers render as **STANCE STRENGTH** (persona prior), never "model confidence" (see `product-facts.json` → `confidence_semantics`).

### Legibility + performance baseline (Slice F)
- **Editor preview profiles** (`ShadowLegibilityProfiles`): Desktop 16:9 · Narrow Landscape ·
  Low-Resolution Landscape · Glasses Central Safe Zone · High-Complexity Passthrough. Pure
  checks catch clipped text, controls outside the safe zone, CaseCore/label overlap,
  undersized hit areas, and >30° head-turn before the headset arrives.
- **Perf baseline** (`ShadowPerfBaseline`): init/transition ms, editor/android FPS, draw calls,
  canvas rebuilds, GC alloc on transition, StageWorld/HUD/EventSystem counts. **Every sample is
  labeled `NOT_BEAM_PRO_DEVICE_EVIDENCE`** — Mac-editor numbers catch gross regressions only and
  are never presented as device performance.

Only **one** council voice is visually dominant at a time during COUNCIL. No large paragraphs — one
reason line per voice.

## 3D semantic encoding (exact — see the encoding constants in `ShadowSemanticEncoding.cs`)
- **central object** = the banking case / borrower / portfolio decision, shown as a **legible case core**:
  a restrained core sphere + one static containment ring + a 3-line world-space label (title / number /
  amount) — a data node, not a bare sphere. The label lines are mirrored 1:1 in the `.mjs` fixture
  (`case_display`) and `ShadowBankingNarrativeData.cs` (`CaseTitle`/`CaseNumber`/`CaseAmount`).
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
