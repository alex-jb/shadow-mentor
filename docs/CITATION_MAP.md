# Regulatory Citation × Persona × Test Map

**Version:** 1.2 · **Generated:** 2026-07-06 · **Last updated:** 2026-07-08 (Reg B final rule pivot + Colorado SB 26-189 column) · **Framework:** SR 26-2 Tier 3 companion control (effective 2026-04-17) + Reg B final rule (effective 2026-07-21)

**Authority:**
- Loredana C. Levitchi — BRD + Addenda A/B/C banking domain grounding, regulatory citation review, 4-layer procurement structure (2026-07-06 Test Stack contribution)
- Alex Xiaoyu Ji — schema mapping, test coverage extraction, cryptographic attestation binding

**Purpose:** This document is the procurement-audience map from Shadow's runtime personas to (1) the specific regulatory citations each voice is tested against and (2) the exact test files that exercise each citation. Bank counsel opening the repo can trace a regulatory obligation to a Shadow persona to a runtime test, all in one traversal.

**How to read this document:** every row is a triple `<persona, citation, test file>` and represents a defended invariant. If a bank auditor asks *"does Shadow's Fair Lending Compliance voice test the CFPB Bulletin 2024-09 model-traceability requirement?"* the answer is row-lookup, not code archaeology.

**Also available as `docs/CITATION_MAP.csv`** for procurement counsel who want to filter / sort / import into a GRC system.

---

## 0. Recommended procurement format — 4-layer structure

*Structure contributed by Loredana C. Levitchi (2026-07-06 Test Stack package).*

Bank counsel who want to audit Shadow's regulatory posture should read the material in four layers, top-to-bottom. Each layer answers a specific counsel question and points to the underlying artifact.

**Layer 1 — Persona-to-Regulation Mapping.** *"Which Shadow voice tests which regulation?"* Read Section 2 of this document (or `docs/CITATION_MAP.csv` if you prefer a spreadsheet). Every row is `<persona, citation, control objective, exact test file, assertion>`. Nothing is aspirational — every test named here runs in CI on every merge.

**Layer 2 — Canonical Attestation Regression.** *"Is the signed record I'm reviewing untampered?"* Every Shadow decision produces an Ed25519-signed attestation (RFC 8032) with a canonical payload defined in `lib/attestation.js`. The same canonical payload is re-verified byte-for-byte by the Python `shadow_verify` library on Python 3.9-3.13 in CI. Cross-language drift is the load-bearing invariant — see `test/python-verify-cross-lang.test.js` + Python `shadow-verify/tests/`.

**Layer 3 — Evidence Binder.** *"Where is the reproducible proof that CI passed for this specific commit?"* GitHub Actions test log for the pinned commit + npm test output + pytest output + `benchmark/history/SUMMARY.md` for the Shadow Agentic Score history. Every regression in a Layer 1 test blocks the merge gate, so the evidence binder is not aspirational — it is enforced by branch protection.

**Layer 4 — Compliance Narrative.** *"Why does each persona exist and what regulatory risk does it control?"* Read Section 1 (Persona Overview) below. Each persona has one role, one AA-code assignment, and one L3 source document. If counsel wants a longer narrative, see `docs/BRD_ALIGNMENT.md` for the source separation principle.

The 4-layer structure gives counsel four different navigation paths for four different audit questions. Reading only Layer 1 is enough for a rubric-level compliance review. Reading Layer 1 + Layer 4 is enough for procurement approval. Layers 2 + 3 exist for the deeper technical audit that follows sign-on.

---

## 1. Persona Overview

| Persona | Role | AA Codes | L3 Source Document |
|---|---|---|---|
| **Credit Fundamentals** | Underwriter — evaluate borrower creditworthiness against institutional floors | AA01, AA02 | Addendum A (Credit Policy) + Addendum B (DTI Policy) |
| **Risk Officer** | Portfolio VaR + concentration + LTV — institutional-side risk appetite | AA03, AA04 | Addendum C (LTV Policy) + Risk Appetite Note |
| **Fair Lending Compliance** | ECOA / Reg B disparate-impact + adverse-action notice compliance | AA05 | BRD Governance Controls (ECOA / Reg B integration) |
| **Customer Advocate** | Adverse-action explanation quality + borrower-facing readability | (escalates all) | CFPB Bulletin 2024-09 (model traceability) |
| **Macro Contrarian** | Sector cycle + recession sensitivity — devil's advocate | (none) | Institutional risk appetite note (sector-cycle overlay) |
| **AML/KYC Investigator** (opt-in) | AML / Sanctions / KYC — regulatory eligibility | AA06 | BSA + USA PATRIOT §326 + FinCEN CDD (31 CFR 1010.230) + OFAC 50% rule |

