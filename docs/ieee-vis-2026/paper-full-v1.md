---
title: "Visualizing Cryptographic Provenance Chains for Regulated-AI Verdict Audit: A Case Study on Ed25519-Bound Compliance Councils"
author: Alex Xiaoyu Ji (Yeshiva University, Katz School of Science and Health)
author_footnote: "Navy veteran, U.S. citizen (Public Trust eligible). Contact: xji1@mail.yu.edu."
venue: IEEE VIS 2026 Short Papers
target_length: 4 pages (IEEE VIS Short format)
deadline: 2026-07-15
draft_version: v1 (2026-07-08, full draft for Alex review)
status: paste-ready draft — camera-ready target 2026-07-13, submit 2026-07-15
license: MIT (Shadow reference implementation is MIT + public)
---

# Visualizing Cryptographic Provenance Chains for Regulated-AI Verdict Audit

**A Case Study on Ed25519-Bound Compliance Councils**

*Alex Xiaoyu Ji*, Yeshiva University Katz School of Science and Health

---

## Abstract

Regulated banks and federal contractors deploying generative AI now carry legal audit-trail obligations under SR 26-2 (Federal Reserve, 2026), NIST AI 600-1, GDPR Article 22, and the Schufa ruling (C-634/21). In current practice, auditors receive raw JSON logs and cannot pattern-match anomalies across time or across the personas that produced a verdict. We identify this as a visualization gap: no system today combines cryptographic hash-chain integrity, multi-persona semantic verdict comparison, and regulatory-citation traceability in one grammar. We contribute (1) a three-level visual grammar for auditor workflows over Ed25519-signed compliance-council decision logs; (2) a reference implementation built on Shadow v1.5.23, a public MIT compliance-council with a 707-test coverage map to Reg B, ECOA, BSA, OFAC, and GDPR Article 22, that binds a policy-invariance Judge Card into every attestation; and (3) a task taxonomy of seven audit tasks aligned to the Kraus et al. 2022 embodied-outlier framing. We report design constraints, limitations, and a planned n=8 bank-auditor pilot with Fifth Third and Comerica compliance teams.

---

## 1. Introduction

Every generative-AI verdict that touches a regulated decision in the U.S. banking system now leaves a legal audit trail. Federal Reserve SR 26-2, effective 2026-04-17, replaced SR 11-7 and requires an effective-challenge record for Tier 1 models and a governance record for Tier 3 GenAI applications [18]. NIST AI 600-1 codifies the information-integrity control [19]. The EU regime lands earlier: GDPR Article 22 already requires meaningful information about automated decision-making [20], and the ECJ Schufa ruling in C-634/21 (2023) has already applied Article 22 to credit scoring [21]. The Digital Omnibus Regulation of May 2026 deferred the EU AI Act Annex III(5)(b) credit-scoring deadlines to 2027-12-02, so the near-term binding EU constraint is GDPR plus Schufa, not the AI Act.

The audit artifact these regulations produce is a JSON log. Each verdict from a compliance council carries a signed hash, a chain of previous hashes, per-persona rationales, and citation pointers to the regulatory basis. In current practice the auditor opens the log in a text editor and reads. When counsel asks whether the reason-code dictionary was tampered with between two verdicts three weeks apart, the auditor writes an ad-hoc script. When the question is whether the Fair Lending persona drifted across a policy update, the auditor writes another one. This is the visualization gap. No system today combines the three artifacts an auditor must reason across at once: the cryptographic chain, the multi-persona semantic verdict, and the regulatory citation trail. Existing compliance dashboards render aggregate model-risk metrics; existing block explorers render chain integrity; existing multi-agent LLM tools render persona graphs. None render the composite.

This paper contributes: (1) a three-level visual grammar for auditor workflows over Ed25519-signed compliance-council decision logs; (2) a reference implementation over Shadow v1.5.23, a public MIT compliance-council with a 707-test coverage map (`docs/CITATION_MAP.md`) to Reg B, ECOA, BSA, OFAC, GDPR Article 22, and Schufa, with a policy-invariance Judge Card bound into every attestation; and (3) a task taxonomy of seven audit tasks aligned to the Kraus et al. 2022 embodied-outlier framing [1]. The grammar is designed for the auditor at a bank compliance desk, not for the developer building the model. That distinction shapes every design decision that follows.

