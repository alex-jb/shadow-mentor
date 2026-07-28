# persona-deliberation — browser acceptance

Real renders of `demos/animations/persona-deliberation.html` via Playwright/Chromium **149.0.7827.55**,
isolated context (not Alex's Chrome), served same-origin at 127.0.0.1:8904.

## Acceptance — all PASS
- **0 console errors · 0 external requests · 0 CSP violations.**
- **0 horizontal overflow** at 1280×720, 1440×900, 390×844.
- The first flagged check is correct per scenario (read from the rendered matrix):
  - consensus_with_evidence → none.
  - disagreement → **Majority agreement** (WARNING: opposing stances; no majority-as-truth).
  - unsupported_claim → **Unsupported claims** (excluded from grounded synthesis).
  - contradictory_evidence → **Contradictory evidence** (kept, not hidden).
  - abstain → **Abstention** (preserved; human review required).
  - majority_weak_evidence → **Claim-evidence binding** (WARNING) — majority PRESENT but synthesis says
    INSUFFICIENT EVIDENCE TO CONCLUDE + MAJORITY DOES NOT PROVE CORRECTNESS + analytical correctness NOT
    EVALUATED + human approval REQUIRES HUMAN REVIEW. Prevents "4-vs-1 so the answer is correct".
- Honesty invariants hold in every scenario: MAJORITY_AGREEMENT never sets ANALYTICAL_CORRECTNESS; a Fair
  Lending Compliance persona never sets LEGAL_FAIRNESS_REVIEW VERIFIED; HUMAN_APPROVAL stays NOT_PRESENT or
  REQUIRES_HUMAN_REVIEW; never a generic TRUSTED/COMPLIANT; stance strength is never labeled confidence.
- Bilingual EN + 简体中文 (evidence/IDs/quotes unchanged by language); reduced-motion works; keyboard
  (Space/←/→/R/1–6/Esc/Tab) works; drawers open evidence / persona output / synthesis provenance.

## Media
`persona-deliberation-demo.{webm,mp4}` (~28.7s, 1280×720) + screenshots: en-consensus, en-disagreement,
en-unsupported-claim, en-contradictory-evidence, en-abstain, en-majority-weak-evidence, zh-CN-consensus,
zh-CN-disagreement, reduced-motion, mobile.

## Status ladder
FIXTURE-AUTHORED ✅ · PERSONA-SEMANTICS-HOST-TESTED ✅ · SYNTHESIS-PROVENANCE-HOST-TESTED ✅ (11 Node tests) ·
BROWSER-RENDERED ✅ · BROWSER-RECORDED ✅ · OFFLINE-VALIDATED ✅ (pure JS, inlined fixture, no network) ·
**SHADOW-COUNCIL-INTEGRATED ❌ · LIVE-MODEL-TESTED ❌ · USER-STUDIED ❌ · UNITY-INTEGRATED ❌ · DEVICE-VALIDATED ❌**
(not claimed). Verify: `shasum -a 256 -c SHA256SUMS.txt`.
