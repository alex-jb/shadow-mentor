---
title: "Shadow — One Engine, Three Smart-Glass Clients, Five Persona Packs"
subtitle: "Local-only AI Mentor and Compliance Council for Regulated Knowledge Work"
author:
  - Alex Xiaoyu Ji
date: 2026-06-18 (v1.1 — minor update with 2026-06-18 daily-brief signals + Live demo deployed)
geometry: margin=0.9in
fontsize: 11pt
linkcolor: blue
urlcolor: blue
---

# Shadow
## One Engine, Three Smart-Glass Clients, Five Persona Packs

**Canonical product proposal v1.1** — incremental refresh of v1.0 (shipped 2026-06-17) with three signals from the 2026-06-18 morning deep-dive brief plus a live Vercel deployment URL. Architecture unchanged.

### What's new in v1.1 (since 2026-06-17)

1. **GLM-5.2 open weights** (Zhipu) — added as the 5th local-LLM router option, sitting between Gemma 3 9B and Apple Foundation Model 3 Core Advanced in the on-device LLM lineup. GLM-5.2 took the #1 Artificial Analysis open-weight slot on 2026-06-17 and unlocks a Mainland-China-friendly compliance posture for secondary-market expansion (CITIC / Haitong / HuaTai analyst classes).

2. **Elastic agent-memory** — added as the cross-session memory backend candidate, replacing the planned pgvector approach. Published recall metric of **0.89** on long-horizon multi-turn agent recall. Unlocks Shadow Phase 2 cross-session learning, which the hash chain alone cannot answer without retrieval.

3. **HuggingFace `Is it agentic enough?` benchmark** — adopted as Shadow's first quantified agentic-capability score. Replaces the prior "41 tests green" framing (which measured unit-test coverage, not agentic capability). Plan to publish Shadow's score in v1.2 post-IRB.

4. **Live demo deployed**: https://shadow-mentor-q0lg7uwz4-alex-jbs-projects.vercel.app — real Anthropic Claude Sonnet 4.6 council backend on Vercel, 4-device × 5-persona × 4-scenario matrix browser-runnable. Deployment Protection toggle pending; URL fully public after toggle.

Architecture unchanged. v1.1 supersedes v1.0 in all customer-procurement and VC-pitch contexts.

---

## 1. Executive Summary

Shadow is the **on-device AI council** that runs locally on the user's laptop and three classes of smart glasses. The engine is the same for every user. The smart-glass client adapts to *what the user is doing right now*, and the persona pack adapts to *who the user is*.

The result is a **regulator-grade, local-only, hardware-flexible** AI mentor and compliance second-opinion layer that no Cloud-only competitor (Glean, Microsoft Copilot, Goldman GS-AI, JPM LLM Suite) can match, because the moat is the *on-device + smart-glass + persona-aware* composition, not any single one of these.

Same engine. Three glass clients. Five persona packs. Fifteen recognized scenarios. One regulated-grade contract per bank.

---

## 2. The Problem — Regulated Knowledge Work Has Five Stuck Personas

Across mid-tier US banks ($5B-$50B AUM), five distinct roles each face a stuck workflow:

- **Compliance officers** rubber-stamp by 3pm because every loan file feels template-identical, and OCC examiners demand contemporaneous evidence of contrarian challenge that 2D Word memos cannot produce.
- **Quantitative analysts and data scientists** know their model PSI tripped on a feature drift, but the next question — *which feature, on which sub-population, contributed how much* — requires writing a SHAP-attribution notebook from scratch, every time.
- **Software engineers** integrate ML services into the credit-decisioning critical path without spatial awareness of where Fair Lending data needs to be redacted, where service boundaries should be async, or where covered attributes need explicit Reg B logging.
- **Traders and portfolio managers** watch a 2D correlation heatmap that hides the time-varying regime shift behavior — the very thing that wipes out portfolios in stress.
- **Wealth advisors** sit across a table from HNW clients while pulling out a laptop or a tablet to look up Reg BI suitability data, breaking eye contact and customer trust precisely when the trust matters most.

