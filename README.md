# Shadow

> The on-device AI council and audit chain that follows the user across desktop, smart glasses, and spatial AR. One engine. Four device clients. Five persona packs.

[![tests](https://img.shields.io/badge/tests-18%2F18%20passing-brightgreen)](./test) [![live demo](https://img.shields.io/badge/live%20demo-vercel-black)](https://shadow-mentor-q0lg7uwz4-alex-jbs-projects.vercel.app) [![backend](https://img.shields.io/badge/backend-Anthropic%20Sonnet%204.6-purple)](./api/deliberate.js) [![license](https://img.shields.io/badge/license-MIT-yellow)](./LICENSE)

## Live demo

**Public URL**: https://shadow-mentor-q0lg7uwz4-alex-jbs-projects.vercel.app *(Vercel Deployment Protection toggle pending — see `CHANGELOG.md`)*

Click any of:

- **4 device clients**: 🖥 Desktop · 👓 Even G2 · 🕶 Brilliant Frame · ✨ XReal Air 2 Ultra (JARVIS spatial AR mode)
- **5 persona packs**: 🛡 Compliance · 🧮 Quant / Data Scientist · 💻 Engineer · 📈 Trader · 💼 Wealth Advisor
- **4 scenarios**: 📊 LBO Model · 📈 Bloomberg DES · 📉 CDS Spread · 📄 Internal Policy
- **3 backend modes**: Cloud (mock) · Local (mock) · 🟢 Live
- **2 LLM providers (Live mode)**: Claude Sonnet 4.6 · GLM-5.2 (Zhipu, Mainland-China bank pitches)
- **📚 Cross-session memory recall**: click "Recall past 5" in the memory card to fetch past decisions by persona — 30 seed entries seeded with Brier-calibrated outcomes, Elastic agent-memory backend swap-ready

Toggle Live mode → click any combo → real 3-voice deliberation in 1-3 seconds.

**Status**: project initialized 2026-06-17. As of 2026-06-18:
- 20/20 persona × scenario cells populated with grounded content
- Real Anthropic Sonnet 4.6 backend deployed to Vercel
- GLM-5.2 (Zhipu) provider integration (toggle in Live mode)
- Cross-session memory backend (`api/recall`) with 30 seed entries
- Shadow Agentic Capability Benchmark v0.1 runner (HF "Is it agentic enough?"-inspired)
- 18/18 tests green (data-model + API contract)
- Native macOS app to be built Q3 2026

## Shadow Agentic Score — first baseline (2026-06-18)

**Aggregate Shadow Agentic Score: 39/100** *(2026-06-18, 8 tasks, anthropic provider)*

| Task | Score | Notes |
|---|---|---|
| compliance × lbo | 54 | strong term coverage |
| compliance × policy | 54-59 | best persona on cite-real-policy-numbers |
| quant × lbo | 32-37 | SR 11-7 framing weak |
| quant × cds | 27-32 | weakest on regime-shift terminology |
| engineer × lbo | 15-20 | engineer voice misses "async" / "circuit-breaker" terms most |
| trader × bloomberg | 27 | misses "single-name" cap framing |
| trader × cds | 33-40 | "carry" / "regime" partially present |
| advisor × lbo | 51-56 | clean Reg BI / IPS citations |

Most points are lost on the **latency_ok < 10s** check (10 / 100 weight) — current end-to-end is 11-15s per task because the 4 sequential Anthropic calls (3 voices + 1 follow-up) aren't fully parallelized at the orchestration layer. v0.2 will hit this with prompt caching + parallel voice + followup.

Re-run any time:

```bash
export ANTHROPIC_API_KEY=$(cat ~/.config/anthropic_key)
node benchmark/runner.js
```

Outputs `benchmark/report-YYYY-MM-DD.json`. Cost: ~$0.05 per run. **Calls Anthropic SDK directly — does NOT require Vercel Deployment Protection toggle**.

## What is this

Read the analyst's screen locally (never uploaded), recognize what document or terminal they're looking at, surface the same scaffolding their MD would give if she had time:

- "this is what that column means"
- "here's why your VP cares about this number"
- "here's what to ask next"

Three voices answer every question: **Junior analyst** (jargon translator), **Senior / VP** (what your boss actually cares about), **Compliance** (what NOT to share).

## Why now

- **EU AI Act high-risk obligations start August 2026** — regulatory deadline driver for compliance-paranoid local-mode
- **Local LLMs cross usable threshold mid-2026** — Gemma 3 9B / Phi-4-mini / Apple Foundation Model 3 Core Advanced
- **Big 4 cut grad hires 6-29% YoY** — surviving analysts need leverage faster
- **$1,097-$1,331 per-employee L&D budget in financial services** — Shadow at $1,500/analyst/year fits the line item

## Two modes

- **Cloud mode** ($50/seat/mo): screen → Anthropic / OpenAI → response. For non-confidential training data, public market signals, educational explanations.
- **Local mode** ($1,500/analyst/year): screen → on-device Gemma 3 9B / Phi-4-mini / AFM 3 Core Advanced → response. **No data leaves the laptop.** Use for client PII, M&A docs, internal models, anything covered by Reg B / Reg BI / EU AI Act high-risk obligations.

## See it work

```bash
open index.html
```

Or via simple HTTP:

```bash
python3 -m http.server 8080
open http://localhost:8080
```

Click through the 4 scenarios (LBO Model · Bloomberg · CDS Chart · Internal Policy). Toggle Cloud vs Local mode. **Click the WiFi button** — local mode keeps working, cloud mode breaks. That is the moat.

## What is here (scaffold, 2026-06-17)

```
shadow-mentor/
├── README.md
├── index.html               ← runnable browser demo
├── src/
│   ├── style.css            ← Even G2-style green HUD + dark analyst desktop
│   ├── mock-data.js         ← 4 scenarios (LBO / Bloomberg / CDS / Policy)
│   └── app.js               ← scenario picker + mode toggle + WiFi-off proof
└── docs/
    ├── shadow-onepager.md   ← VC-ready 1-page pitch
    └── 2026-06-17-market-research-memo.md  ← 2500-word external research
```

## What this re-uses from Alex's existing stack (60%)

- `council-runner` (Promise.all fan-out, weighted aggregation, HTTP server) — slimmed from 5 voices to 3
- `council-voices` (10 system prompts → 3 new intern-focused prompts)
- `perception` (YOLO-World + SAM2 + Depth Anything V2) — adapted for screen region identification, not real-world objects
- Hash chain audit (Q&A audit trail for L&D + compliance)

## What we build new (40%)

- macOS screen-capture pipeline (Accessibility API + ScreenCaptureKit)
- Local LLM router (Phi-4-mini / Gemma 3 9B / AFM 3 Core Advanced)
- Native macOS overlay (Electron or Swift)
- Intern context model (firm-specific onboarding curriculum loader)
- Sales materials (security audit pack, SOC 2, EU AI Act self-attestation)

## Beachhead — who is the first user

**First-year analyst at a $5B-$50B AUM regional wealth-mgmt or boutique IB firm, in their first 90 days, on a firm-issued MacBook Pro, working with Excel + CRM + research portal.**

Not "all of finance." Not Goldman / JPM / Citi (they will build it internally — already 60%+ AI adoption).

Mid-tier target firms in order: Raymond James · Edward Jones · Stifel · LPL Financial · Houlihan Lokey · Lazard MM · William Blair · Jefferies · Alvarez & Marsal · FTI · regional banks $5B-$50B AUM.

**~30 firms × 50-300 analysts/yr × $1,500/seat/yr = $3-5M ARR closing 5 of them**.

## Biggest risk

JPMorgan / Goldman / Citi extend their internal LLM Suites to do role-specific scaffolding themselves in 2026-2027. They already deployed 60%+ AI adoption.

**Escape hatch**: never sell into Top 10. Land at mid-tier where no engineering bench exists.

## Founder credibility wedge

- Embodied Compliance Council research with Dr. Henry Ngo (Yeshiva, banking compliance vertical) — EU AI Act + ECOA / Reg B framing locked
- Phase 4 EU AI Act evaluation design doc gives us defensible regulatory positioning
- `council-runner` architecture already shipped, tested 23/23, Vercel-deployable
- Bilingual EN/中文 ship discipline opens China-side mid-tier banks (CITIC, Haitong, HuaTai analyst classes) as secondary market

## License

TBD (likely Apache 2.0 with explicit "training data not licensed" rider, given regulated-finance context).
