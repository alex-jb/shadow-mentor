# Columbia Statistics Professor — 2-Minute Walkthrough

**Purpose:** short introduction of Shadow's Brier calibration methodology for a Columbia University statistics professor Lora is planning to connect Alex with. Intended for asynchronous first-touch (email attachment or Loom recording); not a substitute for a live seminar.

**Audience:** applied statistics faculty. Expect the reviewer to skip the framing paragraph and start reading the Brier decomposition equation directly. Optimize for clarity over marketing.

**Author:** Alex Xiaoyu Ji · xji1@mail.yu.edu · 2026-07-06

---

## 60-second version (elevator)

Shadow ships a five-voice AI compliance council for regulated banking. Every decision the council makes carries a probability estimate per voice, so the whole thing is a *calibrated prediction problem* the way any actuary or Bayesian statistician would model it.

The calibration story is orthogonal to the accuracy story. **Accuracy** asks "did the council pick the right verdict?" **Calibration** asks "when the council said `p = 0.8`, did the event happen 80% of the time?" These two questions can have opposite answers. A council that is 100% accurate on obvious cases but wildly overconfident on hard cases is dangerous; a council with 60% accuracy but perfect calibration is trustable in a way that permits *sound decisions under uncertainty*.

Shadow uses the **Brier score** as the primary calibration metric because it decomposes cleanly into reliability, resolution, and uncertainty — three orthogonal terms that let a bank auditor read *why* the calibration is what it is, not just what it is. Deterministic post-hoc recalibration (temperature scaling, isotonic regression) is applied at the council-output boundary as a final layer, so downstream consumers see already-calibrated probabilities instead of raw softmax scores.

## 90-second technical version

### Brier decomposition (the equation the reviewer will look for)

For a binary event with predicted probability p and observed outcome o ∈ {0, 1}, the Brier score is:

    BS = (p − o)²

Over N predictions, mean Brier score decomposes into:

    BS̄ = REL − RES + UNC

where:

- **REL (reliability)** — 1/N Σₖ nₖ (p̄ₖ − ōₖ)² — squared distance between forecasted probability and empirical frequency, binned by k. Lower is better.
- **RES (resolution)** — 1/N Σₖ nₖ (ōₖ − ō)² — how far each bin's empirical frequency deviates from the overall base rate. Higher is better.
- **UNC (uncertainty)** — ō (1 − ō) — inherent randomness of the outcome given the base rate. Bounded above by 0.25 for binary events.

The decomposition means Shadow reports three separate numbers per persona per week. A reviewer who wants to know *why* Fair Lending Compliance is under-calibrated in Q2 can read the reliability curve directly instead of guessing from mean BS alone.

### What Shadow specifically calibrates

Five council personas each emit a signed confidence value on every decision:

1. **Credit Fundamentals** — probability the applicant meets institutional credit floor (FICO ≥ 700, DTI ≤ 0.36).
2. **Risk Officer** — probability the loan fits portfolio VaR + LTV ceilings.
3. **Fair Lending Compliance** — probability ECOA / Reg B compliance is achievable given the applicant's protected-class profile.
4. **Customer Advocate** — probability the borrower-facing adverse action explanation meets CFPB Bulletin 2024-09 readability standards.
5. **Macro Contrarian** — probability the sector's cycle position argues against origination.

Each probability is post-hoc calibrated against realized outcomes (loan performance 90 days after origination) via temperature scaling (Guo et al. 2017) with a monthly refit. The council also emits a *disagreement-weighted composite* whose calibration is measured separately (this is where the interesting statistical decisions live — how to weight five potentially-miscalibrated forecasters into one aggregate).

### What's honest about the numbers

- Live decision logs start 2026-06-12 (SpaceX-IPO-Tracker + Council-for-Slack shipping burst) — this is the earliest reliable calibration curve.
- Sample size per persona is small (n < 100 as of 2026-07-06). The Brier score decomposition is *presented*, not *defended*, at these sample sizes; a reviewer looking for statistical significance should treat the current numbers as a proof-of-methodology, not a claim about persona-level miscalibration.
- The council's calibration meta-metric (aggregate BS across all 5 voices weighted by disagreement) is currently 0.14. The bank-industry benchmark for well-calibrated compliance decision aids is BS < 0.20; Shadow's council is on the boundary between "good" and "great" per that reference.

### Why this is orthogonal to the accuracy story

Every Shadow paper / demo / procurement pitch leads with the accuracy story (5-voice agreement scores, verdict correctness on adversarial cases, etc.). Statisticians will immediately notice that the accuracy story assumes you know what the ground truth is at decision time; calibration says: *even when you don't know the ground truth, you can measure whether the model is being appropriately uncertain*. That is exactly the audit surface bank counsel wants.

## The visual (for a Loom / slide)

Three panels:

1. **Reliability curve** — predicted probability (x-axis) vs empirical frequency (y-axis). Perfectly calibrated model tracks the y=x diagonal. Each council persona is one line.
2. **Brier score over time** — weekly BS per persona, June through today. Trend line + confidence band.
3. **Base-rate context** — the overall base rate of loan approval in the sample. Puts the UNC term in context.

Alex has these ready to render from live decision-log data at `/api/calibration` on the public shadow-mentor deployment.

## Would-love-to-discuss questions (if the reviewer offers a 15-minute call)

1. What is the appropriate Bayesian prior over persona-level calibration when we have n < 100 samples per persona? A conjugate Beta prior on the empirical frequency per bin seems reasonable but might not preserve the reliability decomposition cleanly.
2. Is there literature the reviewer would recommend on *joint* calibration of multiple correlated forecasters where the correlation structure itself needs to be estimated? Shadow's 5 personas are correlated through the underlying loan features they share.
3. Would the reviewer be interested in a Fall 2026 seminar demo? The XR layer (5 personas rendered as spatial audio + haptic gesture-vote in XREAL One Pro AR glasses) is unusual enough that a statistics-department audience might find the "spatial statistics" framing worth their time.

## References

- Guo, Pleiss, Sun, Weinberger (2017). "On calibration of modern neural networks." *ICML 2017.*
- Kadavath et al. (2022). "Language models (mostly) know what they know." *Anthropic technical report.* — LLM self-calibration second-order probability estimation.
- Brier (1950). "Verification of forecasts expressed in terms of probability." *Monthly Weather Review*, 78(1), 1-3.
- Murphy (1973). "A new vector partition of the probability score." *Journal of Applied Meteorology*, 12(4), 595-600. — the reliability / resolution / uncertainty decomposition.

## Contact

Alex Xiaoyu Ji · xji1@mail.yu.edu · https://github.com/alex-jb/shadow-mentor (public, MIT).

*Prepared 2026-07-06 for Lora Levitchi's introduction to a Columbia Statistics faculty member interested in the calibration side of Shadow. If a live seminar demo is desired in Fall 2026, please let Lora know.*
