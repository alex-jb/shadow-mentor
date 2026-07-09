# BIAN Service Domain Coverage

**Ships in Shadow v1.5.39 (2026-07-08).**
**Anchor:** arXiv:2607.01740 — "Meta-Benchmarks for Financial-Services LLM Evaluation" (2026-07-02).

## Why bank counsel opens this doc first

Bank counsel evaluating Shadow does not natively recognize "5-voice council with 11 append-only cryptographic-attestation fields." They DO recognize BIAN service domains because BIAN v9 is the framework their core-banking vendors (Temenos, Finastra, TCS BaNCS, FIS Profile) already use to structure procurement RFPs.

This document maps every Shadow persona to the BIAN service domains it claims coverage of. Bank counsel can walk their internal governance framework top-to-bottom without translating from Shadow's homegrown taxonomy first.

## The mapping (signed via `bian_coverage_sha256`)

| Persona | Primary BIAN Domain | Additional Domains | Test file |
|---|---|---|---|
| **Compliance Officer** | Regulatory Compliance | Fair Lending & Consumer Protection · Model Risk Management | `test/reason-code-dictionary.test.js` + `test/traceability-and-guardrail.test.js` |
| **Fair Lending Compliance** | Fair Lending & Consumer Protection | Regulatory Compliance | `test/run-loan-council.test.js` + `test/reason-code-dictionary.test.js` |
| **Credit Fundamentals** | Credit Assessment | Credit Risk | `test/run-loan-council.test.js` |
| **Risk Officer** | Credit Risk | Portfolio Management · Model Risk Management | `test/risk-tools.test.js` + `test/attestation-chain.test.js` |
| **Customer Advocate** | Customer Servicing | Customer Interaction | `test/adverse-action-drafter.test.js` |
| **Macro Contrarian** | Stress Testing | Market Analysis | `test/verdict-invariance.test.js` |
| **AML/KYC Investigator** *(opt-in)* | AML / KYC / Sanctions Screening | Regulatory Compliance | `test/aml-kyc-voice.test.js` + `test/aml-kyc-adversarial.test.js` |

Every persona has ≥1 primary + ≥0 additional BIAN domain assignment. Zero-coverage is an invariant violation the `auditBianCoverage()` function catches at build time.

## The 11 BIAN domains Shadow covers

Shadow does NOT claim coverage across all 38 BIAN v9 service domains — that would be dishonest. It covers 11:

- Regulatory Compliance
- Fair Lending & Consumer Protection
- Credit Assessment
- Credit Risk
- Model Risk Management
- Portfolio Management
- Stress Testing
- Market Analysis
- Customer Servicing
- Customer Interaction
- AML / KYC / Sanctions Screening

Domains Shadow does NOT cover (bank counsel should ask about elsewhere): Payments Execution · Deposits Servicing · Trade Finance · Wealth Management Advisory · Insurance Underwriting · Treasury Management · Card Servicing · General Ledger · etc. Each of these has separate vendor coverage.

## Why the signature binding matters

Every Shadow decision now binds `bian_coverage_sha256` in the Ed25519 attestation. If a bank silently widened a persona's claimed BIAN domain post-decision (e.g. quietly asserting Compliance Officer also covers "Fraud Detection" to satisfy a procurement RFP), the hash would change and verification would break. Bank counsel pins the current `bian_coverage_sha256` value in the procurement contract alongside `dictionary_hash`, `citation_registry_sha256`, and the 8 other append-only fields.

## Contrast with Norm AI

Norm AI ($120M Series C, 2026-07-07) launched **Norm Law LLP** (Blackstone $50M add-on, ex-Sidley Chairman) + Stanford **Legal AGI Lab** as R&D arm alongside the funding. Norm's positioning is now clearly legal-services (targets law firms + GC offices).

**Norm governs contracts. Shadow governs credit decisions.**

A bank compliance officer picking between them today is not making an either/or choice — they are picking which vendor governs which BIAN domain. Norm sits closer to Legal Advisory + Contract Management (not on this list because Shadow does not claim them). Shadow sits at Regulatory Compliance + Fair Lending + Credit Assessment + AML/KYC.

## API surface

```javascript
import {
  BIAN_DOMAINS,
  PERSONA_BIAN_MAP,
  getBianDomainsForPersona,
  getPersonasForBianDomain,
  bianCoverageCommitment,
  auditBianCoverage,
  getBianCoverageMatrix,
} from "shadow-mentor/lib/bian-coverage.js";

// Which BIAN domains does the compliance officer cover?
getBianDomainsForPersona("Compliance Officer");
// → ["Regulatory Compliance", "Fair Lending & Consumer Protection", "Model Risk Management"]

// Which personas handle Fair Lending?
getPersonasForBianDomain(BIAN_DOMAINS.FAIR_LENDING);
// → ["Compliance Officer", "Fair Lending Compliance"]

// Get the full matrix for RFP response docs
getBianCoverageMatrix();
// → [{persona, domains, primary_domain}, …]

// Verify no persona has zero coverage
auditBianCoverage();
// → {ok: true, empty_personas: []}
```

## Related fields in aex-attestation/v1

See `docs/TYPED-CLAIMS.md` § "aex-attestation/v1 append-only field surface — now 10" for the earlier fields. `bian_coverage_sha256` is the **11th** and most recent append-only field.