A single 2D dashboard cannot serve all five. Neither can a single XR form factor. Neither can a generic LLM chat box behind a compliance gateway.

What can serve all five is **one engine** that emits the same JSON verdict, **three glass clients** that render the verdict at the right cognitive density for the moment, and **five persona packs** that load role-specific voices, jargon, regulations, and historical Brier audits.

---

## 3. The Architecture — One Engine, Three Clients, Five Packs

```
              ┌─────────────────────────────────────────────┐
              │           Shadow Engine (shared)            │
              │                                             │
              │  council-runner: Promise.all fan-out        │
              │  ├ junior voice (LLM A)                    │
              │  ├ senior voice (LLM B)                    │
              │  └ third voice  (LLM C — compliance /      │
              │                  model-risk / fiduciary)    │
              │                                             │
              │  Local LLM router:                          │
              │  ├ Apple Foundation Model 3 Core Advanced  │
              │  ├ Phi-4-mini (3.8B, MMLU 68)              │
              │  ├ Gemma 3 9B (MMLU-Pro 82.5)              │
              │  ├ GLM-5.2 (Zhipu, AA #1 open-weight, NEW) │
              │  └ Cloud fallback (Claude / GPT)           │
              │                                             │
              │  Hash-chain audit: SHA-256 WebCrypto        │
              │  Perception Layer: YOLO-World + SAM2 +     │
              │                    Depth Anything V2        │
              └─────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       ┌──────────┐   ┌───────────────┐   ┌──────────────────┐
       │ 🖥 Desktop│   │ 👓 Even G2    │   │ ✨ XReal Air 2 U │
       │ macOS app│   │ + 🕶 Frame    │   │ JARVIS spatial AR│
       │ overlay  │   │ flat HUD      │   │ 3D floating panels│
       │ full     │   │ glasses       │   │ + bone conduction│
       │ 3-voice  │   │ 1-2 voice    │   │ + full 3-voice   │
       └──────────┘   └───────────────┘   └──────────────────┘
                              │
              ┌────────┬──────┼──────┬────────┐
              ▼        ▼      ▼      ▼        ▼
           🛡 Compl.  🧮 Quant 💻 Eng 📈 Trader 💼 Advisor
           pack       pack    pack   pack      pack
           $1,800/y   $2,400  $1,500 $2,400    $2,000
           per seat   /seat   /seat  /seat     /seat
```

**Same JSON verdict**. The engine emits the same data: 3 voice verdicts with rationale, a follow-up question, a recognized-context tag, and a hash-chain entry. What changes is *which client renders it* (desktop vs glasses vs XReal AR) and *which persona pack supplies the voices and the domain knowledge*.

---

## 4. The Persona × Device Matrix — What Each Combination Produces

This is the heart of the product. Each cell describes the **concrete output the user sees** in that combination.

### 🛡 Compliance Officer

| | 🖥 Desktop | 👓 Even G2 (no camera) | 🕶 Brilliant Frame (camera, local) | ✨ XReal Air 2 Ultra (spatial AR, camera, local) |
|---|---|---|---|---|
| Best fit? | ✅ Daily review of 30-50 loans | ✅ **Primary** during customer meetings | ⚠ Camera = customer trust issue | ⚠ Overkill for paperwork |
| What user sees | Right-side panel: 3-voice rationale, follow-up question, fair-lending flag table | Single contrarian whisper: *"DTI 47% > Policy 4.3 ceiling. Why approve?"* in green monocular HUD | Color HUD with 2 voices + flag icons on borrower attributes | Not the primary device; reserved for quarterly exam-prep deep dives where compliance officer walks past 30 past denials in a calibration corridor |
| Audit output | Full hash-chained transcript: text response logged + timestamp | Bone-conduction whisper response transcribed to chain | Same as G2 but with screen-region tag | Gaze-dwell timeline added to chain (eye tracking proves the officer actually viewed the disparate-impact flag) |

