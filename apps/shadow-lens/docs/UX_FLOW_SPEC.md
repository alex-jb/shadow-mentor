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
