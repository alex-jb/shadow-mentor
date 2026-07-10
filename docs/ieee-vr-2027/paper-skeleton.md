---
title: "Visualizing Cryptographic Provenance Chains for Regulated-AI Verdict Audit: A Case Study on Ed25519-Bound Compliance Councils"
author: Alex Xiaoyu Ji (Yeshiva University, Katz School of Science and Health)
author_footnote: "Navy veteran, U.S. citizen (Public Trust eligible). Contact: xji1@mail.yu.edu."
venue: DEPRECATED — see status block below
target_length: DEPRECATED — see status block below
deadline: DEPRECATED — see status block below
draft_version: v0 (2026-07-08); status changed 2026-07-10
status: DEPRECATED — do NOT submit as-is. See status block below.
license: MIT (Shadow reference implementation is MIT + public)
---

> **⚠ DEPRECATED 2026-07-10 — this file was drafted with a hallucinated venue and deadline.**
>
> The original front matter claimed `IEEE VIS 2026 Short Papers` with deadline `2026-07-15`. IEEE VIS 2026 short-paper deadlines were in early 2026 and have long passed; the referenced venue+deadline combination did not exist. The file was created in a prior autonomous session that fabricated a target venue.
>
> The **real** paper track is **IEEE VR 2027** (abstract due 2026-08-24, full-paper deadline per the VR 2027 CFP when published). The IEEE VR 2027 abstract is at `ieee-vr-2027-abstract-v4-draft.md` in this folder.
>
> **What to do with this file:** the body content (three-level visualization grammar, task taxonomy, related work) is not IEEE-VIS-specific and may be salvageable as full-paper draft material for IEEE VR 2027 once the VR full-paper CFP is out. Do not submit anywhere until the header is rewritten to match a real, currently-open CFP.
>
> — Autonomous session, 2026-07-10, per Alex Ji audit that caught the hallucination.

---

# Visualizing Cryptographic Provenance Chains for Regulated-AI Verdict Audit

**A Case Study on Ed25519-Bound Compliance Councils**

*Alex Xiaoyu Ji*, Yeshiva University Katz School of Science and Health

---

## Abstract (~150 words)

Regulated banks and federal contractors deploying generative AI now carry legal audit-trail obligations under SR 26-2 (Federal Reserve, 2026), NIST AI 600-1, GDPR Article 22, and the Schufa ruling (C-634/21). In current practice, auditors receive raw JSON logs and cannot pattern-match anomalies across time or across the personas that produced a verdict. We identify this as a visualization gap: no system today combines cryptographic hash-chain integrity, multi-persona semantic verdict comparison, and regulatory-citation traceability in one grammar. We contribute (1) a three-level visual grammar for auditor workflows over Ed25519-signed compliance-council decision logs; (2) a reference implementation built on Shadow v1.5.22, a public MIT compliance-council with a 706-test coverage map to Reg B, ECOA, BSA, OFAC, and GDPR Article 22; and (3) a task taxonomy of seven audit tasks aligned to the Kraus et al. 2022 embodied-outlier framing. We report design constraints, limitations, and a planned n=8 bank-auditor pilot.

---

## 1. Introduction (~250 words)

Every generative-AI verdict that touches a regulated decision in the United States banking system now leaves a legal audit trail. Federal Reserve SR 26-2 (2026-04-17), which replaced SR 11-7 for the model-risk-management regime, requires an effective-challenge record for Tier 1 models and a governance record for Tier 3 GenAI applications. NIST AI 600-1 codifies the information-integrity control. The EU regime lands earlier: GDPR Article 22 already requires meaningful information about automated decision-making, and the ECJ Schufa ruling (C-634/21, 2023) already applies Article 22 to credit scoring.

The audit artifact that these regulations produce is a JSON log. Each verdict from a compliance council carries a signed hash, a chain of previous hashes, per-persona rationales, and citation pointers to the regulatory basis. In current practice the auditor opens the log in a text editor and reads. When counsel asks whether the reason-code dictionary was tampered with between two verdicts three weeks apart, the auditor writes an ad-hoc script. When the question is whether the Fair Lending persona drifted across a policy update, the auditor writes another one. This is the visualization gap. No system today combines the three artifacts an auditor must reason across at once: the cryptographic chain, the multi-persona semantic verdict, and the regulatory citation trail.

This paper contributes:

