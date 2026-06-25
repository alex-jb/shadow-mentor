# Shadow — One-pager

## What

**The on-device mentor for the first 90 days of an investment-banking or wealth-management analyst class.** Reads the analyst's screen locally (never uploaded), recognizes what document or terminal they're looking at, and surfaces the same scaffolding their MD would give if she had time: "this is what that column means, here's why your VP cares about this number, here's what to ask next."

## Why now

- **EU AI Act high-risk obligations** start 2027-12-02 (deferred from 2026-08-02 per EU Digital Omnibus 2026-05-07) → 18-month runway, build-now-compliant-by-2027 framing
- **Local LLMs cross the usable-quality threshold mid-2026** (Phi-4-mini, Gemma 3 9B, Apple Foundation Model 3 Core Advanced)
- **Big 4 cut grad hiring 6-29% YoY** because AI ate the entry-level workload → surviving analysts need more leverage faster
- **First-year analysts cost $75K-$95K loaded and take 12 months to full productivity** (Gallup)

## Two modes

| Cloud mode | Local mode (the moat) |
|---|---|
| Screen → Anthropic / OpenAI → response | Screen → on-device Gemma 3 / Phi-4-mini / AFM → response |
| For non-confidential / training data | For PII, M&A docs, client data, internal models |
| $50/seat/mo | $1,500/analyst/year |
| Startups, mid-tier consulting, university career labs | Mid-tier IB, wealth-mgmt, regional banks, Big 4 |

## Three voices, not five

Inherited from council-runner architecture but slimmed for intern use:
1. **Junior analyst** — translates jargon to what a Day 1 grad would understand
2. **Senior analyst / VP** — what your boss actually cares about and would ask
3. **Compliance** — what NOT to share, what flags fair-lending / Reg B / Reg BI concerns

Every answer is debated by these three before it surfaces. Council-runner does this in <2s.

## Beachhead

**Not Goldman / JPM / Citi** — they will build it themselves (already 60%+ employee AI adoption).

**Yes mid-tier US firms**:
- Wealth-mgmt: Raymond James, Edward Jones, Stifel, LPL Financial
- Boutique IB: Houlihan Lokey, Lazard MM, William Blair, Jefferies
- Tier 3 consulting: Alvarez & Marsal, FTI, AlixPartners
- Regional banks $5B-$50B AUM

~30 firms in the US, each 50-300 analysts hired per year.

## Pricing

- **Cloud SaaS**: $50/seat/mo, $400/seat/yr
- **Local enterprise**: $1,500/analyst/year flat (inside $1,097-$1,331 financial-services L&D budget per employee)

## 3-year SOM target

**$18M ARR**: 5 mid-tier firms × ~30K analysts × $600/seat/yr.

## What we reuse from existing stack (60% of the engineering)

- `council-runner` (5-voice → 3-voice fan-out, weighted aggregation, HTTP server)
- `council-voices` (10 system prompts → 3 new intern-focused prompts)
- `perception` (YOLO-World + SAM2 + Depth Anything — for screen region identification)
- `orallexa-risk` (finance domain knowledge primitives)
- Hash chain audit (intern Q&A audit trail for L&D + compliance)

## What we build new (40%)

- macOS screen-capture pipeline (Accessibility API + ScreenCaptureKit)
- Local LLM router (Phi-4-mini / Gemma 3 9B / AFM 3 Core Advanced)
- Desktop HUD overlay (electron or native Swift)
- Intern context model (firm-specific onboarding curriculum loader)
- Sales materials (security audit pack, SOC 2, EU AI Act self-attestation)

## Biggest risk

**JPM / Goldman / Citi build role-specific scaffolding into their internal LLM Suites in 2026-2027.**

**Escape hatch**: never sell into Top 10. Land at mid-tier where no engineering bench exists.

## Why Alex / our team

- ECC compliance research with Dr. NGO at Yeshiva → EU AI Act + ECOA / Reg B framing locked
- council-runner architecture already built, tested (23/23), shipped, Vercel-deployable
- Phase 4 EU AI Act evaluation design doc gives us defensible regulatory positioning
- Bilingual EN/中文 ship discipline opens China-side mid-tier banks (CITIC, Haitong, HuaTai analyst classes) as secondary market

## Founder asks

1. **4-week macOS prototype build** ($0 cost — solo)
2. **30-customer cold email round in July** targeting Heads of Analyst Development at mid-tier firms
3. **Beta partner**: 1 mid-tier firm willing to pilot in 2027 summer-analyst class

## Companion artifacts

- `/index.html` — browser-based demo of the HUD overlay + 3 scenarios (LBO model / Bloomberg / CDS chart) + local-mode WiFi-disconnect proof
- `docs/2026-06-17-market-research-memo.md` — 2500-word competitive + market + LLM + hardware research
