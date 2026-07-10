# Shadow Threat Model — Systematized

**Ships in Shadow v1.5.35 (2026-07-08).**
**Anchor:** arXiv:2606.29142 — "Agent Security Meets Regulatory Reality: Systematization of Autonomous-Agent Threats in Regulated Financial Systems" (Mohan/Srinivasa, 2026-06-28).

The paper systematizes autonomous-agent threats into 6 categories with per-category regulatory obligation mapping from production KYC systems. This document maps each category to the Shadow control that defends against it AND documents what Shadow explicitly does NOT defend against, so bank counsel is not sold a false sense of coverage.

## Reading order

1. Table below — 6-row map from threat category → Shadow control → regulatory citation → test file → what's out of scope
2. § Refuse-to-serve populations — the paper's Table 4, translated to Shadow's `lib/refuse-to-serve.js`
3. § Explicit non-coverage — what Shadow does NOT defend against (honest positioning)

## 1. The 6-category systematization

| # | Threat category | Shadow control | Regulatory citation | Test file | What's out of scope |
|---|---|---|---|---|---|
| **T1** | Silent model / provider substitution | `sampling_seed_commitment_sha256` (v1.5.28) binds seed + temp + provider fingerprint into attestation. Substitution breaks Ed25519 verify. | CFPB Circular 2026-03 model traceability | `test/sampling-attestation.test.js` | Detection requires the caller to VERIFY the attestation. A caller who signs but never verifies gets no benefit. |
| **T2** | Adversarial peer in council (single voice compromised, debate amplifies) | `heterogeneity_commitment_sha256` (v1.5.32) requires 2+ providers; enforcement gate on `/api/deliberate` (v1.5.34) refuses deliberation when floor unmet. | arXiv:2606.19826 | `test/heterogeneous-debate.test.js` + `test/api-deliberate-heterogeneity.test.js` | Does NOT defend against a coordinated adversarial-tuning campaign across ALL providers simultaneously (nation-state actor level). |
| **T3** | Hallucinated regulatory citation (LLM invents a CFR section) | `citation_registry_sha256` (v1.5.18) binds signed citation registry; `enforce-reason-code-dictionary.js` rejects AA-codes not in the dictionary. | CFPB Circular 2022-03 | `test/reason-code-dictionary.test.js` + `test/citation-registry.test.js` | Does NOT defend against a real CFR section being mis-applied. That is a legal-interpretation question outside runtime scope. |
| **T4** | Post-hoc tampering with reason codes / thresholds / prompts | `dictionary_hash` (v1.5.8) + `proxy_schema_sha256` (v1.5.19) + `evidence_partition_scheme_sha256` (v1.5.30) — 8 append-only fields all bound in Ed25519 attestation. | 12 CFR 1002 (Reg B) + SR 26-2 audit trail | `test/dictionary-hash-binding.test.js` + `test/attestation.test.js` | Does NOT prevent the tampering — only DETECTS it at verify time. Prevention is the bank's IT-security control. |
| **T5** | Population automation cannot serve (OFAC / BSA tipping / statutory / geographic / product ineligibility) | `lib/refuse-to-serve.js` (v1.5.35) — REFUSAL_CATEGORY enum + non-discretionary response type. Distinguishes `refuse_to_serve` from `escalate`. | 31 USC 5318(g)(2) + 31 CFR 501.603 + 12 CFR 1002.7 | `test/refuse-to-serve.test.js` | Does NOT determine WHETHER a specific applicant is in a refuse-to-serve population. That determination requires KYC data outside Shadow's runtime. |
| **T6** | Reproducibility failure (auditor cannot re-derive the decision) | `reproducibility_manifest` (v1.5.33 + wire-in v1.5.34) — 5-axis JSON with `manifest_hash_sha256`. Auditor pins ONE hash. | arXiv:2606.08285 + CFPB Circular 2026-03 | `test/reproducibility.test.js` | Does NOT preserve the underlying LLM weights across model deprecations. When Anthropic sunsets `claude-sonnet-4-5-20250929`, that decision is architecturally irreproducible even with a matching manifest_hash. |

## 2. Refuse-to-serve populations (T5 detail)

Ships in `lib/refuse-to-serve.js` (v1.5.35). Distinguishes the two adverse-response classes that pre-v1.5.35 Shadow conflated:

- **`escalate`** — human review can proceed. Compliance officer discretion exists. AA-notice cites specific reasons.
- **`refuse_to_serve`** — no discretion. Statute or sanctions BAR service. AA-notice is minimal (no rich rationale) because rich rationale would either (a) imply discretion that doesn't exist, or (b) violate §5318(g)(2) tipping-off in the AML cases.