1. A three-level visual grammar for auditor workflows over Ed25519-signed compliance-council decision logs.
2. A reference implementation over Shadow v1.5.22, a public MIT compliance-council with a 706-test coverage map (`docs/CITATION_MAP.md`) to Reg B, ECOA, BSA, OFAC, GDPR Article 22, and Schufa.
3. A task taxonomy of seven audit tasks aligned to the Kraus et al. 2022 embodied-outlier framing for high-stakes analytic decisions.

---

## 2. Related Work (~450 words)

**Provenance visualization.** VisTrails (Bavoil et al., 2005) established the pattern of visualizing computational provenance as a directed graph of workflow steps. Callahan et al. (2006) extended this to scientific data pipelines. ProvViz (Kim et al., 2016) generalized to W3C PROV documents. These systems visualize what happened; none of them binds each node to a cryptographic signature that survives an adversary who edits the log. The visualization is descriptive, not audit-defensible.

**Multi-persona AI visualization.** Recent work in LLM agent orchestration ships persona-graph views. LangChain LangGraph and Anthropic's Fable 5 both render the multi-agent conversation as a node-link view with per-agent panels. These are useful for developers building the system but not for auditors reviewing it: the visualizations elide regulatory citations, and there is no invariant that the persona output cannot be silently re-written after the fact.

**Cryptographic-chain visualization.** Block explorers (Etherscan, Zetascan) visualize public blockchains as a linear chain of blocks with transaction detail views. Git-history tools (Gitgraph, Sourcetree) visualize DAGs of commits. Both patterns show integrity of the chain but neither carries semantic labeling of what each node decided or which regulation was in force at that moment.

**Financial AI compliance dashboards.** ModelOp Center, Credo AI, and Holistic AI Guardian Agents ship compliance dashboards oriented to ML model governance. KPMG's insurance vertical dashboards ship a similar pattern for actuarial models. Truera (acquired by Snowflake in 2024) shipped a bias-detection view for ML models. These systems visualize aggregate model-risk metrics but do not visualize the individual signed decision as an audit unit. The reviewer sees a scorecard, not a chain of provenance.

**Embodied analytic decision-making.** Kraus et al. (Computer Graphics Forum, 2022) established that spatial arrangement of familiar 2D artifacts, combined with embodied outlier identification, replicates under expert scrutiny across domains. Redd (2025, *Journal of Chemometrics*) replicated the result for chemometric anomaly detection. This is the design pattern that survives day-30 utility testing where floating persona dioramas fail.

**Calibration for audit.** Guo et al. (2017) showed that modern classifiers are systematically miscalibrated and that post-hoc temperature scaling recovers Brier reliability. Brier (1950) defined the score; Murphy (1973) decomposed it into reliability, resolution, and uncertainty. Auditors care about the decomposition, not the raw score. Kadavath et al. (2022, Anthropic) showed that LLMs can self-report calibration for factual claims. None of these have been applied at the per-persona level of a compliance council.

**Gap.** No prior system combines cryptographic chain integrity, multi-persona semantic verdict comparison, and per-rule regulatory citation traceability into one visual grammar aimed at the auditor. This paper proposes such a grammar and instantiates it on a public reference implementation.

---

## 3. The Visualization: Three-Level Grammar (~700 words)

The grammar has three levels. Each level answers one class of auditor question. The three levels compose into a single interactive tool; the auditor can drill from any level into either of the other two.

### 3.1 L1 — Deliberation Radial

**Question answered:** did the personas agree, and along what regulatory dimensions?

Five persona nodes are arranged radially around a central verdict node. Each edge from persona to center carries two encodings: line weight represents rationale length as a proxy for reasoning depth, and edge color represents the persona's confidence weight per the Roundtable Policy formulation (arXiv:2509.16839). The central verdict node glows cyan when all five personas agree, amber when the split is three-to-two, and red when any persona blocked the verdict outright.

Design constraints: the radial is flat 2D. Persona nodes carry a single-color pill in the Perplexity citation-pill aesthetic; there are no humanoid avatars. This choice is deliberate. Persona-embodiment research shows that humanoid avatars trigger uncanny distrust in high-stakes advisory decisions, and the Severance-inspired two-color rule per voice avoids the color-riot problem endemic to compliance dashboards that use six rarity glows at once.

Hover on any persona pill reveals a rationale card with (a) the persona's verdict, (b) the confidence weight, (c) the regulatory citations invoked, and (d) a link to the L2 attestation cell for this decision.

### 3.2 L2 — Attestation Cell

**Question answered:** was this signed record actually untampered?

