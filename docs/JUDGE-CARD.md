# Shadow Judge Card — Policy Invariance Score (v1.5.23+)

**Protocol**: policy-invariance
**Protocol version**: 1
**Reference**: [Weng, Feng, Xie 2026-05-07, arXiv:2605.06161](https://arxiv.org/abs/2605.06161)
"Beyond Accuracy: Policy Invariance as a Reliability Test for LLM Safety Judges"

## What this document is

The Judge Card is a single-artifact reliability report on Shadow's compliance council. It replaces the ad-hoc "trust us, we tested it" claim that most LLM-judge products publish with three named, computable, verifiable metrics that any auditor can reproduce from the source code in `lib/policy-invariance.js`.

Every metric here is in [0, 1]. Higher is better. The Judge Card gets published alongside every Shadow release + also bound into the Ed25519 attestation as `policy_invariance_score_sha256`, so a bank auditor pinning a Judge Card in a procurement contract catches any post-hoc drift.

## The three metrics

### 1. Rubric-Semantics Score

Fraction of verdicts that stay identical across four certified-equivalent rewrites of the input:

- **whitespace_perturbation** — JSON round-trip with different whitespace
- **field_reorder** — top-level keys reversed
- **numeric_restatement** — numeric fields perturbed by float-epsilon
- **synonym_preserved** — reversible synonym substitution on free-text fields (rationale, notes)

None of these transformations changes a regulator-observable input. If a verdict flips, the judge is unreliable in a way an auditor can prove structurally.

Weng et al. document up to **9.1% flip rate** on the state of the art. Shadow's target is **1.00 (zero flips)** because the deterministic 5-voice council is by-construction rewrite-invariant. The LLM council path targets **≥ 0.95** and reports family-by-family so procurement can see WHICH rewrite family flips.

### 2. Rubric-Threshold Score

Fraction of decisions where a **stricter** policy did NOT produce a **more approving** verdict than a **looser** policy. Formally, under the rank order `approve < escalate < block`, the lenient verdict must NOT exceed the strict verdict.

The failure mode this catches: an LLM judge that becomes tighter under a looser rubric. Weng et al. show this happens on 18-43% of unambiguous cases in judges shipped as "reliable". Shadow's deterministic council is monotone by construction (thresholds are numeric ceilings), so the score is 1.00. The LLM council path targets **≥ 0.98**.

### 3. Ambiguity-Aware Calibration Score

Fraction of **unambiguous** cases where verdicts stay identical across all four rewrite families. Ambiguous cases are excluded from the denominator so a genuinely close call (a DTI ratio one basis point above the 0.36 cap) doesn't drag the score down.

Ambiguity is heuristically detected via signal phrases in persona rationales: `close call`, `boundary`, `on the edge`, `edge case`, `just above`, `just below`, `borderline`, `near the threshold`, `marginally`, `on the line`. See `AMBIGUITY_SIGNALS` in `lib/policy-invariance.js` for the canonical list.

### Overall

The overall score is the **geometric mean** of the three individual metrics. This choice matters: a single low score drags the overall down, so a judge cannot mask one bad axis with two good ones. This is Weng et al.'s recommended headline metric.

## How to compute a Judge Card

Every Shadow release ships `lib/policy-invariance.js` with pure functions. A caller:

1. Runs the baseline case through `runLoanCouncil(input)`.
2. Applies each of the four rewrites via `applyAllRewrites(input)` and runs each variant.
3. Applies threshold shifts (strict rubric → lenient rubric) and runs each pair.
4. Feeds the responses to `buildJudgeCard({ baseline, rewriteResponses, thresholdShifts })`.
5. Serializes the result to JSON, computes its SHA-256, and passes it to `buildAttestation({..., policyInvarianceScoreSha256: ...})` so the score is Ed25519-signed into the attestation.

The full sequence takes ~250ms for the deterministic council path with zero LLM calls. The LLM council path scales with the number of rewrites x threshold-shift pairs and typically costs $0.05-$0.30 per Judge Card.

## Target thresholds

Bank procurement teams pin these in RFP scoring:

| Metric | Deterministic Council Target | LLM Council Target |
|---|---|---|
| Rubric-Semantics Score | 1.00 | ≥ 0.95 |
| Rubric-Threshold Score | 1.00 | ≥ 0.98 |
| Ambiguity-Aware Calibration Score | 1.00 | ≥ 0.90 |
| Overall (geometric mean) | 1.00 | ≥ 0.94 |

Any run below the LLM council target triggers a CI-blocking test failure in `test/policy-invariance-score.test.js`.

## Why this matters for procurement

Before v1.5.23, Shadow's reliability claim was "verdict-invariant under structural perturbation" (v1.5.21) plus "prompts hash-bound in attestation" (v1.5.8). Both are necessary. Neither is a named academic metric a bank RFP can drop into scoring.

Adopting Weng et al.'s exact protocol turns Shadow's existing moat into a citable label that competitors like Comply.ai and Holistic AI Guardian have to match. Because the metric definition is fixed in a public arXiv paper + implemented as pure functions here, no vendor can quietly weaken the semantics.

## Reproducibility

Every Judge Card includes:

- `protocol_version` — pinned to 1 for this schema.
- `reference` — pinned to `arXiv:2605.06161`.
- `n_rewrites` and `n_threshold_shifts` — the actual sample sizes at compute time.
- `rubric_semantics_by_family` — the per-family breakdown so an auditor can spot a synonym-preserving rewrite that keeps flipping while whitespace stays stable.
- The Judge Card SHA-256 goes into the Ed25519 attestation payload as `policy_invariance_score_sha256`. Post-hoc edits break verification. Bank counsel pins that hash in the procurement contract.

## Related Shadow primitives

- `test/verdict-invariance.test.js` (v1.5.21) — Shadow's structural invariance test, precedes the semantic invariance protocol.
- `lib/attestation.js` — Ed25519 signing with append-only payload fields, `policy_invariance_score_sha256` added in v1.5.23.
- `docs/CITATION_MAP.md` — every Shadow reliability claim mapped to a regulatory or arXiv citation.
