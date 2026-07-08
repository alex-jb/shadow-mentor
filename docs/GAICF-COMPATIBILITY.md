# Shadow x GAICF Compatibility Matrix

**Reference**: [Wang, Kang, Lin, Mao 2026-07-05 arXiv:2607.04103](https://arxiv.org/abs/2607.04103) "Governing Generative AI Across Financial Institutions: An SR 26-2-Compatible Framework for Generative AI Risk Control"

The GAICF (Generative AI Control Framework) proposal names three governance layers that any SR 26-2 Tier 3 GenAI system in a regulated bank should have. Shadow ships all three as of v1.5.24. This document maps each layer to the specific Shadow module + test file so a procurement reviewer can pin each requirement to a passing contract test.

## The three layers

| GAICF layer | Shadow module | Test file | Attestation binding | Status |
|---|---|---|---|---|
| **L1 Monitoring-interpretation controls** | `lib/run-loan-council.js` + `lib/prompts.js` (5-voice council) + `lib/enforce-reason-code-dictionary.js` | `test/loan-council.test.js` + `test/enforce-reason-code-dictionary.test.js` | `dictionary_hash` (v1.5.8) | LIVE since v1.4.0 |
| **L2 Policy analysis workflows** | `lib/traceability.js` + `lib/citation-registry.js` + `lib/citation-scanner.js` + `lib/personas/trader-pack/*` + `lib/personas/ds-pack/*` | `test/traceability.test.js` + `test/citation-registry.test.js` + `test/trader-pack-*.test.js` + `test/ds-pack-*.test.js` | `citation_registry_sha256` (v1.5.18) + `policy_invariance_score_sha256` (v1.5.23) | LIVE across v1.5.11 to v1.5.23 |
| **L3 Adverse-action language drafting** | `lib/adverse-action-drafter.js` | `test/adverse-action-drafter.test.js` | `adverse_action_notice_sha256` (v1.5.24) | **LIVE as of v1.5.24 (2026-07-08)** |

## Why this matters

Before v1.5.24, Shadow shipped L1 + L2 but not L3. Bank counsel had to draft the §1002.9(b)(2) notice separately from Shadow's verdict, which is where the largest CFPB liability tail sits. A council decision could be perfect on the crypto + citation side and still result in a §1002.9(b)(2) fine if the downstream notice used a template phrase the CFR explicitly names as insufficient.

`lib/adverse-action-drafter.js` closes that gap: every AA01-AA06 code emitted by `runLoanCouncil` maps deterministically to a §1002.9(b)(2)-compliant, bilingual (§1002.4), citation-grounded notice text. The notice SHA-256 is bound into the Ed25519 attestation so any post-hoc softening breaks verification.

## Baked-in refusal invariants

The drafter refuses to emit a notice in three cases. Each refusal is a defense-in-depth boundary a downstream LLM cannot bypass:

1. **No primary-source ground.** If an AA code has zero `valid_for_aa_codes` matches in `citation-registry.json`, the drafter throws. This prevents ungrounded notices from ever reaching a borrower.
2. **§1002.6(b) protected-class term in the reason sentence.** The reason sentence is audited with word-boundary matching against the ECOA protected-class enumeration (race / color / religion / national origin / sex / marital status / age / public assistance). Any hit throws. The rights block quotes 15 U.S.C. §1691 verbatim per §1002.9(b)(1), so those terms are intentionally allowed there but not in the reason.
3. **§1002.9(b)(2) insufficient template phrase.** The audit also refuses phrases the CFR itself names as insufficient: "internal standards", "internal policies", "did not achieve a qualifying score", "credit scoring system". Any hit throws.

Each refusal path has a matching regression test in `test/adverse-action-drafter.test.js`.

## Attestation binding

`lib/attestation.js` gains a sixth append-only field `adverse_action_notice_sha256` when the caller passes `adverseActionNoticeSha256` to `buildAttestation()`. Same back-compat pattern as `dictionary_hash` (v1.5.8), `citation_registry_sha256` (v1.5.18), `proxy_schema_sha256` (v1.5.19), `original_content_hash` (v1.5.20), `policy_invariance_score_sha256` (v1.5.23). Pre-v1.5.24 attestations verify unchanged.

## Bank-buyer implication

This unlocks any ECOA-regulated origination customer (all 30 on `docs/sales-30-target-banks.md`). AA drafting is the highest-liability compliance function per CFPB fine history: the largest ECOA fines have all been §1002.9(b)(2) failures, not underwriting failures. Removing that friction means the Shadow deploy timeline shrinks from "6-week integration + counsel-drafted notice template" to "1-week integration + Shadow-emitted notice text signed with the verdict."

Also unlocks academic-cited procurement: bank RFPs increasingly ask for arXiv-paper anchors on named controls. Wang et al 2607.04103 is now a citable anchor for Shadow L3.

## Related Shadow primitives

- `docs/JUDGE-CARD.md` (v1.5.23) — the reliability metric protocol per Weng et al 2605.06161
- `docs/CITATION_MAP.md` — Lora Levitchi's regulatory-citation-to-test triple map
- `docs/arxiv-citation-map.md` — the running arXiv index (add §12 for 2607.04103)
- `docs/NIST-AI-600-1-MAP.md` — federal contractor market opener