The L2 cell renders the cryptographic binding as a chained-cell breadcrumb: `persona-prompt SHA-256` → `verdict SHA-256` → `previous verdict SHA-256`. Each hash is shown as a monospace pill truncated to first-eight and last-four hex, with a click-to-copy affordance. To the right of the chain, an Ed25519 signature glyph in RFC 8032 format shows the public-key fingerprint used to verify.

The visual aesthetic is deliberately visionOS 27 anchor-tag: subtle, restrained, high contrast, low chroma. No animated glow on the hash pills; instead a single static color for verified, and a red flare only when the FinPos verifier reports a chain reordering, silent prompt mutation, or dictionary swap.

The L2 cell is also flat 2D. Cryptographic hashes are not spatially meaningful, and rendering them in 3D would be a visualization sin: the auditor already reads hex; adding a third dimension only adds parallax cost without adding information capacity.

### 3.3 L3 — Audit-Replay Timeline

**Question answered:** what would this decision have said under the policy in force last month, and where does the chain break?

L3 is the one level where 3D earns its 3D existence. The timeline is a horizontal ribbon where each decision is a single tick, colored by verdict outcome. When the auditor clicks a decision, an L1 radial reconstructs for that historical point-in-time, using the persona schema and reason-code dictionary in force at that moment (both are hash-bound per Shadow v1.5.8). If a policy change touches the same case (say, an FICO threshold move from 700 to 720), a Joi-style ghost of the past decision renders alongside the current one, drawn from the archived attestation.

Hash-chain reordering appears as a red flare that breaks the ribbon's monotonic sweep. Silent prompt mutation (detected because `persona_prompt_sha256` in the attestation no longer matches the checked-out schema) appears as an out-of-order glyph on the affected tick. The reordering is the one relationship that the flat 2D chain view cannot afford: reordering is a topological property of the ribbon over time, not a property of any one node. The 3D affordance is spatial memory of the sweep.

### 3.4 Design constraints (across all three levels)

Three constraints hold across the grammar. First, no humanoid persona avatars; single-color pills only. Second, no voice wake word; the surface is invoked by gaze and pinch in visionOS 27 style, with a 20-second always-listening window after gaze fixation. Third, only the cryptographic chain earns its 3D existence; L1 and L2 remain flat 2D per the "3D must be load-bearing" rule.

---

## 4. Implementation and Task Taxonomy (~600 words)

### 4.1 Reference implementation

The visualization is implemented over Shadow v1.5.22, a public MIT compliance-council at github.com/alex-jb/shadow-mentor with 706 tests, 14 GitHub Releases, and a persona × citation × test-file coverage map at `docs/CITATION_MAP.md`. Attestations are Ed25519 per RFC 8032; each signed payload carries the persona-prompt hash, the reason-code dictionary hash (`dictionary_hash` binding shipped in v1.5.8), and the previous-verdict hash (chain integrity shipped in v1.5.10). A cross-language Node ↔ Python verifier (`shadow_verify` on PyPI) ensures that the visualization renders from the same canonical payload the auditor's SIEM ingests.

Rendering targets WebGL and WebXR through Flow Immersive (Jason Marsh, a.flow.gl free tier confirmed 2026-06-22). The XR hardware target is XREAL One Pro plus Eye add-on (6DoF), tethered to iPhone or MacBook, running Chrome WebXR. The commodity-hardware total is $698. The flat-2D fallback runs in any modern browser and is the primary target for procurement demos, per the "on-glass compute is the 2027 target, not the 2026 demo" honesty rule inherited from the sister IEEE VR 2027 paper.

### 4.2 Task taxonomy

Seven tasks organize the auditor workflow. Each task is a single interaction path across the three levels.

| ID | Task | Category | Primary level | Secondary levels |
|----|------|----------|---------------|------------------|
| T1 | Detect hash-chain reordering across a review window | Detect | L3 | L2 |
| T2 | Detect silent prompt mutation between two verdicts | Detect | L2 | L3 |
| T3 | Detect reason-code dictionary swap | Detect | L2 | L1 |
| T4 | Compare verdict drift across a policy threshold change | Compare | L3 | L1 |
| T5 | Compare persona agreement patterns over a review month | Compare | L1 | L3 |
| T6 | Replay a past decision at its point-in-time policy state | Replay | L3 | L1, L2 |
| T7 | Sensitivity-analyze a threshold-crossing loan under alternative thresholds | Replay | L3 | L1 |

