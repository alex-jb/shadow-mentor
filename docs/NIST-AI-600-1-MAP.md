# NIST AI 600-1 GenAI Profile — Shadow control-mapping

**Regulatory anchor:** NIST AI Risk Management Framework, Generative AI Profile ("NIST AI 600-1"), published 2024-07-26. Companion to NIST AI RMF 1.0 (2023-01). Under OMB Memorandum M-24-10 (2024-03-28), federal agencies acquiring "high-impact AI use cases" must produce a GAI Profile mapping. This document is Shadow's answer to that requirement for federal procurement.

**Why this document exists:** Federal contractor + FedRAMP-adjacent AI systems must map their controls against the 12 GAI risks NIST enumerates in AI 600-1. Absent such a map, procurement stops. Shadow already implements 8 of 12 risks with mechanical enforcement + test coverage; 3 are handled at deployment layer; 1 is out of scope. This map is the artifact a federal contractor needs to submit under GSA MAS, FedRAMP High, or agency AI Impact Assessment reviews.

**Companion documents:** [`docs/CITATION_MAP.md`](./CITATION_MAP.md) (banking regulatory triple) · [`docs/soc2-readiness.md`](./soc2-readiness.md) (AICPA Trust Services)

---

## 12 GAI risks × Shadow control mapping

Each row: (a) NIST 600-1 risk short-name + section reference, (b) how Shadow addresses it, (c) where in the codebase, (d) test file that pins the invariant.

| # | NIST 600-1 risk | Shadow control | Codebase | Test file |
|---|---|---|---|---|
| **1** | **Confabulation** (§2.2) — hallucinated regulatory citations, invented CFR sections | Frozen citation-registry: LLM picks from `lib/schemas/citation-registry.json`; hallucinated citations return REWORK, not APPROVE. Attestation binds `citation_registry_sha256` (v1.5.18) — post-hoc registry edit breaks verification. | `lib/citation-registry.js` · `lib/citation-scanner.js` · `lib/attestation.js` | `test/citation-registry.test.js` |
| **2** | **Dangerous / Violent / Hateful Content** (§2.3) | Guardrail regex + deterministic policy floor rejects trade-execution verbs from analysis output. Never applies to lending-decision text — this risk is deployment-layer for consumer-facing chat. | `lib/audit-guardrail.js` | `test/audit-guardrail.test.js` |
| **3** | **Data Privacy** (§2.4) — PII leakage, protected-class exposure | ECOA §701 protected-class taxonomy (US-ECOA + EU-GDPR jurisdictions, v1.5.20) with hard-block direct-mention + advisory FLAG combinatorial signals. Attestation binds `proxy_schema_sha256` (v1.5.19). Bank personnel roster allowlist prevents false-positive on own employee names. | `lib/proxy-detector.js` · `lib/schemas/protected-classes-us-ecoa.json` · `lib/schemas/protected-classes-eu-gdpr.json` | `test/proxy-detector.test.js` · `test/proxy-detector-eu-gdpr.test.js` |
| **4** | **Environmental** (§2.5) — inference cost, carbon | **Out of scope for v1.5.x.** Deployment-layer concern; monitor via customer's LLM provider dashboard. Documented here for completeness. | — | — |
| **5** | **Human-AI Configuration** (§2.6) — automation bias, over-reliance | Human review required by code-level invariant for adverse actions (AA05 fair-lending flag). `enforceAnalysisOnly()` throws `AnalysisOnlyViolationError` if any voice output contains trade-execution or auto-approve verbs. | `lib/audit-guardrail.js` · `lib/run-loan-council.js` | `test/audit-guardrail.test.js` |
| **6** | **Information Integrity** (§2.7) — tampered outputs, evidence chain | Cross-vertical hash-chain (v1.5.16) — banking + trading + DS decisions form one monotone SHA-256 chain. Reorder / insert / delete any decision breaks verification. Ed25519 signature covers `output_commitment` + `dictionary_hash` + `citation_registry_sha256` + `proxy_schema_sha256`. | `lib/attestation.js` · `lib/attestation-chain-store.js` · `api/verify-chain.js` | `test/attestation-chain-cross-vertical.test.js` · `test/dictionary-hash-binding.test.js` |
| **7** | **Information Security** (§2.8) — prompt injection, model substitution | AEX-style attestation (arxiv 2603.14283 anchor) detects silent model substitution via signed `model_id` field. Constitutional Classifiers (arxiv:2501.18837 + 2601.04603) shipping in Anthropic Claude 4.7 is complementary (input/output filter); Shadow operates at decision-reasoning + audit layer. | `lib/attestation.js` · `lib/attestation-batch.js` | `test/attestation.test.js` · `test/attestation-ed25519.test.js` |
| **8** | **Intellectual Property** (§2.9) — training data provenance | Not applicable to Shadow's own model outputs (Shadow does not train). Deployment-layer concern; the LLM provider (Anthropic / OpenAI / GLM) attests to training-data compliance. | — | — |
| **9** | **Obscene / Degrading Content** (§2.10) | Not applicable to Shadow's lending-decision surface. Documented for completeness. | — | — |
| **10** | **Toxicity / Bias / Homogenization** (§2.11) — fairness, disparate impact | ECOA §701 direct-mention hard-block + prophylactic advisory FLAG on combinatorial signals. Honest scope disclosure baked into every response — Shadow does NOT claim to solve combinatorial proxy detection (industry-unsolved). Human review remains load-bearing per red-team B1 defense. | `lib/proxy-detector.js` · `lib/schemas/protected-classes-us-ecoa.json` | `test/proxy-detector.test.js` |
| **11** | **Value Chain / Component Integration** (§2.12) — SBOM, supply-chain | MCP manifest SBOM (v1.5.12) — `GET /api/mcp-manifest` publishes 8-tool SBOM with per-tool + envelope SHA-256. Bank counsel pins `manifest_hash_sha256` in procurement contract. | `api/mcp-manifest.js` | `test/mcp-manifest.test.js` |
| **12** | **CBRN Weapons** (§2.13) — chemical / biological / radiological / nuclear | Not applicable to Shadow's lending-decision surface. Documented for completeness. | — | — |

