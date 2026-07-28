# Shadow Audit Arc V2 — UX spec (Phase 1D)

The goal: in 10 seconds the auditor answers — what happened? on what basis? which step failed? who/what
tool produced it? what downstream is affected? how do I open the original evidence? Not more spheres,
particles, or glow.

## Arrangement (Focus + Context)
```
                    ┌──────────── CONTEXT: agent · tool · model · source relationships ───────────┐
   LEFT             │                         CENTER                          │        RIGHT       │
   original         │        current evidence / claim / FAILED sequence        │  claim + result +  │
   artifact         │        (focus node prominent; neighbours visible;        │  the six independent│
   doc/dataset/diff │         unrelated faded — scene does NOT rotate)         │  verification states│
                    └──────────── BOTTOM: sequence timeline · scrubber · replay controls ──────────┘
   GLOBAL (always reachable): Recenter · Back · Reset · Open 2D Audit · Language · Input Method · FIXTURE/LIVE/DEVICE
```
Selecting a node highlights it + immediate predecessors/successors, fades the rest, and shows detail in a
**stable reading panel** — it must **not** rotate or rebuild the whole scene, and must preserve the user's
orientation. (The prototype implements exactly this: focus+context with a fixed side panel.)

## Interaction state machine
`IDLE → HOVERED → FOCUSED → SELECTED → EXPANDED → ACTION_PENDING → CONFIRMED` (plus `FAILED`, `DISABLED`).
Rules:
- **hover does not select · head-directed focus does not approve · dwell does not execute regulated actions.**
- destructive/regulated actions require an **explicit Beam Pro click** (or approved alternative), with a
  visible ACTION_PENDING → CONFIRMED transition.
- every action has Back/Cancel; **Recenter always reachable**; **Reset returns to deterministic Banking READY**.
- selection preserves orientation; never a full camera reset on select.
- hover, selection, and approval are **visibly distinct** (shape/outline/label, not colour alone).

## Preserve the six as separate concepts (never one green)
RECORD INTEGRITY · SIGNATURE · HASH CHAIN · SOURCE RESOLUTION · PROFILE · EXTERNAL ANCHOR — each
`VERIFIED/FAILED/NOT_PRESENT/NOT_CHECKED/UNSUPPORTED/MALFORMED`; plus **ANALYTICAL CORRECTNESS = NOT
EVALUATED**. "Green" never means analytical correctness. Use shape + line style + label in addition to colour.

## Arc V2 features (target)
sequence direction visible · timeline scrubber + current-sequence marker · exact failed sequence prominent ·
downstream-affected visualisation · provenance edge types (signature/hash/source/tool distinct by line style)
· tamper propagation reveal (one-shot, not looping) · pause/step · filter by agent/tool/evidence type/status ·
collapse/expand branches · open original source · open claim↔evidence relation · reset · recenter · **2D
audit-table fallback always available**. All spatial numbers are hypotheses until One Pro measurement.