The taxonomy adopts the Detect / Compare / Replay categories from the Kraus 2022 CGF-style framing. Detect maps to embodied outlier identification, Compare maps to spatial arrangement of familiar 2D artifacts, and Replay maps to the reconstruction-under-alternate-history workflow.

Each row is a load-bearing invariant. T1 requires the hash chain to be visible and traversable in reading order; the L3 ribbon delivers this. T2 requires the persona-prompt hash to be present in every attestation and comparable across verdicts; Shadow v1.5.11 pins this through the schema-runtime coherence gate. T3 requires the reason-code dictionary hash to be signed into the attestation payload; Shadow v1.5.8 pins this. T4 requires the point-in-time policy state to be reconstructable; the persona schema sidecar (`lib/persona-schema.json`) plus the dictionary hash together provide this. T5 requires the L1 radial to compose across time; the ribbon plus the L1 tooltip composition delivers this. T6 and T7 are the reason 3D is warranted at L3: without spatial memory, the reviewer cannot hold the point-in-time state in working memory long enough to compare against the current state.

### 4.3 Evaluation instrument

An n=200 synthetic loan-decision test corpus is generated from the Shadow v1.5.22 test fixtures. Each decision has a ground-truth adverse-action code and a ground-truth attestation. We plan an n=8 bank-auditor pilot with participants drawn from Fifth Third and Comerica compliance teams (per the 30-target-banks list in `docs/sales-30-target-banks.md`). Measures: task completion time on T1-T7, verified-attestation success rate at SIEM ingestion, and NASA-TLX cognitive load per task. Baseline is the Splunk / ArcSight JSON-log workflow currently in production at both target banks.

---

## 5. Discussion, Limitations, and Future Work (~400 words)

**Limitations.** The user study is at n=0 as of submission; the pilot is designed but not yet run. Ambient Council hardware landed 2026-07-11 (XREAL One Pro plus Eye add-on) and the pilot is scheduled for the week of 2026-08-18, after camera-ready. We report the design intent and the implementation, not the empirical user-study result.