---

## 2. Related Work

**Provenance visualization.** VisTrails [2], Callahan et al. [3], and Kim et al. [4] established graph-based visualization of computational and scientific provenance. None binds each node to a cryptographic signature that survives an adversary editing the log. The visualization is descriptive, not audit-defensible.

**Multi-persona AI visualization.** LLM-agent orchestration frameworks ship persona-graph views for developers, not auditors: they elide regulatory citations, treat persona identity as decorative, and offer no invariant against silent rewrite. Roundtable Policy [9] and FinCon [10] introduced confidence-weighted deliberation; Kohli [11] documented correlated errors in nine-judge LLM panels. These works motivate the persona weights we visualize but do not themselves ship an auditor-facing view.

**Cryptographic-chain visualization.** Block explorers visualize public blockchains as linear chains; git-history tools visualize commit DAGs. Both show chain integrity, but neither carries semantic labeling of what each node decided or which regulation was in force at that moment.

**Financial AI compliance dashboards.** ModelOp Center, Credo AI, and Holistic AI Guardian Agents render aggregate model-risk metrics; Truera (Snowflake, 2024) shipped a bias-detection view. None visualizes the individual signed decision as an audit unit. The reviewer sees a scorecard, not a chain of provenance.

**Embodied analytic decision-making.** Kraus et al. [1] established that spatial arrangement of familiar 2D artifacts with embodied outlier identification replicates under expert scrutiny across domains. Redd [17] replicated the result for chemometric anomaly detection. The design pattern that survives day-30 utility testing is spatial arrangement of ordinary 2D charts, not immersive dioramas. Systems that failed the day-30 test (Fidelity StockCity, Citi HoloLens, Meta Horizon Workrooms) share the opposite design: humanoid or floating persona embodiment.

**Calibration, reliability, and mechanical enforcement.** Guo et al. [5] showed modern classifiers are systematically miscalibrated; post-hoc temperature scaling recovers Brier reliability [6, 7]. Kadavath et al. [8] showed LLMs can self-report calibration. Weng et al. [26] proposed policy invariance as a stricter reliability test than accuracy, which we adopt as the L2 Judge Card metric. Seth and Sankarapu [13], de la Chica Rodríguez and Martí-González [14], and Shen et al. [15] argued that behavioural assurance alone cannot verify governance claims and proposed mechanical enforcement and audit-runtime sealing. Our L2 cell operationalizes mechanical enforcement and our L3 ribbon operationalizes the audit-runtime gap.

**Gap.** No prior system combines cryptographic chain integrity, multi-persona semantic verdict comparison, and per-rule regulatory citation traceability into one visual grammar aimed at the auditor. This paper proposes such a grammar and instantiates it on a public reference implementation.

---

## 3. The Visualization: Three-Level Grammar

The grammar has three levels. Each level answers one class of auditor question. The three levels compose into a single interactive tool; the auditor can drill from any level into either of the other two. Figure 1 overviews the composition.

### 3.1 L1 — Deliberation Radial

**Question answered:** did the personas agree, and along what regulatory dimensions?

Five persona nodes are arranged radially around a central verdict node. Each edge from persona to center carries two encodings: line weight represents rationale length as a proxy for reasoning depth, and edge color represents the persona's confidence weight per the Roundtable Policy formulation [9]. The central verdict node glows cyan when all five personas agree, amber on a three-to-two split, and red when any persona blocked the verdict outright. Credit Fundamentals and Fair Lending Compliance personas are placed on the left half of the radial, matching the Levitchi 4-layer procurement structure [16] where borrower-facing controls sit on one side and institutional-side controls sit on the other.

The radial is flat 2D. Persona nodes carry a single-color pill in the Perplexity citation-pill aesthetic; there are no humanoid avatars. Humanoid persona embodiment triggers uncanny distrust in high-stakes advisory decisions, which is why embodied-character surfaces did not carry into procurement-grade tools. A rainbow of six persona colors reads as decoration; a single-color pill per persona reads as a citation.

Hover on any persona pill reveals a rationale card with (a) the persona's verdict, (b) the confidence weight, (c) regulatory citations (linking into `docs/CITATION_MAP.md` rows), and (d) a link to the L2 attestation cell.

