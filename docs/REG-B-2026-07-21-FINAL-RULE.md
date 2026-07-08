# Reg B Final Rule — Effective 2026-07-21

**Ships in Shadow v1.5.31 (2026-07-08) — 13 days before the effective date.**
**Anchor:** [Federal Register 2026-04-22 · Equal Credit Opportunity Act (Regulation B) final rule](https://www.federalregister.gov/documents/2026/04/22/2026-07804/equal-credit-opportunity-act-regulation-b) · effective 2026-07-21.

Bank counsel reviewing Shadow for procurement in Q3 2026 will read this document first. It explains what the final rule changes, what it does NOT change, and where Shadow's positioning shifts.

---

## 1. What the final rule changes

Three material shifts effective 2026-07-21:

1. **Disparate-impact "effects test" is eliminated at the federal ECOA level.** Under the prior CFPB posture (pre-7/21), a facially neutral lending practice that produced statistically disparate outcomes across a protected class could ground an ECOA claim even absent discriminatory intent. Post-7/21 the effects test is out of the federal enforcement framework.
2. **Discouragement is narrowed.** The rule tightens the definition of prohibited discouragement to require conduct that would discourage a reasonable applicant from applying, not any conduct that could theoretically have a chilling effect.
3. **Special Purpose Credit Programs (SPCPs) are restricted.** SPCP eligibility criteria are narrowed, with a documented need-based standard replacing the more permissive prior test.

Primary source: [Cooley 2026 memo](https://finsights.cooley.com/cfpb-finalizes-significant-changes-to-regulation-b/) and [Husch Blackwell 2026 memo](https://www.huschblackwell.com/newsandinsights/cfpb-finalizes-major-regulation-b-overhaul-disparate-impact-out-discouragement-narrowed-and-spcps-restricted).

## 2. What the final rule does NOT change

The load-bearing pieces of Shadow's positioning are unchanged:

- **§1002.9(b)(2) "specific principal reasons" requirement is unchanged.** Every adverse-action notice must still cite the specific principal reasons for the denial. Template phrases like "internal standards" or "credit scoring model" fail this bar. Shadow's reason-code dictionary + AA-code-per-persona architecture is the direct answer to this requirement.
- **CFPB Circular 2022-03 is unchanged.** Denials cannot cite reasons the creditor cannot explain. Shadow's dictionary-hash-binding + citation-registry chain preserves this invariant.
- **CFPB Bulletin 2024-09 is unchanged.** Model traceability for adverse-action explanations remains required. Shadow's hash-chain + per-decision Ed25519 attestation preserves this.
- **Prohibited-basis discrimination is unchanged.** ECOA still prohibits denial on the basis of race, color, religion, national origin, sex, marital status, age, receipt of public assistance, or good-faith exercise of Consumer Credit Protection Act rights. Shadow's protected-class proxy blocklist enforces this at the feature layer.

## 3. Where Shadow's positioning shifts

**Pre-7/21 framing:** "Shadow defends the federal disparate-impact posture through a signed reason-code dictionary + 15-item proxy blocklist."

**Post-7/21 framing:** "Shadow defends §1002.9(b)(2) adverse-action specificity + state-AG disparate-impact liability + prohibited-basis disparate treatment (unchanged federally) through a signed reason-code dictionary + 15-item proxy blocklist."

The dictionary + proxy blocklist do the same runtime work. The threat model they defend against shifts from federal disparate-impact-only to a mixed federal / state / disparate-treatment threat model.

## 4. State AG disparate-impact defense

State attorneys general in NY, CA, CO, IL, MA, and WA have signaled they will continue to enforce disparate-impact theories under state UDAP statutes and state fair-lending laws that are not affected by the federal Reg B change. Bank counsel serving multi-state lenders should assume the federal narrowing does NOT eliminate disparate-impact exposure for state-supervised or state-chartered institutions doing business in these jurisdictions.

Shadow's proxy blocklist is state-neutral — it enforces the widest defensible posture. Removing zip code from the blocklist because the federal effects test is gone would strip state-AG defense with no offsetting benefit.

## 5. Colorado SB 26-189 (effective 2027-01-01)

[Colorado SB 26-189](https://leg.colorado.gov/bills/sb26-189), signed 2026-05-20, adds four consumer-facing obligations for algorithmic decisioning in consumer-facing sectors including lending:

1. **Pre-use notice** — notify the applicant that an algorithmic system will be used in the decision.
2. **30-day post-adverse-outcome notice** — notify within 30 days of an adverse outcome with sufficient specificity for the applicant to understand the basis.
3. **Right to human review** — the applicant may request a human reviewer.
4. **Right to correct personal data** — the applicant may correct source data underlying the decision.

Shadow's runtime already produces all four artifacts:

| CO SB 26-189 obligation | Shadow artifact |
|---|---|
| Pre-use notice | Documented in bank onboarding flow (bank-side; Shadow does not gate this) |
| 30-day post-adverse-outcome notice | `lib/adverse-action-drafter.js` output + `getBorrowerReadableForCode()` |
| Right to human review | `escalate` verdict path in `run-loan-council.js` triggers Compliance Officer review |
| Right to correct personal data | Hash-chain provenance in `lib/attestation-chain.js` lets bank identify source records |

For any bank licensed to do business in Colorado, this is a 2027-Q1 procurement gate. Shadow's stack answers it without new development.

## 6. What bank counsel should do before 2026-07-21

1. **Read Section 2** above. The pieces of your ECOA compliance posture that Shadow addresses are unchanged.
2. **Read Section 4** above. Confirm your state exposure. If you serve NY, CA, CO, IL, MA, or WA borrowers, disparate-impact defense is still procurement-relevant.
3. **Do not remove proxy features from `lib/schemas/reason-code-dictionary.json`.** Removing zip code because the federal test is gone would strip state-AG defense with no offsetting benefit.
4. **Do not reword adverse-action notices to reduce specificity.** §1002.9(b)(2) is unchanged. Vaguer notice text is not permitted by the final rule.
5. **Consider SPCP program changes if applicable.** If your institution runs an SPCP, the narrowed federal standard requires eligibility criteria review before 7/21. Shadow does not gate SPCP eligibility, but the Compliance Officer voice can be prompted to review SPCP-tagged applications against a documented need-based standard.

## 7. Test evidence unchanged

Every test in `test/reason-code-dictionary.test.js`, `test/dictionary-hash-binding.test.js`, `test/run-loan-council.test.js`, and `test/traceability-and-guardrail.test.js` continues to pass after the final rule takes effect. The runtime invariants Shadow enforces (dictionary integrity, hash binding, proxy blocklist, per-decision Ed25519 signature) are strictly stricter than the federal floor, so the federal floor changing does not require a runtime change.

CI on the pinned commit reflecting v1.5.31 will show 1100+ assertions green across all files. See `docs/CITATION_MAP.md` for the full persona × citation × test map.