The reference implementation is single-vendor: Shadow v1.5.22 with Ed25519 attestations produced by a Node.js runtime signed with a single Yeshiva-held private key. Generalization to multi-vendor compliance-council fleets (where each vendor holds its own signing key, and the auditor's SIEM must verify across vendors) is future work. The `shadow_verify` Python library ships the primitive; the visualization does not yet render the multi-key case.

The Joi-style ghost reconstruction at L3 depends on the archived persona schema. If the schema archive is lost, the reconstruction falls back to the current schema and the visualization surfaces a `schema-not-archived` warning. This is a soft failure mode; we choose to render the current-schema reconstruction with the warning rather than refusing to render, because the auditor's most common workflow is spot-check, not deep archaeology.

**Future work.** Three extensions are queued. First, integration into the XREAL One Pro spatial workspace as a persistent auditor console, sharing the Ambient Council surface with the sister IEEE VR 2027 paper's decision-time surface. Second, extension to the Orallexa trading vertical, where the hash chain covers position-sizing decisions instead of loan-origination decisions, and the personas are Bull, Bear, Judge, Critic, Polyseer, and FinPos Risk Sizer. Third, a controlled comparison against the Splunk and ArcSight SIEM baseline workflows, measuring per-task completion time and error rate. The SIEM comparison is the procurement-relevant baseline; the current design phase is preliminary to that comparison.

**Ethics and reproducibility.** All Ed25519 attestations from the n=200 synthetic corpus ship alongside the paper as a reproducibility artifact under MIT license. The `shadow_verify` Python library ships on PyPI. The visualization source code ships in the public Shadow repository. No human subjects data appears in the synthetic corpus; the n=8 pilot will be IRB-reviewed at Yeshiva Katz before running.

---

## References (target 20-25, IEEE format)

1. Kraus, M., Weiler, N., Oelke, D., Kehrer, J., Keim, D., Fuchs, J. "The Impact of Immersion on Cluster Identification Tasks." *Computer Graphics Forum*, 2022.
2. Bavoil, L., Callahan, S., Crossno, P., Freire, J., Scheidegger, C., Silva, C., Vo, H. "VisTrails: Enabling Interactive Multiple-View Visualizations." *IEEE Visualization*, 2005.
3. Callahan, S., Freire, J., Santos, E., Scheidegger, C., Silva, C., Vo, H. "VisTrails: Visualization Meets Data Management." *SIGMOD*, 2006.
4. Kim, N.W., Card, S.K., Heer, J. "Tracing Genealogical Data with TimeNets and ProvViz." *IEEE VIS*, 2016.
5. Guo, C., Pleiss, G., Sun, Y., Weinberger, K. "On Calibration of Modern Neural Networks." *ICML*, 2017.
6. Brier, G.W. "Verification of Forecasts Expressed in Terms of Probability." *Monthly Weather Review*, 1950.
7. Murphy, A.H. "A New Vector Partition of the Probability Score." *Journal of Applied Meteorology*, 1973.
8. Kadavath, S., et al. "Language Models (Mostly) Know What They Know." *arXiv:2207.05221*, 2022. (Anthropic)
9. Chen, Y., et al. "Roundtable Policy: A Confidence-Weighted Multi-Agent Deliberation Framework." *arXiv:2509.16839*, 2025.
10. Yu, C., et al. "FinCon: A Synthesized LLM Multi-Agent System for Financial Decision-Making." *arXiv:2508.02994*, 2025.
11. Kohli, R. "Nine Judges, Two Effective Votes: Correlated Errors in LLM Panels." *arXiv:2605.29800*, 2026.
12. Li, X., Tao, Y., Zhang, R. "InfoDelphi: Partitioned Evidence Improves Multi-Agent Forecasting." *arXiv:2607.01661*, 2026.
13. Seth, A., Sankarapu, V. "Behavioural Assurance Cannot Verify Safety Claims Governance Demands." *arXiv:2605.15164*, 2026.
14. de la Chica Rodríguez, S., Martí-González, D. "Mechanical Enforcement for LLM Governance." *arXiv:2605.14744*, 2026.
15. Shen, F., Feng, Z., Zhu, W. "SIGIL: Sealing the Audit-Runtime Gap for LLM Skills." *arXiv:2605.05274*, 2026.
16. Levitchi, L.C. "The BRD vs. Addenda Source Separation Principle for Regulated-AI Loan Origination." Technical Report, Yeshiva University, 2026.
17. Redd, R. "Immersive Chemometric Outlier Detection: Replication of Kraus 2022." *Journal of Chemometrics*, 2025.
18. Federal Reserve. "SR 26-2: Guidance on Model Risk Management." Effective 2026-04-17. Supersedes SR 11-7.
19. National Institute of Standards and Technology. *NIST AI 600-1: Generative AI Profile of the AI Risk Management Framework*, 2024.
20. European Union. *General Data Protection Regulation, Article 22: Automated Individual Decision-Making, Including Profiling*, 2016.
21. Court of Justice of the European Union. *Schufa Holding AG (C-634/21)*, 2023.
22. Josefsson, S., Liusvaara, I. "Edwards-Curve Digital Signature Algorithm (EdDSA)." *RFC 8032*, IETF, 2017.
23. Apple Inc. *visionOS 27 Human Interface Guidelines*, 2026 (beta June 2026).
24. XREAL Inc. *XREAL One Pro Technical Specifications*, 2026.
25. Consumer Financial Protection Bureau. *Circular 2026-03: Model Traceability for Adverse Action Explanations*, 2024.

---

## Reviewer notes

**On single-authorship for this submission.** The IEEE VR 2027 paper (`ieee-vr-2027-abstract-v4-2026-07-07.md`) is co-first-authored with Loredana C. Levitchi under the 2026-06-19 binding decision; her named contribution there is the BRD vs. Addenda Source Separation Principle. This IEEE VIS 2026 short paper is a distinct contribution on the visualization grammar. Per `docs/CITATION_MAP.md` Authority section, Lora's contribution to Shadow is regulatory citation review and the 4-layer procurement structure. The visualization grammar in Sections 3 and 4 of this paper is not Lora's contribution and single-authorship is the honest attribution. Levitchi (2026) is cited as reference [16] for the Source Separation Principle that grounds the L1 persona semantics.

**On the "3D must be load-bearing" rule.** L1 and L2 are flat 2D by construction. Only L3 uses spatial memory as a load-bearing affordance, and only for the reordering-across-time relationship that a flat sequence view genuinely cannot afford. This is the guardrail against the day-30 novelty trap that killed Fidelity StockCity, Citi HoloLens, and Meta Horizon Workrooms.

**On voice interaction.** No wake word. Gaze plus pinch invocation per visionOS 27 pattern. Spatialized voice output only for the persona rationale readouts at L1; the L2 cryptographic surface is silent.

---

*Skeleton v0 — review by Alex before submit. Target deadline 2026-07-15.*