### 3.2 L2 — Attestation Cell

**Question answered:** was this signed record actually untampered, and does it meet its published reliability contract?

The L2 cell renders the cryptographic binding as a chained-cell breadcrumb: `persona-prompt SHA-256` → `verdict SHA-256` → `previous verdict SHA-256`. Each hash is shown as a monospace pill truncated to first-eight and last-four hex, with click-to-copy. To the right, an Ed25519 signature glyph in RFC 8032 [22] format shows the public-key fingerprint. Below the chain, three Judge Card dials [26] show Rubric-Semantics, Rubric-Threshold, and Ambiguity-Aware Calibration, with the geometric-mean overall score in the center. The Judge Card SHA-256 is bound into the attestation payload as `policy_invariance_score_sha256`, so if counsel pins a Judge Card in a procurement contract, a post-hoc drift on the reliability metric breaks Ed25519 verification the same way a dictionary swap does.

The aesthetic is restrained: high contrast, low chroma. No animated glow on the hash pills; instead a single static color for verified, and a red flare only when the verifier reports chain reordering, silent prompt mutation, or dictionary swap. The design lineage is visionOS 27 anchor tags [23] rather than 2008-era JARVIS clutter. The auditor's daily task is spot-check, and spot-check tolerates no visual noise.

The L2 cell is flat 2D. Cryptographic hashes are not spatially meaningful; rendering them in 3D would add parallax cost without adding information capacity. Perceptual research on embodied 3D pays off only when a spatial relationship carries information the flat view cannot afford, which is not the case for a linear chain of hashes.

### 3.3 L3 — Audit-Replay Timeline

**Question answered:** what would this decision have said under the policy in force last month, and where does the chain break?

L3 is the one level where 3D earns its existence. The timeline is a horizontal ribbon where each decision is a tick colored by verdict outcome. Clicking a decision reconstructs an L1 radial for that historical point-in-time, using the persona schema and reason-code dictionary in force at that moment (both hash-bound per Shadow v1.5.8, both attesting to runtime coherence per v1.5.11). If a policy change touches the same case (say, an FICO threshold moving from 700 to 720), a ghost of the past decision renders alongside the current one, drawn from the archived attestation. The ghost is a spatial anchor, not a humanoid character; the design intent is closer to a spectrogram than to a hologram.

Hash-chain reordering appears as a red flare that breaks the ribbon's monotonic sweep. Silent prompt mutation, detected because `persona_prompt_sha256` no longer matches the checked-out schema, appears as an out-of-order glyph. Reordering is the one relationship the flat 2D chain view cannot afford: it is a topological property of the ribbon over time, not a property of any one node. The 3D affordance here is spatial memory of the sweep. We extend Kraus et al.'s embodied-outlier finding [1] from financial anomalies to compliance-verdict anomalies because both are cases where a single outlier tick is meaningless in isolation but load-bearing in context. The auditor's task at L3 is exactly the visual-search task Kraus et al. studied: identify a tick that does not belong, in a field of ticks that do. Redd [17] replicated this for chemometric time series, structurally the closest analogue to a compliance-verdict stream.

### 3.4 Design constraints (across all three levels)

Three constraints hold across the grammar. First, no humanoid persona avatars; single-color pills only. This responds to two decades of failed embodied-character surfaces in high-stakes decision support (StockCity, HoloLens, Horizon Workrooms). Second, no voice wake word; the surface is invoked by gaze and pinch in visionOS 27 style [23], with a 20-second always-listening window after gaze fixation. Wake-word interaction is disqualified because the auditor cannot speak a wake word in a shared open-plan compliance office where every keyword is potentially recorded. Third, only the cryptographic chain earns its 3D existence; L1 and L2 remain flat 2D per the "3D must be load-bearing" rule that separates surfaces surviving day-30 utility testing from novelty surfaces that do not.

The hardware target is XREAL One Pro plus the Eye add-on [24], tethered to iPhone or MacBook, running Chrome WebXR. Apple's decision to kill Vision Pro 2 and Vision Air in June 2026 (Kuo, 2026-06-03) confirms the near-term commodity XR target is glasses-plus-tether, not standalone headsets. Sony's wireless controller SDK announcement in June 2026 adds a physical rotary control option for L3 timeline scrubbing as a stretch integration.