The AML/KYC voice is opt-in: it attaches only when the loan payload contains `aml_flags[]` or `kyc_status` fields (per `lib/aml-kyc-voice.js` AML_FLAG_POLICY + KYC_STATUS_POLICY).

---

## 2. Citation × Persona × Test File Map

### 2.1 US federal banking supervision

| Citation | Full name | Persona(s) enforcing | Primary test file | Test count |
|---|---|---|---|---|
| **SR 26-2** | Federal Reserve Model Risk Management Guidance (formerly SR 11-7, replaced 2026-04-17) | All 6 | `test/traceability-and-guardrail.test.js` | 19 |
| **SR 11-7 (rescinded)** | Predecessor to SR 26-2 — retained in `lib/traceability.js:33` as historical annotation for legacy audit trails | All 6 | `test/traceability-and-guardrail.test.js` | 19 |
| **CFPB Circular 2022-03** | Requires denials to cite the specific policy source, no template phrases | Fair Lending + Customer Advocate | `test/reason-code-dictionary.test.js` | 17 |

### 2.2 Fair lending / ECOA / Reg B (Regulation B)

| Citation | Full name | Persona | Primary test file(s) | Test count |
|---|---|---|---|---|
| **ECOA** | Equal Credit Opportunity Act — prohibited-basis analysis | Fair Lending Compliance | `test/run-loan-council.test.js` | 15 |
| **Reg B (12 CFR 1002)** | ECOA implementing regulation — adverse action notice requirements | Fair Lending Compliance | `test/reason-code-dictionary.test.js` + `test/run-loan-council.test.js` | 17 + 15 |
| **Reg B adverse-action codes AA01-AA06** | Signed reason-code dictionary — post-hoc dictionary swap breaks attestation verification (v1.5.8) | Fair Lending Compliance + Credit + Risk + AML/KYC | `test/dictionary-hash-binding.test.js` + `test/reason-code-dictionary.test.js` | (bound) + 17 |
| **CFPB Bulletin 2024-09** | Model-traceability for adverse-action explanations | Customer Advocate | `test/traceability-reproducibility.test.js` | 14 |
| **Protected-class proxy blocklist** | 15-item ECOA proxy attribute blocklist enforced in `lib/enforce-reason-code-dictionary.js` | All 6 | `test/reason-code-dictionary.test.js` | 17 |
| **Reg B final rule (effective 2026-07-21)** | Eliminates federal disparate-impact "effects test"; narrows discouragement; restricts SPCPs. **§1002.9(b)(2) specificity + prohibited-basis disparate treatment unchanged.** See `docs/REG-B-2026-07-21-FINAL-RULE.md`. Runtime behavior unchanged; threat model reposition documented. | All 6 | `test/reason-code-dictionary.test.js` + `test/dictionary-hash-binding.test.js` | 17 + (bound) |

### 2.2.1 State AI / algorithmic-decisioning laws (state-AG defense)

| Citation | Full name | Persona | Primary test file(s) | Test count |
|---|---|---|---|---|
| **Colorado SB 26-189** (effective 2027-01-01) | Pre-use notice + 30-day post-adverse-outcome notice + right to human review + right to correct personal data | Customer Advocate + Fair Lending Compliance | `test/adverse-action-drafter.test.js` + `test/attestation-chain.test.js` | (existing coverage) |
| **NY / CA / IL / MA / WA state UDAP + fair-lending** | State-AG disparate-impact enforcement unaffected by federal Reg B narrowing. Protected-class proxy blocklist enforces state-neutral posture. | All 6 | `test/reason-code-dictionary.test.js` | 17 |

### 2.3 AML / KYC / Sanctions (opt-in AML/KYC voice)