### 🧮 Quant / Data Scientist

| | 🖥 Desktop | 👓 Even G2 | 🕶 Brilliant Frame | ✨ XReal Air 2 Ultra |
|---|---|---|---|---|
| Best fit? | ✅ IDE work, notebook attribution | ⚠ Too low-bandwidth for SHAP / drift | ✅ Reviewing internal model docs | ✅ **Primary** for AML graph + fraud manifold |
| What user sees | Drift attribution panel: feature × sub-population × contribution table next to the Jupyter notebook | Single whisper if PSI tripped: *"3 features drifted. Sub-population: consumer-discretionary."* | Color HUD: 2 voices on top of a model-card PDF + "run SHAP" suggestion | **JARVIS mode:** 3 floating panels anchored to physical desk. (1) 3D fraud feature-space UMAP — walk around to find misclassified cluster. (2) Counterparty network 5K-node walk-through. (3) Drift attribution timeline. Bone-conduction whispers model-risk reviewer's challenge. |
| Audit output | Notebook cell + SHAP output hash-chained | Voice transcript | Same | Gaze + walking trajectory + which floating panel was inspected — all hash-chained for SR 26-2 (formerly SR 11-7) effective challenge evidence |

### 💻 Software Engineer

| | 🖥 Desktop | 👓 Even G2 | 🕶 Brilliant Frame | ✨ XReal Air 2 Ultra |
|---|---|---|---|---|
| Best fit? | ✅ **Primary** in IDE | ⚠ Too low-bandwidth | ✅ Internal doc / runbook reading | ⚠ Overkill |
| What user sees | Right-side panel + inline code annotations: "this endpoint takes regulated PII, log to Reg B store before returning" | Single whisper for emergency Slack alerts: *"deploy on hold — security scan flagged your PR"* | Color HUD on top of a Confluence runbook, highlights the section the engineer is reading + suggests adjacent runbooks | Not primary; XReal is for visual data work, not IDE work |
| Audit output | Code-change-to-decision link in hash chain | n/a | Doc-section-viewed timeline | n/a |

### 📈 Trader / Portfolio Manager

| | 🖥 Desktop | 👓 Even G2 | 🕶 Brilliant Frame | ✨ XReal Air 2 Ultra |
|---|---|---|---|---|
| Best fit? | ✅ Daily Bloomberg work | ✅ During client / desk-team meetings | ⚠ Camera in IB = MNPI risk | ✅ **Primary** at own desk for risk-surface + tail-risk |
| What user sees | Right-side panel: 3 trader voices (Buffett value / Druckenmiller macro / Taleb tail) + bias constellation snapshot | Single whisper during desk meetings: *"counterparty 17 is on watchlist"* | Not the primary use case | **JARVIS mode:** 3 floating panels — (1) 3D risk surface (VaR + ES + concentration on 3 axes) — walk around to find the cliff. (2) Bias constellation: 30 past trades clustered, walk to inspect biases. (3) Correlation surface across regimes — drag time slider, watch 2007→2009 deformation. Bone-conduction council whispers. |
| Audit output | Brier-audited trade thesis log | Voice transcript | n/a | Gaze + walking + decision-time log — full forensic replay for post-mortem |

### 💼 Wealth Advisor

| | 🖥 Desktop | 👓 Even G2 | 🕶 Brilliant Frame | ✨ XReal Air 2 Ultra |
|---|---|---|---|---|
| Best fit? | ✅ Portfolio review at desk | ✅ **Primary** in client meetings | ⚠ Camera kills client trust | ⚠ Overkill |
| What user sees | Right-side panel: 3 advisor voices + Reg BI suitability flag + IPS gap analysis | Single whisper: *"client mentioned 401k rollover — Reg BI suitability checklist surfacing"* + adverse-action-safe phrasing for the IPS conflict | n/a | Not primary; could be used for quarterly book review |
| Audit output | IPS-aligned recommendation log | Conversation transcript with timestamped Reg BI checks | n/a | n/a |