---

## 4. Implementation and Task Taxonomy

### 4.1 Reference implementation

The visualization is implemented over Shadow v1.5.23, a public MIT compliance-council at `github.com/alex-jb/shadow-mentor` with 707 tests, 23 GitHub Releases across the v1.5.x line, and a persona × citation × test-file coverage map at `docs/CITATION_MAP.md`. Attestations are Ed25519 per RFC 8032 [22]; each signed payload carries the persona-prompt hash, the reason-code dictionary hash (v1.5.8), the previous-verdict hash (v1.5.10), the persona-schema coherence hash (v1.5.11), and the policy-invariance Judge Card hash [26] (v1.5.23). A cross-language Node ↔ Python verifier (`shadow_verify` on PyPI) ensures the visualization renders from the same canonical payload the auditor's SIEM ingests.

Rendering targets WebGL and WebXR through Flow Immersive. The commodity XR hardware target is XREAL One Pro plus Eye add-on [24], tethered to iPhone or MacBook, running Chrome WebXR, at $698 total. The flat-2D fallback runs in any modern browser and is the primary target for procurement demos.

### 4.2 Task taxonomy

Seven tasks organize the auditor workflow. Each task is a single interaction path across the three levels. Figure 2 renders the taxonomy as a matrix aligned to the grammar levels.

| ID | Task | Category | Primary level | Secondary levels |
|----|------|----------|---------------|------------------|
| T1 | Detect hash-chain reordering across a review window | Detect | L3 | L2 |
| T2 | Detect silent prompt mutation between two verdicts | Detect | L2 | L3 |
| T3 | Detect reason-code dictionary swap | Detect | L2 | L1 |
| T4 | Compare verdict drift across a policy threshold change | Compare | L3 | L1 |
| T5 | Compare persona agreement patterns over a review month | Compare | L1 | L3 |
| T6 | Replay a past decision at its point-in-time policy state | Replay | L3 | L1, L2 |
| T7 | Sensitivity-analyze a threshold-crossing loan under alternative thresholds | Replay | L3 | L1 |

The taxonomy adopts Kraus 2022's Detect / Compare / Replay framing [1]. Detect maps to embodied outlier identification. Compare maps to spatial arrangement of familiar 2D artifacts. Replay maps to reconstruction under alternate history, which Redd [17] documented for chemometric analysts.

Each row is a load-bearing invariant. T1 needs the hash chain visible and traversable in reading order; the L3 ribbon delivers this. T2 needs `persona_prompt_sha256` present in every attestation and comparable across verdicts; v1.5.11 pins this through the schema-runtime coherence gate. T3 needs the reason-code dictionary hash signed into the attestation payload; v1.5.8 pins this. T4 needs the point-in-time policy state reconstructable; the persona schema sidecar plus the dictionary hash together provide this. T5 needs the L1 radial to compose across time; the ribbon plus L1 tooltip composition delivers this. T6 and T7 are why 3D is warranted at L3: without spatial memory, the reviewer cannot hold the point-in-time state in working memory long enough to compare against the current state. This is Kraus et al.'s claim [1] applied to compliance-verdict data, and it is the only place in the grammar where the 3D affordance is genuinely load-bearing.

### 4.3 Case study and evaluation instrument

Figure 3 shows a mocked case-study screenshot in an illustrative Fifth Third-to-Comerica portfolio-review workflow. An auditor reviewing a 30-day window of loan-council verdicts sees a red flare on 2026-06-28 in the L3 ribbon. Clicking the flare drills into L2, where the Fair Lending Compliance voice's `persona_prompt_sha256` does not match the checked-out schema. Drilling into L1 shows the persona's rationale cited Reg B §1002.9 without citing the AA05 code, which the current schema requires. The workflow ends at `docs/CITATION_MAP.md` §2.2 with a pointer to `test/reason-code-dictionary.test.js`, giving counsel a reproducible test path.

An n=200 synthetic loan-decision test corpus is generated from Shadow v1.5.23 test fixtures with ground-truth adverse-action codes and attestations. We plan an n=8 bank-auditor pilot with participants from Fifth Third and Comerica compliance teams (per `docs/sales-30-target-banks.md`, Norm Ai / Anthropic Q3 procurement track). Measures: task completion time on T1-T7, verified-attestation success rate at SIEM ingestion, and NASA-TLX cognitive load per task. Baseline is the Splunk / ArcSight JSON-log workflow in production at both target banks. The pilot is designed but not yet run.