| Category | Non-discretionary bar | Regulatory citation |
|---|---|---|
| `OFAC_SDN_MATCH` | SDN list match or 50%-rule aggregate ownership | 31 CFR 501.603 + OFAC 50% rule + applicable EO |
| `BSA_TIPPING_OFF` | Refusal grounded in SAR filing — cannot disclose to borrower | 31 USC 5318(g)(2) + 31 CFR 1020.320(e) + FinCEN SAR Instructions |
| `STATUTORY_INELIGIBILITY` | Statutory gate applicant does not meet | Applicable federal/state statute + 12 CFR 1002.7 |
| `GEOGRAPHIC_INELIGIBILITY` | Institution not chartered in applicant's state | State licensing law + 12 USC 30 |
| `PRODUCT_INELIGIBILITY` | Product not offered under the terms described | Product-specific statute + institution product policy under BRD |

Borrower-facing notice text is intentionally identical across categories (OFAC + BSA specifically) to remove the side-channel where a borrower who receives multiple notices could infer which category they hit. Test `test/refuse-to-serve.test.js` pins this invariant.

## 3. Explicit non-coverage (honest positioning)

Shadow does NOT defend against:

1. **Coordinated cross-provider adversarial tuning** — if Anthropic + OpenAI + GLM + local Ollama models are ALL compromised in a coordinated attack, heterogeneity does not defend. This is a nation-state-actor threat model, out of scope.
2. **Mis-application of a real CFR section** — if the LLM correctly cites 12 CFR 1002.9(b)(2) but applies it to a wrong fact pattern, the citation registry cannot detect this. Legal-interpretation error is outside runtime scope.
3. **Prevention of post-hoc tampering** — Shadow detects tampering at verify time but does not prevent the tampering itself. The bank's IT-security control must handle at-rest tampering of the reason-code dictionary + citation registry + persona prompts.
4. **KYC data quality** — Shadow decides based on the KYC data the bank provides. If the bank provides bad data, Shadow produces a bad decision. GIGO. Data quality is upstream of Shadow.
5. **Model deprecation reproducibility** — when Anthropic sunsets `claude-sonnet-4-5-20250929`, a decision made with that model cannot be exactly reproduced even with a matching `manifest_hash_sha256`. The manifest still detects tampering; it does not resurrect deprecated weights.
6. **Discretion at compliance officer** — Shadow implements the `escalate` verdict; it does NOT implement the compliance officer's discretion. A compliance officer who blindly rubber-stamps every `escalate` verdict has stripped Shadow's value proposition.

## 4. Procurement questions bank counsel should ask

1. **Which of the 6 threat categories does the bank's exam framework specifically require coverage of?** Match Shadow's control against the exam question set.
2. **What is the bank's control for the "explicit non-coverage" list?** Shadow's positioning is honest — the non-coverage list is a set of REAL gaps. What does the bank do about T1-T6 gaps that Shadow does not close?
3. **How does the bank enforce `refuse_to_serve` verdicts operationally?** Shadow returns the structured response; the bank must wire it into loan-origination system + call center + web portal so the borrower never sees a "your application is being reviewed" message when Shadow returned `refuse_to_serve`.
4. **Which population-eligibility determinations happen upstream of Shadow?** Shadow's refuse-to-serve logic depends on the bank's KYC pipeline surfacing OFAC + BSA + statutory + geographic + product flags. Confirm the upstream pipeline supplies these flags.
5. **What is the bank's response when the reproducibility manifest fails?** If a decision from 6 months ago cannot be reproduced today (e.g. model deprecated, dictionary rotated), what does the bank do? Confirm the runbook exists.

## 5. Test evidence

Every T1-T6 row has a named test file. Every test in each file runs in CI on every merge. Test surface for the systematized threats:

| Row | Tests |
|---|---|
| T1 sampling substitution | `test/sampling-attestation.test.js` (15) |
| T2 adversarial peer | `test/heterogeneous-debate.test.js` (20) + `test/api-deliberate-heterogeneity.test.js` (6) |
| T3 hallucinated citation | `test/reason-code-dictionary.test.js` (17) + `test/citation-registry.test.js` (existing coverage) |
| T4 post-hoc tampering | `test/dictionary-hash-binding.test.js` + `test/attestation.test.js` (existing) |
| T5 refuse-to-serve | `test/refuse-to-serve.test.js` (14) |
| T6 reproducibility | `test/reproducibility.test.js` (13) |

Total v1.5.35 addition: 14 tests. Test surface 1139 → 1153.