### Summary — what each cell *produces*

**Desktop = full bandwidth, every voice, every detail**. The universal fallback. Where heavy review work actually gets done.

**Even G2 = single contrarian whisper + transcription**. The customer-facing primary. Where adverse-action evidence is captured during conversation without breaking trust.

**Brilliant Frame = color HUD + 2 voices + camera context**. The internal-doc reading and runbook-walk-through device. Where junior staff get explainer-style HUD prompts on real-world documents.

**XReal Air 2 Ultra = JARVIS spatial AR + 3 floating panels + bone conduction**. The power-user device. Where 3D data work (AML graph, fraud manifold, risk surface, bias constellation, correlation regime) becomes physically inspectable.

---

## 5. Local-only Mode — The Moat

Every glass client + the desktop overlay has two modes:

- **Cloud mode**: screen capture → Anthropic / OpenAI / Gemini → response. For non-confidential training data, public market signals, educational content. $50/seat/month consumer SKU.
- **Local mode** (the moat): screen capture → on-device Apple Foundation Model 3 Core Advanced, Phi-4-mini, Gemma 3 9B, or Mistral Small 3 → response. **No data leaves the device.** Frame discarded in 200ms. Voice transcripts redacted of PII before hash-chain commit. Hash chain entry only includes the *response*, never the source frame.

### What local mode solves

- ✅ Data residency (GLBA / HIPAA / GDPR Article 25 data minimization)
- ✅ Data upload (no packet inspection, no third-party DPA chain)
- ✅ Vendor concentration risk (no Anthropic / OpenAI dependency)

### What local mode does NOT solve

- ❌ "Camera exists" liability under 2-party consent state law (California, Illinois, Massachusetts, Pennsylvania) — solved by selecting **Even G2 (no camera)** for the customer-facing cells of the matrix
- ❌ Customer trust during meetings — solved by Even G2 device choice
- ❌ E&O insurance and HR policy — solved by Even G2 + Desktop, and by limiting camera-equipped glasses to no-customer-present scenarios

### The cross-tier audit chain works in local mode

Every persona × device combination contributes to the same SHA-256 hash chain. The chain stores:

- Recognized context (screen / scene tag)
- Question surfaced by the council
- Voice transcript (challenge text + user verbal or gestural response)
- Gaze-dwell timeline (Vision Pro / XReal eye tracking)
- Hand-gesture confirmation (approve / block / escalate)

Exportable to OCC, CFPB, FINRA, SEC, EU AI Act Article 14 audit submission formats. All generated on-device. Zero cloud dependency.

---

## 6. Pricing Model

```
Shadow Banking · Enterprise License
─────────────────────────────────────
Base engine                            $120,000/year (no seat cap)
─── Persona Packs (per seat per year) ──
🛡 Compliance                          $1,800/seat
🧮 Quant / Data Scientist              $2,400/seat
💻 Engineering                         $1,500/seat
📈 Trader                              $2,400/seat
💼 Wealth Advisor                      $2,000/seat
─── Hardware (sold separately) ──────────
👓 Even G2                             $599  one-time per user
🕶 Brilliant Frame                     $349  one-time per user
✨ XReal Air 2 Ultra                   $699  one-time per user
─────────────────────────────────────
```

Sample mid-tier bank deployment (1,000 employees):

| Persona | Seats | Pack $/yr | Subtotal |
|---|---|---|---|
| Compliance | 200 | $1,800 | $360K |
| Quant + Data Scientist | 50 | $2,400 | $120K |
| Software Engineering | 100 | $1,500 | $150K |
| Trader | 30 | $2,400 | $72K |
| Wealth Advisor | 80 | $2,000 | $160K |
| Base engine | — | — | $120K |
| **Total annual contract value** | **460 seats** | — | **$982,000** |

**3-year SOM target**: 5 mid-tier banks × $982K/yr = $4.9M ARR. Series A scale.

