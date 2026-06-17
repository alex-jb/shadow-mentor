---
tags: [research, market, competitive, local-llm, smart-glasses, founder-verdict]
date: 2026-06-17
status: external research memo for Shadow product definition
---

# Shadow — Deep Research Memo

External agent research output (2500 words). Top finding pulled to top.

## Top finding — don't bury the lede

**Shadow is real-product-shaped but mis-named as an AR play.** The wedge that survives 2026 scrutiny is a **desktop / mobile "compliance-safe shadow mentor" running locally on a 13-inch MacBook Pro, sold into the first 90 days of an investment-banking analyst class** — not a smart-glasses startup.

Hardware verdict for 2026:
- **Meta Ray-Ban Display** ($799): 12MP camera but camera is on the glasses, not pointed at the screen. Wrong wedge.
- **Even Realities G2** ($599): no camera. Dead on arrival for this use case.
- **Apple Vision Pro** ($3499): too expensive for an intern. Vision Pro is a 2027-2028 form factor.
- **The 2026 enterprise smart-glasses market** is 90%+ field-service / manufacturing, not white-collar onboarding.

**Verdict: desktop-first. Glasses are the act-3 visionary slide, not the wedge.**

## Market sizing

| Metric | Value | Source |
|---|---|---|
| US 20s bachelor's degrees Jan-Oct 2024 | 1.2M (69.6% employed) | [BLS 2025](https://www.bls.gov/opub/ted/2025/employment-status-of-recent-associate-degree-recipients-and-college-graduates.htm) |
| Big 4 grad hires 2025 | ~5,000 (down 6-29% YoY) | [Accountancy Age](https://accountancyage.com/2025/06/23/the-big-fours-new-favourite-grad-is-ai/) |
| Wall Street IB analyst classes | ~3,000/yr | industry estimate |
| AmLaw 100 first-year associates | ~7,000/yr | industry estimate |
| Big Tech new-grad eng | 30,000+/yr | industry estimate |
| Cost per hire (SHRM) | $4,700 avg, $3,000+ onboarding | [Devlin Peck](https://www.devlinpeck.com/content/employee-onboarding-statistics) |
| Time to full productivity | 12 months (25% productive month 1) | [Gallup](https://www.gallup.com/workplace/235121/why-onboarding-experience-key-retention.aspx) |
| L&D spend per employee | $1,054 average, $1,097-$1,331 financial services | [ATD](https://www.td.org/content/atd-blog/7-reasons-not-to-cut-your-l-and-d-budget) |
| US corporate training spend 2025 | $102.8B | [Training Magazine via LMSPedia](https://lmspedia.org/corporate-training-budgets-2026-benchmarks/) |

**TAM / SAM / SOM (defensible, not hype):**
- **TAM**: $15B (15% of $102.8B addressable to AI-augmented onboarding)
- **SAM**: $720M/yr (~600k addressable new hires × $1,200/seat/yr achievable)
- **SOM 3-year**: $18M ARR (5 mid-tier IB / wealth-mgmt firms × ~30k analysts × $600/seat/yr)

Series A scale. Not a unicorn. Real.

## Competitive landscape

### Direct cloud horizontal competitors (DO NOT compete on their turf)

- **Glean** ($45-60/seat/mo + $15 AI, $60-240K contracts): enterprise search across 100+ connectors. **Misses**: corpus search, not role-specific scaffolding; cloud-required.
- **Microsoft Copilot Enterprise** ($18/seat/mo, loaded $33-43): horizontal, not persona-specific. Already inside 50%+ of enterprises via M365.
- **GS-AI Platform** (46,500 users), **JPM LLM Suite** (250K+ users, 60% adoption), **Citi Stylus** (140K), **MS AI@Morgan** (16K advisors): horizontal Q&A behind compliance gateways. Median user designed; below floor for MD, above ceiling for Day 1 analyst.

### Closest direct competitor

- **Cluely** ($5.3M raised, "cheat on everything" overlay watching screen + audio): closest UX to Shadow. **Positioned as consumer subversion**, got caught inflating ARR claims March 2026, cannot sell into compliance-sensitive enterprises with that brand. **Shadow = "Cluely for enterprise with local-only mode"** is a defensible reframe.

### LMS incumbents (no overlap)

- **Litmos / Docebo / 360Learning / WorkRamp**: sequential video lectures + quizzes. Not real-time, not in workflow.

### AR enterprise (wrong category)

- **TeamViewer Frontline, Vuforia Chalk, RealWear**: field service / manufacturing only.

## Local-mode LLM landscape — the "no upload" promise is REAL as of mid-2026

| Model | Performance | Hardware fit | Verdict |
|---|---|---|---|
| Apple Foundation Model 3 Core (3B dense, NPU) | Phi-4-class quality | Free on Apple Silicon | Good for definitions + extraction |
| Apple Foundation Model 3 Core Advanced (20B sparse, 1-4B active) | Good for complex Q&A | Free on Apple Silicon | **Best Apple-stack option** |
| **Phi-4-mini (3.8B)** | MMLU 68, 30+ tok/s | <16GB RAM | **Sweet spot for definitions** |
| **Gemma 3 9B** | MMLU-Pro 82.5, 30+ tok/s | <16GB RAM | **Sweet spot for reasoning** |
| Llama 3.3 70B (4-bit) | Best quality | M3 Max 64GB at 7.5 tok/s | Too slow for intern UX (40s for 300 tokens) |
| Mistral Small 3 7B | MT-Bench 8.0 | <12GB RAM | Strong baseline |

**Architecture**: Phi-4-mini or Gemma 3 9B local for 80% of queries, tiered escalation to AFM 3 Core Advanced or on-prem 70B cluster for hard reasoning.

**Compliance tailwind**: EU AI Act high-risk obligations start **August 2026**. Local-only mode has a real regulatory deadline driver.

## Pricing benchmarks

| Tool | Price/seat/mo | Notes |
|---|---|---|
| LinkedIn Learning | $40-60 | Above |
| Glean | $45-60 + $15 AI | Comparable target |
| Microsoft Copilot Enterprise | $18 base, loaded $33-43 | Strongest cloud competitor |
| Notion AI | $10 | Below — different category |
| Khanmigo Enterprise | $15/student/yr | K-12, different buyer |

**Shadow pricing thesis**: $40-50/seat/mo first 90 days, $15/mo retention. Or flat **$1,500/analyst/year** — fits inside $1,097-$1,331 FinServ L&D per-employee budget.

## Honest founder verdict

### Real product? Yes — but rename and reshape

"Shadow as AR glasses" gets shrugged off. "Shadow as the local-only intern copilot for the first 90 days in finance" gets a meeting.

### Strongest VC pitch (1 paragraph)

> Shadow is the on-device mentor for the first 90 days of an investment-banking or wealth-management analyst class. We read the analyst's screen locally (never uploaded), recognize what document or terminal they're looking at, and surface the same scaffolding their MD would give if she had time: "this is what that column means, here's why your VP cares about this number, here's what to ask next." We use a 5-voice council architecture (council-diff, council-runner) so every answer is debated by a junior analyst persona, a senior persona, and a compliance persona before it surfaces. We never upload PII to the cloud. Banks that already deployed GS-AI Platform or JPMorgan LLM Suite still need this because those tools are horizontal Q&A, not role-specific scaffolding for the first 90 days. We charge $1,500/analyst/year — below the per-employee L&D budget — and our beachhead is mid-tier wealth-management firms where formal Goldman-style 6-week analyst training is unaffordable.

### Killer 90-second demo

1. Open Excel with an LBO model. Shadow's desktop overlay highlights "Senior Leverage Ratio" and whispers: *"This is debt/EBITDA before subordinated tranches. Your VP usually cares about the 3-year trajectory, not the snapshot. Ask: 'how does this compare to the precedent set we ran last week?'"*
2. Switch to Bloomberg terminal: Shadow recognizes the screen and adds *"This is a CDS spread chart, not a bond yield. The wider it gets, the more the market is pricing default risk."*
3. **Disconnect WiFi** — same demo keeps working because it's all running on the laptop's NPU.
4. Walk-away line: **"Every analyst, every screen, every first 90 days — without your data ever leaving the building."**

### Biggest risk that kills the company

**JPMorgan, Goldman, and Citi will simply extend their existing in-house LLM Suites to do role-specific scaffolding themselves in 2026-2027.** JPM LLM Suite hit 250K employees in months; GS-AI is at 46,500.

**Escape hatch**: land at **mid-tier firms below the top 10** that don't have the engineering bench:
- Regional banks
- Mid-tier wealth-mgmt: Raymond James, Edward Jones, Stifel
- Boutique IBs: Houlihan Lokey, Lazard MM
- Tier 3 consulting: Alvarez & Marsal, FTI

### Smallest first user persona to nail

**First-year analyst at a $5B-$50B AUM regional wealth-mgmt or boutique IB firm, in their first 90 days, on a firm-issued MacBook Pro, working with Excel + a CRM + a research portal.**

Not "all of finance." Not "Goldman analysts" (they'll build it). **Mid-tier, MacBook-using, L&D-budget-having, compliance-paranoid.**

~30 firms in the US, each 50-300 analysts/yr. **Close 5 at $1,500/analyst = $3-5M ARR first year.**

### If I were the founder I would...

1. **Strip AR glasses branding from every deck this week**
2. Rename to something that says "shadow / mentor / scaffold" without implying hardware
3. **Ship a desktop-only macOS prototype in 4 weeks** using:
   - existing Perception Layer (YOLO-World + SAM2) to identify screen regions
   - council-runner Promise.all fan-out of **3 voices** (junior analyst, senior analyst, compliance)
   - local **Phi-4-mini or Gemma 3 9B**
4. Demo on LBO model + Bloomberg screenshot + CDS chart
5. **Cold-email 30 Heads of Analyst Development at mid-tier wealth-mgmt firms in July** targeting their 2027 summer-analyst class onboarding budget
   - Procurement cycle is now
   - Budgets close in September
   - **EU AI Act high-risk obligations start August 2026** gives the compliance-paranoid local-mode story a real deadline
6. Use the **Katz / Dr. NGO compliance research** as the credibility wedge, not the AR vision

## Sources

[BLS 2025](https://www.bls.gov/opub/ted/2025/employment-status-of-recent-associate-degree-recipients-and-college-graduates.htm) · [SHRM cost-of-hiring 2026](https://vamasters.com/cost-of-hiring-statistics-2026/) · [Devlin Peck onboarding stats 2025](https://www.devlinpeck.com/content/employee-onboarding-statistics) · [Gallup onboarding research](https://www.gallup.com/workplace/235121/why-onboarding-experience-key-retention.aspx) · [ATD L&D budget](https://www.td.org/content/atd-blog/7-reasons-not-to-cut-your-l-and-d-budget) · [LinkedIn 2025 Workplace Learning Report](https://learning.linkedin.com/resources/workplace-learning-report) · [LMSPedia 2026 budgets](https://lmspedia.org/corporate-training-budgets-2026-benchmarks/) · [Accountancy Age Big 4 hires](https://accountancyage.com/2025/06/23/the-big-fours-new-favourite-grad-is-ai/) · [GS-AI Platform Klover deep dive](https://www.klover.ai/goldman-sachs-ai-strategy-analysis-of-ai-dominance-in-financial-technology/) · [JPM LLM Suite VentureBeat](https://venturebeat.com/orchestration/jp-morgans-ai-adoption-hit-50-of-employees-the-secret-a-connectivity-first) · [Citi Stylus Mar 2025](https://www.citigroup.com/global/news/press-release/2025/citi-unveils-citi-stylus-workspaces-agentic-ai-turbocharging-productivity) · [Morgan Stanley AI](https://www.morganstanley.com/about-us/technology/artificial-intelligence-firmwide-team) · [Apple AFM 3](https://machinelearning.apple.com/research/introducing-third-generation-of-apple-foundation-models) · [Apple Foundation Models framework](https://developer.apple.com/documentation/FoundationModels) · [Llama 3 on M3 Max benchmark](https://x.com/private_llm/status/1788596431550357958) · [Mac Apple Silicon AI workstation 2026](https://www.heyuan110.com/posts/ai/2026-04-14-mac-apple-silicon-ai-workstation/) · [Best Local LLM Models 2026 SitePoint](https://www.sitepoint.com/best-local-llm-models-2026/) · [TrueFoundry regulated industries 2026 playbook](https://www.truefoundry.com/blog/llm-deployment-in-regulated-industries-hipaa-soc2-and-gdpr-playbook-for-2026) · [Meta Ray-Ban Display launch](https://about.fb.com/news/2025/09/meta-ray-ban-display-ai-glasses-emg-wristband/) · [Even Realities G2 specs](https://support.evenrealities.com/hc/en-us/articles/13499229138959-Specs) · [Glean pricing Vendr](https://www.vendr.com/marketplace/glean) · [Microsoft Copilot pricing eesel](https://www.eesel.ai/blog/copilot-pricing) · [Cluely Wikipedia](https://en.wikipedia.org/wiki/Cluely)