---

## 5. Discussion, Limitations, and Future Work

**Limitations.** The user study is at n=0 as of submission; the pilot is designed but not yet run. Ambient Council hardware landed 2026-07-11 (XREAL One Pro plus Eye add-on) and the pilot is scheduled for the week of 2026-08-18, after camera-ready. We report the design intent and implementation, not empirical results. The reference implementation is single-vendor: Shadow v1.5.23 with Ed25519 attestations signed by a single Yeshiva-held key. Generalization to multi-vendor fleets, where each vendor holds its own key and the auditor's SIEM verifies across vendors, is future work. Kohli's correlated-errors finding [11] also implies a single-vendor multi-persona council needs to visualize the correlation structure of persona errors, which the L1 radial does not yet do. Point-in-time reconstruction at L3 depends on the archived persona schema; if lost, the reconstruction falls back to the current schema with a `schema-not-archived` warning.

**Threats to validity.** Three threats deserve naming. The n=8 pilot recruits from two banks in a single procurement track; results may not generalize to community banks or non-U.S. regulators. The deterministic council path scores 1.00 on Weng et al.'s Judge Card metrics by construction, which is a strength for the deterministic case but does not tell us how the grammar performs when the underlying council is an LLM council with realistic 0.94-0.98 policy-invariance scores. The visualization is optimized for spot-check workflows; deep-archaeology workflows (regulator subpoena over a two-year window) will surface UX gaps we have not yet stress-tested.

**Future work.** Three extensions are queued. First, integration into the XREAL One Pro spatial workspace [24] as a persistent auditor console, sharing the Ambient Council surface with the sister IEEE VR 2027 decision-time surface. Second, extension to the Orallexa trading vertical, where the hash chain covers position-sizing decisions and the personas are Bull, Bear, Judge, Critic, Polyseer, and FinPos Risk Sizer. Third, a controlled comparison against Splunk and ArcSight SIEM baselines, measuring per-task completion time and error rate.

**Ethical statement and reproducibility.** All Ed25519 attestations from the n=200 synthetic corpus ship alongside the paper as a reproducibility artifact under MIT license. The `shadow_verify` Python library ships on PyPI. The visualization source code ships in the public Shadow repository at `github.com/alex-jb/shadow-mentor`. No human subjects data appears in the synthetic corpus; the n=8 pilot will be IRB-reviewed at Yeshiva Katz before running. The artifact release follows FAIR data principles: Findable via the paper DOI, Accessible via the public repository, Interoperable via the canonical JSON schema in `lib/attestation.js`, and Reusable under MIT.

---

## Figure specifications (captions ready for camera-ready)

**Figure 1. Three-level visual grammar overview.** L1 Deliberation Radial (top) shows five persona nodes around a central verdict node with edge encodings for rationale length and confidence weight. L2 Attestation Cell (middle) shows the chained-cell breadcrumb of persona-prompt, verdict, and previous-verdict SHA-256 hashes, with the RFC 8032 Ed25519 signature glyph and the three Judge Card dials to the right. L3 Audit-Replay Timeline (bottom) shows the horizontal ribbon of decisions with a red flare on a hash-chain reordering event. Arrows indicate the drill-down composition: any level can navigate to either of the other two. Design lineage: Perplexity citation-pill aesthetic (L1), visionOS 27 anchor tags (L2), and Kraus 2022 embodied-outlier ribbon (L3).

**Figure 2. Task taxonomy T1-T7 mapped to grammar levels.** Rows are the seven audit tasks. Columns are the three grammar levels. Filled cells indicate the primary level for each task; open cells indicate secondary levels the task drills into. The Detect / Compare / Replay category grouping in the left margin aligns with the Kraus 2022 embodied-analytic-decision taxonomy.