---

## 7. Hardware Procurement Tiers (employer-paid)

- **Tier 0 — no glasses**: Desktop only, every employee. $0 hardware cost.
- **Tier 1 — G2 for customer-facing roles**: 280 G2 units × $599 = **$168K one-time**. Covers all Compliance + Wealth Advisor.
- **Tier 2 — XReal Air 2 Ultra for power users**: 80 XReal units × $699 = **$56K one-time**. Covers all Quant + Trader.
- **Tier 3 — Brilliant Frame for engineers**: 100 Frame units × $349 = **$35K one-time**. Optional, only if engineering team requests.

**Total Tier 1+2+3 hardware**: ~$260K one-time. Inside the typical mid-tier bank discretionary tech budget.

---

## 8. Roadmap

| Quarter | Milestone |
|---|---|
| **2026 Q3** | macOS Desktop app (native ScreenCaptureKit + local Phi-4-mini, Gemma 3 9B). First 3 persona packs (Compliance / Quant / Trader). Hash-chain audit export. Browser demo (live now). |
| **2026 Q4** | Even G2 SDK integration (Conversate audio + bone conduction). 5 persona packs complete. SOC 2 Type 1 in progress. 5 mid-tier wealth-mgmt firm cold-email round. |
| **2027 Q1** | First paid pilot — 1 mid-tier bank, Compliance pack, Desktop + Even G2. SOC 2 Type 1 issued. |
| **2027 Q2** | Brilliant Frame integration (color HUD). EU AI Act high-risk obligations live (2026-08-01 entry-into-force) — Shadow's local-only audit positioning aligns with the August deadline. |
| **2027 Q3** | XReal Air 2 Ultra NRSDK integration (JARVIS spatial AR mode). First Quant + Trader pilots. ICAIF 2027 paper submission. |
| **2027 Q4** | Series A fundraise. 5 paying mid-tier bank contracts. $4-5M ARR. |
| **2028** | Apple Vision Pro 2 (rumored binocular + cheaper) — add as Tier 4 device. Mainstream consumer-grade glasses. Expand from mid-tier to top-tier banks. |

---

## 8.5 Cross-Session Memory (new in v1.1)

Hash-chain audit captures every decision but does not, by construction, answer the question "which loans has analyst Maya reviewed in the last 90 days, with what rationale, and what was the Brier-audited outcome." For that retrieval, Shadow integrates with **Elastic agent-memory** as the cross-session memory backend.

The Elastic recipe (announced 2026-06-17, recall 0.89 on long-horizon multi-turn agent recall) is the first published baseline for agent memory layers and replaces the previous plan to roll our own pgvector-backed memory. The deployment posture: per-analyst Elasticsearch index, on-premises in the customer's environment, ingest = the hash chain itself + tagged metadata (loan ID, persona, scenario, voice verdict, Brier outcome when later resolved). Retrieval is read-only and consent-gated.

This is the engine behind the "calibration corridor" XR experience in the trading-quest and banking-quest WebXR demos — walking past 30 prior decisions requires both the spatial anchoring (Three.js) and the retrieval layer (Elastic agent-memory), and the latter was unspecified in v1.0.

## 8.6 Quantified Agentic Capability (new in v1.1)

HuggingFace published *Is it agentic enough?* on 2026-06-17 — the first framework for quantifying tool-calling and multi-step reasoning capability across agentic LLM systems. Shadow's prior framing was "41 tests green" (council-runner + perception + orallexa-risk) which measures **unit-test pass rate**, not **agentic capability**. v1.1 adopts the HuggingFace framework as the canonical agentic-capability benchmark; Shadow's score on the framework will be published in v1.2 post-IRB.

Why this matters: bank procurement decks regularly cite the *Kraus 2022 CGF immersive analytics survey* for visualization claims and the *MMLU-Pro 82.5 for Gemma 3 9B* for LLM capability claims. Neither addresses agentic-decision-pipeline capability. HuggingFace's framework fills that gap and gives Shadow a citable objective number for the procurement deck.

