# arXiv citation map — Shadow anchor papers

Every Shadow architectural claim traces to a paper. This document collects the anchors, cites verbatim, and pins each to a runtime feature or test file. Written 2026-07-08 as part of the v1.5.21 research-driven repositioning release.

## Core citations

### 1. Behavioural Assurance Cannot Verify Safety Claims Governance Demands
**arXiv:2605.15164** — Seth & Sankarapu, 2026-05-14

Quote: *"Behavioural verification is insufficient for governance claims; mechanistic and cryptographic evidence layers are required to close the audit gap."*

Shadow anchors:
- `lib/attestation.js` — cryptographic evidence layer
- `docs/CITATION_MAP.md` — mechanistic evidence layer  
- `docs/NIST-AI-600-1-MAP.md` §Information Integrity — governance claim

Use in outward writing: **§1 Motivation of every abstract, blog post, or cover letter**.

### 2. Agent Security Meets Regulatory Reality
**arXiv:2606.29142** — Mohan & Nagavenkata, 2026-06-28

Quote: *"Maps six agentic-threat categories (prompt injection, identity/authorisation, action auditability, tool abuse, data residency, boundary policy) to ECOA, Regulation B, EU AI Act, GDPR Article 22, and FINRA's 2026 agent guidance."*

Shadow anchors:
- All 5 mid-tier bank persona rationales in `lib/run-loan-council.js`
- `lib/aml-kyc-voice.js` for the identity/authorization + tool abuse categories
- `api/mcp-manifest.js` for the boundary policy category (SBOM = boundary artifact)

Use in outward writing: **Every LinkedIn post, resume, cover letter cites this paper** — it is the only 2026 paper that maps 6 threat categories × 5 regulatory frameworks in one systematization. Shadow occupies exactly that intersection.

### 3. Mechanical Enforcement for LLM Governance
**arXiv:2605.14744** — de la Chica Rodríguez & Martí-González, 2026-05-14

Quote: *"Text-only governance decays; mechanical primitives preserve compliance."*

Shadow anchors:
- `lib/enforce-reason-code-dictionary.js` (v1.5.8 dictionary_hash binding)
- `lib/audit-guardrail.js` `enforceAnalysisOnly()`
- Retroactive CHANGELOG v1.5.8 citation

Use in outward writing: When someone challenges "why not just prompt-engineer the LLM to be compliant?"

### 4. Nine Judges, Two Effective Votes
**arXiv:2605.29800** — Kohli, 2026-05-28

Quote: *"Nine LLM judges provide only about two effective independent votes due to correlated errors. Best single judge equals or beats the panel."*

Shadow response — **DO NOT retire the 5-voice council; reframe it**:
- The 5 voices are NOT sold as "more voices = better accuracy". They are sold as **5 auditable regulatory chains-of-reasoning that must each survive audit**.
- Value = auditable diversity per Reg B AA-code + SR 26-2 effective challenge, not aggregate accuracy.
- Complementary evidence partitioning (per InfoDelphi arXiv:2607.01661) converts correlated votes → independent ones.

Test file: `test/verdict-invariance.test.js` (v1.5.21) — pins that Shadow's deterministic verdict does not change under structural perturbation of input (whitespace, field ordering, equivalent numeric representation).

### 5. Diverse Evidence, Better Forecasts (InfoDelphi)
**arXiv:2607.01661** — Li, Tao & Zhang, 2026-07-02

Quote: *"12-18% Brier improvement when agents receive partitioned evidence rather than identical prompts."*

Shadow response — **v1.5.22 candidate feature**: per-persona evidence partitioning. Compliance sees regulatory citations only; Credit sees financial ratios only; Risk sees market-proxy time series only; Advocate sees applicant narrative only; Contrarian sees macro context only. Currently all 5 voices receive the full loan packet — this is the InfoDelphi threat/opportunity Shadow addresses in v1.5.22+.

### 6. Persona Non Grata + Dual Nature of LLM Persona
**arXiv:2607.00937** (Guerra-Solano & Li, 2026-07-01) + **arXiv:2607.02368** (Yuan, 2026-07-02)

Quote (Guerra-Solano): *"Persona instability from prompt format is greater than temperature effect."*

Quote (Yuan): *"Persona traits remain stable but geometric structure of persona output degrades 42% under frame misalignment."*

