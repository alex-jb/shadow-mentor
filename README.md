# Shadow

> The on-device mentor for the first 90 days of an investment-banking or wealth-management analyst class.

**Status**: brand-new repo, just-scaffolded 2026-06-17. Browser demo runnable today; native macOS app to be built in 4 weeks.

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
