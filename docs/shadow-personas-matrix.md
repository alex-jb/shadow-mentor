# Shadow — Personas × Devices × Pricing Matrix

> A single bank buys one Shadow Banking enterprise license. Internally, the license is deployed across 5 distinct personas, each with its own device fit, voice pack, and seat-level price. Same engine, persona-specific voice packs.

## The 5 banking personas

| Persona | What they do | Device | Voice pack | Seat $/year |
|---|---|---|---|---|
| 🛡 **Compliance Officer / Loan Reviewer** | Loan origination review, OCC exam prep, ECOA adverse action notices, AML | Even G2 (customer-facing safe) + Desktop fallback | Junior analyst, Senior VP, Compliance officer trained on OCC / CFPB / ECOA | $1,800 |
| 🧮 **Quant / Data Scientist / Data Engineer** | SR 26-2 (formerly SR 11-7) model drift monitoring, fraud anomaly detection, AML graph analytics, counterparty network analysis | **XReal Air 2 Ultra (JARVIS mode)** + Desktop | Junior data scientist, Senior quant, Model risk reviewer | $2,400 |
| 💻 **Software Engineer / Platform Engineer** | Internal LLM platform, risk system codebase, integration work | Desktop primary, Brilliant Frame for internal docs | Junior dev, Senior eng, Security review | $1,500 |
| 📈 **Trader / Portfolio Manager** | Position sizing, correlation regime, tail risk, factor exposure decomposition | **XReal Air 2 Ultra (JARVIS mode)** + Desktop | 5-voice trader council (Buffett value / Soros reflexivity / Druckenmiller macro / Kelly geometric / Taleb tail) | $2,400 |
| 💼 **Wealth Advisor / Customer-Facing Banker** | HNW client meetings, portfolio review, Reg BI suitability | Even G2 (customer-facing safe) + Desktop | Junior advisor, Senior advisor, Reg BI / Fiduciary | $2,000 |

## Common engine — every persona shares

- `council-runner` Promise.all fan-out with weighted aggregation
- Local LLM router: Phi-4-mini · Gemma 3 9B · Apple Foundation Model 3 Core Advanced
- Hash-chain audit (SHA-256 WebCrypto)
- ScreenCaptureKit + Accessibility API for screen recognition
- Encrypted persona profile loader for firm-specific onboarding curriculum, policy, and historical Brier audit

## Common devices — each persona can use any client, but preferred fit varies

| Device | Best fit | Constraint |
|---|---|---|
| 🖥 **Desktop macOS app** | Universal fallback | No glasses required, zero hardware barrier |
| 👓 **Even G2** ($599, no camera) | Customer-facing roles (Compliance, Wealth Advisor) | Monocular green HUD, single contrarian voice only |
| 🕶 **Brilliant Frame** ($349, camera, open SDK) | Engineer reading internal docs, intern onboarding | Color mini HUD, 2 voices visible |
| ✨ **XReal Air 2 Ultra** ($699, 6DoF spatial AR) | Quant and Trader at own desk | JARVIS-style floating panels, 3-voice council with depth, only the user sees the panels through the AR glasses |

## Pricing model — single bank deployment

```
Shadow Banking · Enterprise License
─────────────────────────────────────
Base engine                            $120K/year (no seat cap)
─── Persona Packs (per seat per year) ──
🛡 Compliance                          $1,800/seat
🧮 Quant / Data Scientist              $2,400/seat
💻 Engineering                         $1,500/seat
📈 Trader                              $2,400/seat
💼 Wealth Advisor                      $2,000/seat
─────────────────────────────────────
```

## Typical mid-tier bank deployment ($982K/year)

A mid-tier US bank with ~1,000 employees subscribes:

- 200 Compliance officers × $1,800 = $360K
- 50 Quant / Data scientist × $2,400 = $120K
- 100 Internal engineering × $1,500 = $150K
- 30 Trader × $2,400 = $72K
- 80 Wealth advisor × $2,000 = $160K
- Base engine = $120K

**Total: ~$982K/year contract from a single bank**.

## 3-year SOM target

5 mid-tier banks at $982K average = **$4.9M ARR**. Series A scale. Defensible against Goldman / JPM / Citi internal-LLM-Suite competition because mid-tier banks lack the engineering bench to build this themselves.

## Beachhead — first bank to land

Sequence in order:
1. Raymond James (~9k employees, MacBook-deployed)
2. Stifel
3. LPL Financial
4. Houlihan Lokey (boutique IB)
5. Lazard Middle Market

Each has a clearly named Head of Analyst Development or Chief Risk Officer who is the buyer.

## Mapping to ECC academic deliverables

| Bank persona | ECC academic app | Lora IEEE paper coverage |
|---|---|---|
| 🛡 Compliance | `banking-quest` | Primary vertical |
| 📈 Trader | `trading-quest` | Secondary vertical |
| 🧮 Quant / Data Scientist | **`quant-quest` (new in v3.1)** | New 3rd vertical — opens the Kraus 2022 immersive analytics evaluation arm |
| 💻 Engineer | n/a | Not academic scope |
| 💼 Wealth Advisor | Shared with banking-quest | Secondary vertical |

The new `quant-quest` app is the ECC opening into the model risk / fraud anomaly literature, and the natural home for the JARVIS-mode 3D spatial visualizations (counterparty graph walk, fraud UMAP manifold, drift attribution).

## Why this matters — Notion / Slack precedent

Notion sells one product but has `notion.com/engineering` and `notion.com/legal` and `notion.com/design` landing pages with different feature highlights. Slack sells one workspace product but has different feature emphasis for `slack.com/engineering` vs `slack.com/sales`. Shadow Banking follows the same playbook: **one engine, multiple persona landings, multiple seat-level price tiers under one enterprise license**.

The buyer (bank L&D / IT / Risk procurement) signs one contract. Internal IT deploys persona packs to the right roles. This is land-and-expand by design.