| Citation | Full name | Persona | Primary test file(s) | Test count |
|---|---|---|---|---|
| **BSA (Bank Secrecy Act)** | 31 USC 5311 — recordkeeping + reporting | AML/KYC Investigator | `test/aml-kyc-voice.test.js` | 24 |
| **BSA §5318(g)(2) — tipping-off** | Borrower-facing rationale must NOT name specific SAR-related AML flag | AML/KYC Investigator | `test/aml-kyc-adversarial.test.js` | 23 |
| **USA PATRIOT Act §326** | Customer Identification Program (CIP) — CDD verification | AML/KYC Investigator | `test/aml-kyc-voice.test.js` | 24 |
| **FinCEN Customer Due Diligence rule** | 31 CFR 1010.230 — beneficial ownership + risk-based CDD program | AML/KYC Investigator | `test/aml-kyc-voice.test.js` | 24 |
| **OFAC SDN list match** | Sanctions program — Specially Designated Nationals list | AML/KYC Investigator | `test/aml-kyc-adversarial.test.js` | 23 |
| **OFAC 50% rule** | Sanctions ownership aggregation | AML/KYC Investigator | `test/aml-kyc-voice.test.js` | 24 |
| **FinCEN 2026-Q1 GTOs** | Geographic Targeting Orders — extended coverage | AML/KYC Investigator | `test/aml-kyc-voice.test.js` | 24 |
| **FATF Recommendation 10** | International CDD framework — risk-based approach | AML/KYC Investigator | `test/aml-kyc-voice.test.js` | 24 |

### 2.4 EU credit-scoring regime

| Citation | Full name | Persona | Primary test file(s) | Test count |
|---|---|---|---|---|
| **GDPR Article 22** | Automated individual decision-making + right to meaningful information | Fair Lending + Customer Advocate | `test/reason-code-dictionary.test.js` | 17 |
| **ECJ Schufa case (C-634/21)** | 2023 ruling — credit scoring qualifies as "automated decision" under Article 22 | Fair Lending + Customer Advocate | `test/traceability-reproducibility.test.js` | 14 |
| **EU AI Act Article 14 — human oversight** | High-risk system oversight — audit trail export requirements | All 6 | `test/attestation-acceptance-demo.test.js` | (chain) |
| **EU AI Act — credit-scoring deferral to 2027-12-02** | Digital Omnibus Regulation 2026-05 pushed credit-scoring deadlines | (context only) | (documented in `docs/EU_AI_ACT_STATUS.md`) | N/A |

### 2.5 Investor conduct / suitability (advisor pack)

| Citation | Full name | Persona | Primary test file(s) | Test count |
|---|---|---|---|---|
| **Reg BI (Regulation Best Interest)** | Broker-dealer suitability standard — fiduciary verdict engine | (advisor pack, roadmap) | `test/persona-schema.test.js` (schema anchor test) | 14 |
| **FINRA Rule 2111** | Suitability requirements | (advisor pack, roadmap) | (persona schema anchor: `Reg BI`) | (via schema) |

### 2.6 Cryptographic attestation invariants

| Citation | Full name | Persona-independent | Primary test file(s) | Test count |
|---|---|---|---|---|
| **RFC 8032 (Ed25519)** | Edwards-Curve Digital Signature Algorithm — SR 26-2 Tier 3 attestation binding | (all decisions) | `test/attestation-ed25519.test.js` + `test/attestation.test.js` | 13 + 20 |
| **Dictionary-hash binding (v1.5.8)** | Reason-code dictionary SHA-256 signed into every attestation payload — post-hoc dictionary edit breaks verification | (all decisions) | `test/dictionary-hash-binding.test.js` | (dedicated file) |
| **Hash-chain integrity (v1.5.10)** | `previous_hash` chain — detects reordering / insertion / truncation / edit-cascade | (all decisions) | `test/attestation-chain.test.js` | 22 |
| **Schema-runtime coherence (v1.5.11)** | Persona L1/L2/L3 thresholds pinned against runtime `LOAN_DEFAULTS` — silent prompt drift blocked | All 6 | `test/schema-runtime-coherence.test.js` | 48 |
| **Cross-language Node ↔ Python verifier** | `shadow_verify` Python library replicates Node signing payload byte-for-byte | (all decisions) | `test/python-verify-cross-lang.test.js` | (cross-lang) |

### 2.7 Adversarial / red-team invariants

