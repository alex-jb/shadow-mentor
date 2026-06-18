---
tags: [competitive, cluely, ux-overlay, regulated-finance, defensibility]
date: 2026-06-18 (NY 00:10)
status: Cluely competitive memo for Shadow positioning
---

# Cluely — The Closest UX Competitor

## What Cluely is

Cluely is a desktop overlay app for macOS / Windows (plus a 2026 iOS app + "Desktop Widget" mode) founded by Chungin "Roy" Lee, Neel Shanmugam, and Alex Chen, following Lee and Shanmugam's suspension from Columbia for the "Interview Coder" cheat tool.

**Technical architecture** (close to Shadow):
- OCR captures screen continuously
- System audio + speech-to-text captures meeting context
- Sends to cloud LLM (proprietary, likely Anthropic / OpenAI under the hood)
- Surfaces answers in a floating overlay window
- **Overlay is rendered via low-level GPU hooks** (DirectX on Windows, Metal on macOS) → invisible to Zoom / Google Meet / Microsoft Teams screen-share

**Pricing**:
- Free (limited)
- Pro $19.99/month ($11.99/month annual)
- Pro + Undetectability $149.99/month ($44.99/month annual)

**Funding**:
- Total: $20.3M (incl. $15M Series A led by Andreessen Horowitz, June 20 2025)
- Founded post-Columbia suspension as viral marketing
- Tagline: "cheat on everything"

## Why Cluely matters as comp

The architecture is **the closest analog to Shadow's desktop client**:
- Screen + audio capture
- Floating overlay
- AI suggestions surfaced in-context
- Cross-app (works on any screen)

If Cluely were positioned for enterprise, it would *be* Shadow's desktop client. They are not — and that gap is the wedge.

## Why Cluely cannot enter Shadow's market

Five structural blockers:

### 1. Brand poisoned for compliance use

The "cheat on everything" tagline + Columbia suspension origin story = the brand is **legally indefensible inside any compliance-sensitive enterprise**. A bank compliance officer cannot adopt "the cheating tool" without immediate HR / legal escalation. Cluely's marketing has been documented in TechCrunch + WSJ coverage as overtly subversive.

### 2. ARR inflation scandal (March 2026)

Roy Lee was publicly caught inflating ARR claims. He claimed $7M ARR which he later admitted was "bs" (his word). This is reputational damage that makes enterprise procurement (which requires SOC 2 + reference customers) very difficult.

### 3. Cloud-only architecture

Cluely is cloud LLM by design. There is no documented local-only mode. For Shadow's target buyer (mid-tier US bank under EU AI Act + GLBA + SR 11-7), cloud-by-default is a non-starter for client PII screens.

### 4. 2025 data breach (~83,000 users)

A documented data breach affecting 83,000+ users in 2025 is a *real privacy concern given the product captures everything on your screen*. For a screen-capture product specifically, a breach of this kind is brand-terminal in regulated markets.

### 5. No persona pack architecture

Cluely is a single product for a single user — "I want help with whatever I'm looking at." There is no role-specific scaffolding, no compliance/quant/trader/advisor differentiation, no Brier-audited voice persona. It is Glean's chat box with a hot key. For a mid-tier bank L&D budget allocator deciding between Glean ($45-60/seat) and Cluely ($20-50/seat) and Shadow ($1,500-2,400/seat), the persona-pack differentiation is the only credible justification for Shadow's higher price.

## What Cluely does well that we should learn from

Three lessons:

### 1. GPU-hook invisible-overlay is the right desktop client primitive

Their DirectX / Metal hook makes the overlay invisible to Zoom screen-share. Shadow's macOS desktop client should adopt the same technique — analyst can demo Shadow without showing it to the loan applicant they're talking to on Zoom.

### 2. Viral / aggressive marketing > polite enterprise

Cluely's brand is bad for enterprise but unmissable on social. Shadow Banking needs polite enterprise marketing AND a viral non-enterprise spike. Suggested: a free public **"Shadow for Students"** mode (the original Shadow idea from yesterday morning) that scratches the same itch as Cluely but positioned as legitimate study help, not cheating. Generates funnel + dev advocates without the brand damage.

### 3. The Series A market thinks AI overlay is fundable

a16z putting $15M into this in 2025 validates the *category*. Shadow's variant (enterprise + local + persona) is a defensible position in the same category, with $4.9M ARR target after 5 mid-tier bank wins. The market has been priced; the question is which positioning wins.

## Shadow's positioning vs Cluely in one sentence

> Cluely is "cheat on everything." Shadow is "the audit chain regulators demand on every decision in your first 90 days at the bank."

## Procurement scenario — bank L&D buyer comparison

| | Cluely Pro | Shadow Banking Compliance Pack |
|---|---|---|
| Price | $20/seat/mo ($240/year) | $1,800/seat/year |
| Local mode | ❌ Cloud only | ✅ On-device Phi-4-mini + AFM |
| Persona-specific voice | ❌ General | ✅ Junior loan analyst + Senior VP + Compliance officer |
| Hash-chain audit | ❌ | ✅ EU AI Act Art. 14 + OCC export formats |
| SOC 2 | ❌ (per public listings) | 🚧 in progress |
| Data breach history | ✅ 2025 incident, 83k users | None |
| Brand acceptable to bank legal? | ❌ "Cheat on everything" | ✅ "Embodied Compliance Council" |

The buyer is not really comparing on price; they are comparing on legally-defensible-for-our-use. Shadow wins that comparison every time. Price differential ($1,800 vs $240) is justified by the audit-chain + local-mode + persona-pack stack that Cluely cannot replicate without abandoning its founding brand.

## What would change our verdict

Cluely becomes a real threat if:
1. Roy Lee + co. pivot to a separate enterprise brand under a16z guidance (e.g., spin out a "Cluely Compliance" SKU). Watch for this.
2. They acquire a SOC 2 + EU AI Act-compliant compliance vendor (less likely, but a16z has money).
3. They lose their consumer audience and pivot quietly to enterprise.

We monitor through Crunchbase + a16z portfolio updates monthly.

## Sources

- [Cluely Wikipedia](https://en.wikipedia.org/wiki/Cluely)
- [Cluely Crunchbase](https://www.crunchbase.com/organization/cluely)
- [Cluely AI Honest Review tldv 2026](https://tldv.io/blog/cluely-review/)
- [Cluely Review Dupple 2026](https://dupple.com/tools/cluely)
- [How I Analyzed Cluely's $120M Pivot — David Olaseni / Medium](https://medium.com/@olasenidavid/how-i-analyzed-cluelys-120m-pivot-my-first-ai-product-analysis-project-c4a451f19a4a)
- [Cluely Alternatives Saner.AI](https://www.saner.ai/blogs/best-cluely-alternatives)