## 9. Defensibility

**Against Glean / Microsoft Copilot / Notion AI**: they are cloud + corpus-search; we are local + screen-aware + persona-aware.

**Against Goldman GS-AI / JPM LLM Suite / Citi Stylus / Morgan Stanley AI@Morgan**: they are top-10 internal builds; we sell to mid-tier banks that lack the engineering bench.

**Against Cluely** ($5.3M raised, "cheat on everything" consumer overlay): closest UX competitor but consumer-positioned, brand cannot enter compliance-sensitive enterprises, ARR claims inflated and disputed March 2026.

**Against future Meta / Apple glasses**: hardware-neutral architecture means we add new device clients as they ship. Hardware refresh ≠ product reset.

**Against academic-only competitors (ECC research repo, university spin-offs)**: founder has shipped 41 tests green across the council-runner stack + 18 tests on retry primitives + production cron + 30-day Brier audit. Engineering credibility, not just thesis.

---

## 10. Founder Credibility Wedge

- **Embodied Compliance Council** research with Dr. Henry Ngo (Yeshiva, banking compliance vertical) — EU AI Act + ECOA / Reg B framing locked through accepted academic deliverable
- **Phase 4 EU AI Act + ECOA evaluation design** doc (`docs/phase-4-eu-ai-act-evaluation-design.md`)
- **council-runner v0.1.0** shipped 2026-06-17, 41 tests green, Vercel-deployable, Apache 2.0
- **Bilingual EN/中文** ship discipline opens secondary China-side market (CITIC, Haitong, HuaTai analyst classes) post-2027
- **Solo Founder OS** 11-agent open-source stack — public proof of operating discipline

---

## 11. The One-Sentence Pitch

**Shadow is the on-device AI council and audit chain that follows the user across desktop, smart glasses, and spatial AR, deploying role-specific voices for compliance officers, quants, engineers, traders, and wealth advisors at mid-tier US banks — never uploading data, never breaking customer trust, and producing the contemporaneous evidence that regulators are about to demand.**

---

## Appendix — Tech Stack Snapshot (2026-06-17)

| Layer | Stack | Status |
|---|---|---|
| Council orchestration | `council-runner` (TypeScript, Promise.all, weighted aggregation) | Live, 23 tests green |
| Voice prompts | `council-voices` (10 banking + trading personas, YAML frontmatter, strict-JSON output) | Live |
| Risk math | `orallexa-risk` (VaR, ES, factor exposures, beta, concentration, sector, correlation) | Live, 11 tests green |
| Perception (screen-region) | `embodied-perception` (YOLO-World, SAM2, Depth Anything V2 protocols + Mocks + SceneGrounder) | Live, 7 tests green |
| Audit | WebCrypto SHA-256 hash chain | Live, 4 tests green |
| Local LLM | Phi-4-mini, Gemma 3 9B, Apple Foundation Model 3 Core Advanced, Mistral Small 3 | All available 2026 |
| Cloud LLM | Anthropic Claude Opus 4.7 (1M context), GPT-5, Gemini 3 Pro | All available |
| Desktop client | Native macOS ScreenCaptureKit + AppKit overlay | In design, Q3 2026 ship |
| Glasses client (G2) | Even Realities Companion SDK + Conversate | Q4 2026 |
| Glasses client (Frame) | Brilliant Labs Open SDK | Q2 2027 |
| Glasses client (XReal) | NRSDK + WebXR + Three.js | Q3 2027 |
| Bone-conduction audio | Built-in to G2 + AirPods Pro 2 fallback for Frame and XReal | n/a |

---

*Canonical product proposal v1.0 — 2026-06-17. All prior project framing (council-diff as standalone OSS, ECC banking-quest as separate WebXR app, ECC trading-quest as separate app, Shadow as separate Phase 3) is hereby reconciled under this single product narrative. Going forward, every external communication uses this matrix.*