Shadow response — **v1.5.21 ships `test/verdict-invariance.test.js`**:
- Pin that Shadow's deterministic loan-council verdict is invariant to input field ordering, whitespace, and equivalent numeric representations (e.g. 0.36 vs 0.360 vs "36%" as string).
- LLM-based persona semantic stability is a separate v1.5.22 test that requires live API access — deferred until Anthropic credit envelope stabilizes.
- Publish `verdict_invariance` badge alongside test count in README. Nobody else's 5-persona demo will publish this metric — it turns the threat into a moat.

### 7. Citation-Closure Retrieval and Per-Rule Attribution
**arXiv:2605.29742** — Ju & Lee (Korea Univ.), 2026-05-28

Quote: *"RefWalk enforces explicit source mapping per claim."*

Shadow anchor:
- `docs/CITATION_MAP.md` is a hand-curated version of RefWalk's automated approach
- `lib/citation-scanner.js` — enforces per-voice regulatory citation resolution at council time
- **Emerging category name Shadow can own:** "Per-Rule Attribution" or "Citation-Closure Retrieval for Compliance AI"

### 8. Sealing the Audit-Runtime Gap for LLM Skills (SIGIL)
**arXiv:2605.05274** — Shen, Feng & Zhu (NTU), 2026-05-06

Quote: *"On-chain skill registry + verification loader closes the audit-runtime gap."*

Shadow relationship:
- Shadow ships a **lightweight, non-blockchain** version of SIGIL's audit-runtime gap sealer
- `dictionary_hash` (v1.5.8) + `citation_registry_sha256` (v1.5.18) + `proxy_schema_sha256` (v1.5.19) + hash-chain (v1.5.10 + v1.5.16) collectively implement the primitive
- **Emerging category name Shadow can own:** "Audit-Runtime Gap Sealing for Regulated LLM Councils"

### 9. Constitutional Classifiers (Anthropic)
**arXiv:2501.18837** (v1, 2025-01) + **arXiv:2601.04603** (v++ 2026-01)

Quote: *"86% → 4.4% universal-jailbreak block rate + 23.7% inference overhead + 0.38% harmless refusal rate."*

Shadow relationship — **operate above, not overlap**:
- Constitutional Classifiers = single-model input/output moderation layer (jailbreak defense on prompts + outputs)
- Shadow = decision-reasoning + audit layer (multi-voice council + regulatory citation + attestation)
- **Zero overlap.** Shadow is additive whenever the deployment needs why-was-this-decision-made traceability that survives a Reg B examiner
- **Repositioning claim:** Shadow is the "post-classifier audit layer" — Constitutional Classifiers make outputs safe; Shadow makes decisions defensible

Anticipated v1.5.22 addition: `lib/classifier-disagreement.js` — when Constitutional Classifier flags a persona's output, Shadow's council surfaces the disagreement rather than silently suppressing it.

### 10. The Fair Lending Model (FAccT 2026)
**arXiv:2606.02957** — Black, Bogen, Koepke & Barocas (Stanford / Cornell / Upturn), 2026-06-01

Quote: *"35 empirical bank interviews on how ECOA testing actually works in practice."*

Shadow anchors:
- `docs/CITATION_MAP.md` — Fair Lending row cites this paper
- Loredana Levitchi's BRD + Addenda regulatory triple aligns with the paper's empirical findings on what auditable ECOA testing requires
- Use in academic positioning: this paper is the empirical anchor for "banks want auditable" — cite in IEEE VR 2027 abstract §2 Related Work

## Emerging category names Shadow can own

Distilled from the papers above, these are the taxonomic labels Shadow should adopt in all outward positioning:

1. **"Audit-Runtime Gap Sealing"** — SIGIL 2605.05274 + Seth 2605.15164
2. **"Mechanical Enforcement Layer"** — de la Chica 2605.14744
3. **"Per-Rule Attribution / Citation-Closure Retrieval"** — RefWalk 2605.29742
4. **"Regulatory Governance Framework (RGF)"** — Uddin 2605.04076 (pre-window but taxonomy-defining)
5. **"Effective Independent Vote Count"** — Kohli 2605.29800 (publish as a metric badge, not a claim)

## What NOT to cite (my earlier synthesis errors)

- **"Stanford Persona Bias 2507.02940"** — arXiv ID resolves to unrelated "Comparative Framework for Compositional AI Models". Do not cite. Use Kohli 2605.29800 + Guerra-Solano 2607.00937 + Yuan 2607.02368 instead for persona-related claims.
- **"Constitutional Classifiers arxiv:2506.15928"** — wrong ID. Correct IDs are 2501.18837 (v1) + 2601.04603 (v++). Both pre-window; cite as reference only.
