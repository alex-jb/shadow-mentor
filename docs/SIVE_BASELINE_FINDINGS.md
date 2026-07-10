# SIVE Baseline Findings — 2026-07-08

**Ships with Shadow v1.5.41.**
**Anchor:** arXiv:2607.00910 — SIVE (Synthetic Instrument Validation Experiment).

The SIVE test rig (`test/sive-fixtures.test.js`) fires each Shadow persona against 5 known-valence synthetic loans. The test asserts CURRENT baseline behavior — including any pathologies present at v1.5.41. Any drift from this baseline (improvement OR regression) surfaces in CI.

This document records the 3 baseline findings SIVE exposed at v1.5.41. Each is a real bug scoped for a future release, not a test failure to work around.

## Finding #1 — obvious_approve returns escalate, not approve

**Symptom.** A loan with FICO 780 / DTI 0.20 / LTV 0.60 / AA borrower rating passes every hard-block threshold comfortably. Yet `runLoanCouncil()` returns `verdict: "escalate"` not `verdict: "approve"`.

**Root cause hypothesis.** `AGGREGATION_THRESHOLDS.approveMin = 0.35` in `lib/confidence-weighted-verdict.js`, but the aggregated_score for this loan is 0.6575 — well above 0.35. So the middle-band → escalate decision is NOT coming from the confidence-weighted layer. It's coming from a separate escalation rule elsewhere in `run-loan-council.js`. Likely candidate: a "default to escalate unless explicit approve gate" pattern that hasn't been documented.

**Impact.** Loans that should legitimately auto-approve are being routed to human review. Wastes compliance officer time. Erodes the case for LLM-augmented underwriting.

**Fix scope.** v1.5.42+. Trace the escalate path in `run-loan-council.js` back to its origin. Either the escalate condition is intentional (document it) or it's a bug (fix it). Currently the escalation-vs-approve boundary is untraceable without reading 200+ lines of council code.

**Status — RESOLVED in v1.5.44 (2026-07-09) by fixture correction.** Traced: two personas structurally escalated `obvious_approve` — (a) Macro Contrarian always escalates `sector: commercial_real_estate` per Lora's late-cycle regime policy, (b) Risk Officer escalates on synthetic-stressed default `market_proxy_prices` when the fixture omits them. Both persona rules are intentional and stay unchanged. Fixture was renamed to `consumer_discretionary` sector and given a favorable price series so all 5 personas clear their approve gates. This is what "obvious approve" was always supposed to mean — unanimous. Test pins unanimity so any future drift surfaces immediately.

## Finding #2 — OFAC SDN match returns escalate, not refuse_to_serve

**Symptom.** A loan with `aml_flags: ["OFAC_SDN_MATCH"]` returns `verdict: "escalate"` from `runLoanCouncil()`. The verdict should be `refuse_to_serve` per v1.5.35 (arXiv:2606.29142).

**Root cause.** Documented behavior. `runLoanCouncil()` intentionally does NOT auto-invoke `maybeRefuseToServe()` — the upgrade must be wired at the output boundary by the upstream caller. `/api/deliberate` does this correctly (v1.5.36 wire-in); direct `runLoanCouncil()` callers do not.

**Impact.** Callers of `runLoanCouncil()` directly (not via `/api/deliberate`) miss the `refuse_to_serve` distinction. Their downstream call-center scripts may route OFAC hits to human-reviewer queue, risking §5318(g)(2) tipping-off violations.

**Fix scope.** v1.5.42+. Either (a) wire `maybeRefuseToServe()` into `runLoanCouncil()` internally with an opt-out flag for legacy callers, or (b) publish a lint rule that flags direct `runLoanCouncil()` calls without a follow-on `maybeRefuseToServe()` check. Option (a) is safer.

**Status — RESOLVED in v1.5.43 (2026-07-09).** Shipped `lib/run-loan-council-gated.js` — new `runLoanCouncilGated({ loan, amlKycFindings, evidenceRef })` wrapper that short-circuits to `refuse_to_serve` before persona deliberation when a refusal category fires. Chosen approach was a **wrapper** rather than mutating `runLoanCouncil()` to preserve the SIVE Finding #2 baseline pin (contract-test evidence that pre-v1.5.43 behavior is documented). Callers opt in by importing the gated wrapper; existing callers see zero change. 10 contract tests in `test/run-loan-council-gated.test.js` pin the new behavior including the SIVE fixture regression.

## Finding #3 — Ranking-Calibration conflation in aggregated_score

**Symptom.** Both `obvious_approve` (FICO 780 / DTI 0.20 / LTV 0.60) and `borderline_escalate` (FICO 705 / DTI 0.34 / LTV 0.78) produce **the same aggregated_score of 0.6575**. This is a real bug — the confidence-weighted-verdict layer conflates two orthogonal signals:

- **Ranking**: which loan is "more approvable" (obvious_approve should score higher)
- **Calibration**: what confidence level does the council actually have (obvious_approve should show ~0.95, borderline should show ~0.55)

**Root cause hypothesis.** `lib/confidence-weighted-verdict.js` aggregates verdict-score × persona-weight, then compares to fixed thresholds. Every persona voting `approve` (VERDICT_SCORES.approve = 1.0) gives the same aggregated score regardless of the underlying signal strength. There's no calibration dimension to distinguish "unanimous strong approve" from "unanimous weak approve."

**Impact.** Shadow cannot distinguish "safe to auto-approve" from "conservatively approve but flag for spot-check." Bank counsel wanting to route the borderline case for post-decision audit while auto-approving the obvious case has no signal to key on.

**Fix scope.** v1.5.42+. Ship arXiv:2605.27712 (Prefix-Safe Bayesian Belief Tracking, Song/Li/Liu 2026-05-26). The paper's contribution is EXACTLY this — separating calibration from ranking. Refactor `confidence-weighted-verdict.js` to emit TWO outputs:

- `calibrated_p`: probability the verdict is correct (Brier-auditable, [0,1])
- `ranking_score`: structural aggregation for tie-breaking (unbounded, ordinal)

This is a candidate v1.5.42 ship — real bug fix, arXiv-anchored, procurement-visible.

## Why this doc exists

The SIVE paper's key insight: **characterising an instrument's response function must precede using it to test a theory.** Every LLM-agent system that ships without characterising its response function will suffer these pathologies silently. Shadow is now the first OSS banking-council system to publish its response-function findings.

Bank counsel opening this doc sees exactly what Shadow does NOT get right at v1.5.41. This is honest positioning — the alternative is discovering these pathologies at exam time.

## Followup roadmap

| Finding | Scope | Anchor | Estimated ship |
|---|---|---|---|
| #1 escalate default | Trace escalation path in run-loan-council.js | (no external anchor) | v1.5.42+ |
| #2 OFAC → refuse_to_serve auto-wire | Wire `maybeRefuseToServe()` into runLoanCouncil | arXiv:2606.29142 | v1.5.42+ |
| #3 calibration vs ranking split | Split confidence-weighted-verdict.js into two outputs | arXiv:2605.27712 | v1.5.42-43 |
