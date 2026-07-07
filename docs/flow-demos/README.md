# Shadow × Flow Immersive × XREAL One Pro — Demo Suite

**Date:** 2026-07-06 · **Status:** Demo A shipped, B/C/D scaffolded
**Prerequisites:** Flow Immersive account at `a.flow.gl` (Alex registered 2026-07-06), XREAL One Pro (Lora ordered, arriving max 2026-07-11)

**Purpose:** four short (30-90 second) 3D data demos that tell four distinct stories from Shadow's live data. Each demo targets a specific stakeholder and produces a specific procurement or academic outcome. All four run on the same Flow Immersive infrastructure, all four render standalone on XREAL One Pro (X1 chip 3DoF, no laptop tether required).

---

## The four demos

| Demo | Audience | Story arc | Status | Path |
|---|---|---|---|---|
| **A. Brier Reliability Surface** | Columbia stats faculty (via Lora), quant-audit staff | "This is which of the 5 personas is under-emitting confidence, over time." | ✅ Shipped 2026-07-06 | `A-brier-reliability/` |
| **B. 4-Verdict Lattice Scatter** | Yeshiva Dean + VP, mid-tier bank executives | "Every loan Shadow has ever seen sits somewhere in this space — the 4 verdict regions are visually distinct." | 🟡 Scaffold pending | `B-verdict-lattice/` |
| **C. Hash-Chain Audit Walkthrough** | Bank counsel, examiner audience, SIEM ops | "This is 30 days of decisions. Watch what happens when I tamper — the chain breaks visibly here." | 🟡 Scaffold pending | `C-hash-chain/` |
| **D. Regulatory Citation Graph** | Procurement, academic reviewers | "Every regulation traces to a persona traces to a test file. Walk the graph." | 🟡 Scaffold pending | `D-citation-graph/` |

---

## Why 4 demos, not 1

Each stakeholder has a different lens. A Columbia statistician wants to see calibration decomposition; they will bounce off a verdict-lattice scatter. A Dean wants a visual proof of "here is what the technology looks like"; they will not read a Brier reliability curve. A bank counsel wants tamper detection; they will not care about calibration or aesthetics. Procurement wants regulatory traceability; they will not care about live decisions.

Four short demos, one per audience, delivered by one Flow scene URL per audience, is faster to prepare and better received than one long "show everything" demo.

---

## Aesthetic + XREAL One Pro constraints (shared across all 4)

- **Depth as time or as classification** — Z axis is always either time (Demos A + C) or verdict class (Demo B). Never leave Z as an ordinal without semantic meaning; reviewers will read into it.
- **Color as persona or verdict** — 5 personas map to 5 distinguishable colors; verdicts map to 3 colors (green approve, orange escalate, red block). Never use both simultaneously in the same scene.
- **Size as sample count** — larger point = more data. Reviewers can see at a glance which parts of the space have statistical weight.
- **FOV budget (57° on XREAL One Pro)** — no scene should require the reviewer to turn their head more than 30° from the entry direction to see the primary claim. Secondary details go behind the reviewer as walk-around bonus content.
- **Standalone rendering** — every scene must render at 45+ FPS on X1 chip standalone (no laptop tether). Fallback modes documented per demo.

---

## Live data vs synthetic data

Demo A ships with synthetic data because Shadow's real calibration curves have n < 100 per persona as of 2026-07-06. As live decision logs grow (SpaceX-IPO-Tracker + Council-for-Slack production traffic), the `generate.py` scripts get replaced with `curl https://shadow-mentor.vercel.app/api/calibration | jq ...` pipelines. Each demo's README documents the swap.

Demos B and C can use live data as of today (case studies + attestation chain are ready). Demo D is entirely static (regulatory graph is version-controlled in `docs/CITATION_MAP.md`).

---

## Ownership + coordination

- **Alex** owns data pipelines, Flow scene mapping, CSV/JSON generators, on-device XREAL testing.
- **Lora** owns audience introductions, banking-domain scene review, executive coordination.
- **Jason Marsh** (Flow) — support for Flow scene template edge cases if we hit rendering ceilings.
- **Bill** (TBC per Alex clarification) — likely industry audience or bridge relationship.

---

## Roadmap

- **2026-07-07 (Tue)** — Alex uploads Demo A CSV to Flow, records 90-sec Loom of the walkthrough, sends to Lora for review before Columbia stats faculty introduction.
- **2026-07-08 (Wed)** — Ship Demos B + C scaffolds (CSV generators + narration + XREAL rendering notes).
- **2026-07-11 (Fri/Sat)** — XREAL One Pro arrives at Lora. Alex has Phase A preflight testable on-device.
- **2026-07-14 (Mon)** — Phase B on-device test week begins (per `docs/xreal-one-pro-test-protocol/`). Demos A + B + C tested on-device day by day.
- **2026-07-18 (Fri)** — Ship Demo D. All 4 demos green on XREAL One Pro.
- **Late July** — Executive Dean + Vice-Provost demo. Choose 1 of the 4 to lead with (likely Demo B for reviewer audience match).

---

*This suite is a public artifact of `shadow-mentor` (MIT). Each demo's `README.md` is meant to be forked and iterated in-place.*
