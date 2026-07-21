# Persona deliberation → evidence-grounded synthesis

The question: **how does Shadow combine several analytical perspectives without pretending that voting
creates truth?** Explainer: `demos/animations/persona-deliberation.html`; fixture:
`fixtures/animations/persona-deliberation.json`; tests: `test/persona-deliberation.test.js`.

## Personas are configured analytical perspectives — not experts
The five perspectives (Credit Fundamentals, Risk Officer, Fair Lending Compliance, Customer Advocate,
Macro Contrarian) are **configured analytical lenses on the same evidence**, not independent human experts
and not human reviewers. The page states this permanently. Consequences enforced by the logic + tests:
- **`stance_strength` is a persona prior, NOT statistical confidence.** The word "confidence" appears only
  in the disclaimer "more agreeing personas do not create statistical confidence".
- **Persona count is not statistical confidence; majority is not correctness.** `MAJORITY_AGREEMENT` is
  descriptive metadata; it never sets `ANALYTICAL_CORRECTNESS` (which stays `NOT EVALUATED`).
- **A Fair Lending Compliance perspective is not a completed legal/fairness review.** `LEGAL_FAIRNESS_REVIEW`
  stays `NOT EVALUATED`; `HUMAN_APPROVAL` stays `NOT PRESENT` / `REQUIRES HUMAN REVIEW`.

## Synthesis rules (deterministic, no live LLM)
- A claim with no resolving evidence is **excluded** from the grounded synthesis (`UNSUPPORTED_CLAIMS` = WARNING).
- An unresolved evidence reference produces a `SOURCE_RESOLUTION` warning.
- **Contradictory evidence is preserved, not hidden** (`CONTRADICTORY_EVIDENCE` = WARNING).
- **Abstention is preserved** (`ABSTENTION` = ABSTAINED) — the system does not force a verdict.
- **Disagreement is shown** (opposing stances → `MAJORITY_AGREEMENT` = WARNING).
- Majority count is descriptive only and never changes a correctness status.
- Every synthesis sentence traces to a claim + resolving evidence (`SYNTHESIS_PROVENANCE`).
- When evidence is weak/insufficient the synthesis states **INSUFFICIENT EVIDENCE TO CONCLUDE** rather than
  manufacturing a verdict.

## Scenarios (each flags a specific first check)
consensus-with-evidence (none) · disagreement (`MAJORITY_AGREEMENT`) · unsupported-claim (`UNSUPPORTED_CLAIMS`)
· contradictory-evidence (`CONTRADICTORY_EVIDENCE`) · abstain (`ABSTENTION`) · **majority-but-weak-evidence
(`CLAIM_EVIDENCE_BINDING`)** — the anti-pattern guard: majority PRESENT, but synthesis must not claim
verified correctness.

## What integrity verification proves — and does not
Proves: the personas shared the same evidence; each grounded claim resolves to evidence; the synthesis
traces to claims + evidence; unsupported/contradictory/abstention are surfaced. Does **not** prove the
conclusion is correct, adequate, fair, or legal — those are `NOT EVALUATED`. No `TRUSTED`/`COMPLIANT`.

## Later
- **Maps to Shadow's 5-voice council** (`lib/run-loan-council.js`): the same voices, `stance_strength` =
  the persona prior (already labeled STANCE STRENGTH, not confidence), and the same grounded-synthesis +
  preserve-dissent rules. Integration = emit each voice's claim/stance/evidence into this scene contract.
- **Reuse in Three.js / Unity**: the fixture is a story scene; a Three.js / Unity adapter renders the same
  personas/claims/evidence/statuses (positions may differ; semantics may not) — see EXPLAINER_INTEGRATION_PLAN.md.
- **Not yet done**: no user study; it is **not** demonstrated that more personas improve conclusion quality.