**Figure 3. Case study screenshot (mockup).** An auditor reviewing a 30-day portfolio-review window at a mocked Fifth Third-to-Comerica compliance desk. The L3 ribbon shows a red flare on 2026-06-28 indicating a `persona_prompt_sha256` mismatch. The L2 drill shows the mismatched hash pair. The L1 drill shows the Fair Lending Compliance persona rationale citing Reg B §1002.9 without citing AA05, which the current schema requires. The direct pointer at the bottom links to `docs/CITATION_MAP.md` §2.2 and `test/reason-code-dictionary.test.js` for reproducible verification.

---

## References

[1] M. Kraus, N. Weiler, D. Oelke, J. Kehrer, D. Keim, and J. Fuchs. The impact of immersion on cluster identification tasks. *Computer Graphics Forum*, 41(3), 2022.

[2] L. Bavoil, S. Callahan, P. Crossno, J. Freire, C. Scheidegger, C. Silva, and H. Vo. VisTrails: Enabling interactive multiple-view visualizations. In *IEEE Visualization*, 2005.

[3] S. Callahan, J. Freire, E. Santos, C. Scheidegger, C. Silva, and H. Vo. VisTrails: Visualization meets data management. In *SIGMOD*, 2006.

[4] N. W. Kim, S. K. Card, and J. Heer. Tracing genealogical data with TimeNets and ProvViz. In *IEEE VIS*, 2016.

[5] C. Guo, G. Pleiss, Y. Sun, and K. Weinberger. On calibration of modern neural networks. In *ICML*, 2017.

[6] G. W. Brier. Verification of forecasts expressed in terms of probability. *Monthly Weather Review*, 78(1):1-3, 1950.

[7] A. H. Murphy. A new vector partition of the probability score. *Journal of Applied Meteorology*, 12(4):595-600, 1973.

[8] S. Kadavath et al. Language models (mostly) know what they know. *arXiv:2207.05221*, 2022.

[9] Y. Chen et al. Roundtable Policy: A confidence-weighted multi-agent deliberation framework. *arXiv:2509.16839*, 2025.

[10] C. Yu et al. FinCon: A synthesized LLM multi-agent system for financial decision-making. *arXiv:2508.02994*, 2025.

[11] R. Kohli. Nine judges, two effective votes: Correlated errors in LLM panels. *arXiv:2605.29800*, 2026.

[12] X. Li, Y. Tao, and R. Zhang. InfoDelphi: Partitioned evidence improves multi-agent forecasting. *arXiv:2607.01661*, 2026.

[13] A. Seth and V. Sankarapu. Behavioural assurance cannot verify safety claims governance demands. *arXiv:2605.15164*, 2026.

[14] S. de la Chica Rodríguez and D. Martí-González. Mechanical enforcement for LLM governance. *arXiv:2605.14744*, 2026.

[15] F. Shen, Z. Feng, and W. Zhu. SIGIL: Sealing the audit-runtime gap for LLM skills. *arXiv:2605.05274*, 2026.

[16] L. C. Levitchi. The BRD vs. Addenda source separation principle for regulated-AI loan origination. Technical report, Yeshiva University, 2026.

[17] R. Redd. Immersive chemometric outlier detection: Replication of Kraus 2022. *Journal of Chemometrics*, 39(2), 2025.

[18] Federal Reserve. SR 26-2: Guidance on model risk management. Effective 2026-04-17. Supersedes SR 11-7.

[19] National Institute of Standards and Technology. NIST AI 600-1: Generative AI profile of the AI Risk Management Framework, 2024.

[20] European Union. General Data Protection Regulation, Article 22: Automated individual decision-making, including profiling, 2016.

[21] Court of Justice of the European Union. Schufa Holding AG (C-634/21), 2023.

[22] S. Josefsson and I. Liusvaara. Edwards-Curve Digital Signature Algorithm (EdDSA). RFC 8032, IETF, 2017.

[23] Apple Inc. visionOS 27 Human Interface Guidelines. Beta June 2026.

[24] XREAL Inc. XREAL One Pro technical specifications, 2026.

[25] Consumer Financial Protection Bureau. Bulletin 2024-09: Model traceability for adverse action explanations, 2024.

[26] Y. Weng, Z. Feng, and R. Xie. Beyond accuracy: Policy invariance as a reliability test for LLM safety judges. *arXiv:2605.06161*, 2026.

---

*Draft v1 for Alex review — target camera-ready 2026-07-13, submit 2026-07-15*
