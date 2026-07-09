# Eticas AI Risk Taxonomy v2.0.0 Coverage

**Ships in Shadow v1.5.40 (2026-07-08).**
**Anchor:** arXiv:2607.02201 — "The Eticas AI Risk Taxonomy: Open Infrastructure for Operationalizing AI Audits" (2026-07-02).

## Why bank counsel opens this doc

Different auditors reach for different taxonomies. NIST-friendly buyers want NIST AI RMF categories. ISO 42001 buyers want the ISO structure. EU-facing buyers want AI Act articles. Eticas v2.0.0 is designed as the OPEN cross-framework taxonomy that maps ONE ROW into 18 external frameworks simultaneously. When Shadow tests bind to Eticas subcategories, auditors get "regulatory pluralism for free" — pick any framework, get the Shadow coverage as a filter.

## The 12 subcategories Shadow covers

| Subcategory | Eticas Category | Shadow Test | NIST AI RMF | EU AI Act | ISO 42001 |
|---|---|---|---|---|---|
| **protected-class-proxy-exclusion** | Discrimination + Bias | `reason-code-dictionary.test.js` | MAP-2.3 · MEASURE-2.7 | Article 10 | 6.1 |
| **adverse-action-notice-specificity** | Discrimination + Bias | `adverse-action-drafter.test.js` | GOVERN-6.1 | Article 13 | 8.3 |
| **adversarial-peer-defense** | Robustness + Security | `heterogeneous-debate.test.js` | MEASURE-2.7 | Article 15 | 8.4 |
| **sampling-substitution-detection** | Robustness + Security | `sampling-attestation.test.js` | MEASURE-4.2 | Article 15 | 8.4 |
| **audit-trail-cryptographic** | Transparency + Explainability | `attestation.test.js` + `attestation-chain.test.js` | GOVERN-1.4 · MANAGE-3.1 | Article 12 | 8.6 |
| **reproducibility-manifest** | Transparency + Explainability | `reproducibility.test.js` | MEASURE-3.3 · MANAGE-4.1 | Article 12 · 13 | 8.6 |
| **typed-claim-classification** | Transparency + Explainability | `typed-claims.test.js` | MEASURE-2.5 | Article 13 | 8.3 |
| **regulatory-citation-registry** | Accountability + Governance | `citation-registry.test.js` | GOVERN-1.1 · 1.6 | Article 9 | 6.1.2 |
| **bian-service-domain-coverage** | Accountability + Governance | `bian-coverage.test.js` | GOVERN-1.4 | Article 9 | 5.2 |
| **threat-model-systematization** | Accountability + Governance | `refuse-to-serve.test.js` | MAP-5.1 · MANAGE-1.3 | Article 5 | 6.1.2 |
| **escalate-vs-refuse-to-serve-discretion** | Human Oversight | `refuse-to-serve.test.js` + `run-loan-council.test.js` | MEASURE-2.3 · MANAGE-3.2 | Article 14 | 8.7 |
| **aml-kyc-tipping-off-defense** | Data Protection + Privacy | `aml-kyc-voice.test.js` + `aml-kyc-adversarial.test.js` | MEASURE-2.10 · MANAGE-2.4 | Article 10 | 8.5 |

## Categories covered (5 out of 10 Eticas v2.0.0 categories)

- ✅ Discrimination + Bias
- ✅ Robustness + Security
- ✅ Transparency + Explainability
- ✅ Accountability + Governance
- ✅ Human Oversight
- ✅ Data Protection + Privacy
- ❌ Safety + Harm Prevention (Shadow does NOT cover physical-safety AI use cases)
- ❌ Environmental Impact
- ❌ Social + Cultural Impact
- ❌ Economic Impact + Labor

Shadow claims coverage across 6 out of 10 Eticas categories. Bank counsel evaluating Shadow for a full-stack AI-governance program will need separate vendors for the other 4.

## Why the signature binding matters

Every Shadow decision now binds `eticas_taxonomy_sha256` in the Ed25519 attestation (12th append-only field). If a bank silently claimed coverage of an Eticas subcategory without shipping the underlying test — e.g. quietly asserting `adversarial-peer-defense` without the heterogeneous-debate module — the hash would change and Ed25519 verification would break.

## API surface

```javascript
import {
  ETICAS_CATEGORIES,
  getEticasSubcategory,
  getSubcategoriesInCategory,
  getEticasCoverageMatrix,
  eticasTaxonomyCommitment,
  auditEticasCoverage,
} from "shadow-mentor/lib/eticas-taxonomy.js";

// SIEM auditor filters by Eticas category
getSubcategoriesInCategory(ETICAS_CATEGORIES.DISCRIMINATION_BIAS);
// → ["protected-class-proxy-exclusion", "adverse-action-notice-specificity"]

// Bank counsel opens one row + gets NIST + EU AI Act + ISO 42001 simultaneously
getEticasSubcategory("adverse-action-notice-specificity");
// → { category, shadow_control, shadow_test, nist_ai_rmf: "GOVERN-6.1",
//     eu_ai_act: "Article 13", iso_42001: "8.3",
//     us_reg_b: "12 CFR 1002.9(b)(2) specific principal reasons" }
```

## Related fields in aex-attestation/v1

See `docs/BIAN_COVERAGE.md` § "aex-attestation/v1 append-only field surface — now 11" for the earlier 11. `eticas_taxonomy_sha256` is the **12th** and most recent append-only field.

## Reading order for procurement

1. `docs/CITATION_MAP.md` — regulatory citation → persona → test file
2. `docs/BIAN_COVERAGE.md` — persona → BIAN service domain
3. `docs/ETICAS_TAXONOMY.md` (this doc) — Shadow test → Eticas subcategory → NIST / EU AI Act / ISO 42001 all in one row
4. `docs/THREAT_MODEL.md` — 6-category systematization