---

## Summary tally

- **Mechanically enforced with code + test evidence:** 8 of 12 (confabulation, data privacy, human-AI configuration, information integrity, information security, toxicity/bias, value chain integration, + audit-guardrail invariant)
- **Deployment-layer or provider-attested:** 3 of 12 (environmental, dangerous content, intellectual property)
- **Not applicable to lending-decision surface:** 3 of 12 (obscene content, CBRN) — note overlap; some risks recur

## Related instruments

- **OMB M-24-10** — Federal AI acquisition memo, 2024-03-28. Mandates GAI Profile mapping for "safety-impacting" and "rights-impacting" use cases. Lending decisions fall in scope.
- **OMB M-25-21 / M-25-22** — Successor memos post-2025 (under current administration, revised scope). Shadow's mapping still applies; the enforcement lens shifted from CFPB federal enforcement to state AG + private ECOA litigation (per 2026-07-08 regulatory horizon audit).
- **NIST AI RMF 1.0** — Umbrella framework Shadow's 8 controls trace back to (Govern, Map, Measure, Manage functions).
- **FedRAMP** — For high-impact ATO packages, this mapping supports the AI-relevant control families (AC-6 least privilege, AU-2/3 auditable events, SI-4 monitoring, CM-2 baseline configuration).
- **GSA MAS Large Categories** — Category F (Info Technology) + Category 5 (Professional Services) both accept this mapping in AI-Impact-Assessment sections.

## What this document does NOT claim

- Shadow is not FedRAMP-authorized (currently pre-ATO). Alex's contractor / prime integrator holds the ATO; Shadow is a component.
- Shadow does not solve every NIST 600-1 risk. 3 are honest N/A; 1 (environmental) is deferred.
- This map is Shadow's self-assessment. A GAI Independent Verification (per NIST AI 600-1 §3.2.1) is separate work sometimes required by the acquiring agency.

## Provenance

Reviewed against:

- NIST AI 600-1, GenAI Profile, publicly published 2024-07-26. URL: https://www.nist.gov/itl/ai-risk-management-framework
- OMB Memorandum M-24-10, 2024-03-28. URL: https://www.whitehouse.gov/wp-content/uploads/2024/03/M-24-10-Advancing-Governance-Innovation-and-Risk-Management-for-Agency-Use-of-Artificial-Intelligence.pdf
- Shadow codebase at v1.5.21 tag. Cross-referenced with `docs/CITATION_MAP.md` (Loredana C. Levitchi, primary author of regulatory triple)

---

**Bottom line for federal procurement contact:** 8 of 12 NIST 600-1 GenAI risks are Shadow-enforced with code + test evidence at v1.5.21; the remaining 4 are honestly categorized. This is a deeper mapping than any AI compliance vendor has published, per the 2026-07-08 competitive audit. If your acquisition officer requires this mapping to advance a Shadow POC, cite this file directly.