| Citation | Full name | Persona | Primary test file(s) | Test count |
|---|---|---|---|---|
| **MCPTox canary tokens (arXiv:2508.14925)** | Prompt-injection detection at council output boundary | All 6 | `test/mcptox-canary.test.js` | (dedicated) |
| **Free-MAD hallucination amplification (arXiv:2509.11035)** | Provider diversity — never silently substitute providers during diverse routing | All 6 | `test/provider-diversity.test.js` | 18 |
| **Hidden-anchor bias (arXiv:2606.19494)** | Randomize persona presentation order to defeat position bias | All 6 | `test/presentation-order.test.js` | 12 |
| **Analysis-only guardrail** | 12-pattern regex catches hallucinated trade-execution verbs at council output | All 6 | `test/traceability-and-guardrail.test.js` | 19 |

---

## 3. Persona × Citation Coverage Matrix

| Persona | US federal (SR 26-2, CFPB) | ECOA / Reg B | AML / KYC / OFAC | EU (GDPR, Schufa) | Reg BI | Ed25519 / Hash-chain | Adversarial |
|---|---|---|---|---|---|---|---|
| **Credit Fundamentals** | ✅ | ✅ | — | ✅ (via reason codes) | (roadmap) | ✅ | ✅ |
| **Risk Officer** | ✅ | ✅ (LTV via AA03/AA04) | — | ✅ | (roadmap) | ✅ | ✅ |
| **Fair Lending Compliance** | ✅ | ✅ (primary) | — | ✅ (primary) | (roadmap) | ✅ | ✅ |
| **Customer Advocate** | ✅ (Bulletin 2024-09) | ✅ | — | ✅ (Schufa case) | (roadmap) | ✅ | ✅ |
| **Macro Contrarian** | ✅ | — | — | — | (roadmap) | ✅ | ✅ |
| **AML/KYC Investigator** (opt-in) | ✅ | ✅ (AA06) | ✅ (primary) | — | — | ✅ | ✅ |

**Legend:** ✅ = covered by named runtime test; — = not applicable to persona role; (roadmap) = advisor pack shipping post-Reg BI vertical launch.

---

## 4. Test count summary

- **Total runtime tests:** 668 (v1.5.11)
- **AML/KYC coverage (voice + adversarial):** 47 tests (24 + 23)
- **Attestation cryptographic coverage:** 55+ tests (Ed25519 + hash-chain + dictionary-hash binding + cross-language)
- **Reg B reason-code dictionary coverage:** 17 tests (`test/reason-code-dictionary.test.js`)
- **Persona schema × runtime coherence gate:** 48 tests (`test/schema-runtime-coherence.test.js`)
- **Provider diversity + hallucination amplification defense:** 18 tests (`test/provider-diversity.test.js`)

Full test surface: run `npm test` at repository root. All 668 tests currently pass, zero regressions across v1.5.7 to v1.5.11.

---

## 5. Reviewer notes

**For bank counsel / regulatory examiner:** the *citations* in Section 2 are the regulatory obligations. The *tests* named in each row are the deterministic invariants Shadow ships to defend that obligation at runtime. A regression in any named test blocks the CI merge gate, so the coverage is not aspirational — it is enforced.

**For grad-school co-authors / academic collaborators:** this document is a live-updated appendix to any paper citing Shadow's runtime coverage. Please add a citation to `docs/CITATION_MAP.md` (this file) in the paper's methods section so reviewers can trace the empirical claim to the specific test file.

**For Lora specifically:** every row in Section 2 flows from your BRD + Addenda A/B/C. The rows we discussed on 2026-06-19 (FICO 700 hard block, DTI 0.36 escalate, Tier 3 SR 26-2 companion positioning) are all in Section 2.1 and 2.2. The dictionary-hash binding (v1.5.8) closes the Reg B post-hoc dictionary edit gap you flagged. The AML/KYC voice (v1.4.0) is opt-in per your July 2026 feedback that BSA §5318(g)(2) tipping-off must NOT be triggered when the loan payload doesn't declare `aml_flags[]` or `kyc_status`.

If any row is *missing*, mis-classified, or needs a stronger citation — please annotate this file directly and I will iterate. This map is the artifact bank auditors will read before they read the code.

---

## 6. Contact & feedback

- Alex Xiaoyu Ji · xji1@mail.yu.edu · schema mapping + test coverage + cryptographic binding
- Loredana C. Levitchi · regulatory citation authority + BRD + Addenda A/B/C

*This document is a public artifact of the shadow-mentor repository (MIT license). Re-use with attribution is encouraged.*
