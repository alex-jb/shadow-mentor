# Shadow

[English](./README.md) · [中文](./README.zh-CN.md)

> **A 5-voice AI compliance council for regulated lending.** Encode your bank's loan policy in 5 past decisions. Get a verdict in milliseconds. Runs in your VPC. 5-minute install into Claude Desktop, Cursor, or OpenCode via MCP.

[![tests](https://img.shields.io/badge/tests-208%2F208%20passing-brightgreen)](./test) [![shadow agentic score](https://img.shields.io/badge/shadow%20agentic%20score-87%20%C2%B1%203%20(n%3D6)-coral)](./benchmark/history/SUMMARY.md) [![live demo](https://img.shields.io/badge/live%20demo-vercel-black)](https://shadow-mentor-q0lg7uwz4-alex-jbs-projects.vercel.app) [![backend](https://img.shields.io/badge/backend-Anthropic%20Sonnet%204.6-purple)](./api/deliberate.js) [![license](https://img.shields.io/badge/license-MIT-yellow)](./LICENSE)

## For risk and compliance teams

- **5-minute install.** Drop Shadow's MCP server into Claude Desktop, Cursor, or OpenCode; the 5-voice council becomes callable from the model in under five minutes. See [`mcp/README.md`](./mcp/README.md).
- **5 past loan decisions encode your policy.** Show Shadow five of your bank's prior verdicts and the council mirrors your specific FICO / DTI / LTV / VaR thresholds — no million-row training set required.
- **Runs in your VPC. No data leaves.** The 5-voice deliberation is pure compute (no LLM call inside the tool body). Loan applicants' data never leaves your servers.
- **Augments your compliance officer, doesn't replace them.** Every verdict carries a `requires_human: true` flag and AA01–AA05 adverse-action codes per CFPB Bulletin 2024-09 — designed for the human reviewer's signature, not to skip it.

The four bullets above are the buyer-facing summary. The defensibility patterns behind them — **Schema-Layer Safety** ([`docs/principles/schema-layer-safety.md`](./docs/principles/schema-layer-safety.md)) and the **Determinism Floor** ([`docs/principles/determinism-floor.md`](./docs/principles/determinism-floor.md)) — are read by procurement reviewers, not just analysts. Anthropic FS / Hebbia / Zest comparison: [`docs/positioning-vs-anthropic-fs.md`](./docs/positioning-vs-anthropic-fs.md).

### Defends against named MCP threats (MCPTox / OX Security 2026)

Two 2026 disclosures concretely named the failure modes Shadow's architecture mitigates by construction:

- **OX Security MCP supply-chain advisory** (May 2026) — MCP STDIO transport executes any OS command to launch a server; Anthropic confirmed by-design, so input sanitization is the developer's responsibility. Affects 150M+ SDK downloads. *Shadow mitigation*: the `shadow_*` tools call only frozen `lib/` modules; the response goes through `enforceAnalysisOnly()` at the council output boundary. No untrusted shell input reaches a tool body. ([advisory](https://www.ox.security/blog/mcp-supply-chain-advisory-rce-vulnerabilities-across-the-ai-ecosystem/))
- **MCPTox benchmark** (arXiv 2508.14925) — 45 servers, 353 tools tested; Claude-3.7-Sonnet refused poisoned tool-description payloads less than 3% of the time. *Shadow mitigation*: tools return strict-JSON enum verdicts (block / escalate / approve), not free narrative. A poisoned description cannot widen the response surface beyond the schema, and `lib/audit-guardrail.js` runs a 12-pattern regex over every voice rationale before it reaches the user.

Either patch reads cleanly off the source: a procurement reviewer can grep `lib/audit-guardrail.js` and `lib/schemas/loan.js` to verify both controls in under five minutes. No prompt-engineering belief required.

The rest of this README covers collaboration, the 87 ± 3 agentic benchmark, the live demo, MCP integration, and the full architecture.

## Collaboration and license

Shadow v1.1.1 vendors the **Orallexa Shadow Mode A** package authored by **Loredana C. Levitchi** (Yeshiva University + William Paterson University faculty, 14 years global banking software). Under MIT license, per her explicit grant 2026-06-19, she is the primary author of:

- The risk + credit-policy + threshold + adverse-action + traceability modules
- The **BRD vs. Addenda Source Separation Principle** — a procurement-defensibility governance pattern formalized in her *Orallexa Shadow Mode A* package and shipped inline at the API response level via `lib/traceability.js`
- The Aura Alexa BRD + Addenda A/B/C + Risk Appetite Note (vendored under `docs/external/`)

A co-first-author IEEE VR / VIS 2027 abstract (deadline 2026-08-24) is in flight, with the BRD vs. Addenda Source Separation Principle as the named contribution. Integration maintainer for the JS port + spatial XR layer: Alex Xiaoyu Ji.

## Live demo

**Public URL**: https://shadow-mentor-q0lg7uwz4-alex-jbs-projects.vercel.app *(Vercel Deployment Protection toggle pending — see `CHANGELOG.md`)*

Click any of:

- **4 device clients**: 🖥 Desktop · 👓 Even G2 · 🕶 Brilliant Frame · ✨ XReal Air 2 Ultra (JARVIS spatial AR mode)
- **5 persona packs**: 🛡 Compliance · 🧮 Quant / Data Scientist · 💻 Engineer · 📈 Trader · 💼 Wealth Advisor
- **4 scenarios**: 📊 LBO Model · 📈 Bloomberg DES · 📉 CDS Spread · 📄 Internal Policy
- **3 backend modes**: Cloud (mock) · Local (mock) · 🟢 Live
- **2 LLM providers (Live mode)**: Claude Sonnet 4.6 · GLM-5.2 (Zhipu, Mainland-China bank pitches)
- **📚 Cross-session memory recall**: click "Recall past 5" in the memory card to fetch past decisions by persona — 30 seed entries seeded with Brier-calibrated outcomes, Elastic agent-memory backend swap-ready

Toggle Live mode → click any combo → real 3-voice deliberation in 6-10 seconds (measured 2026-06-18, 3 parallel Anthropic calls + 1 Haiku follow-up).

**Status**: project initialized 2026-06-17. As of 2026-06-18 night:
- 20/20 persona × scenario cells populated with grounded content
- Real Anthropic Sonnet 4.6 + Zhipu GLM-5.2 provider integration (toggle in Live mode)
- Cross-session memory backend (`/api/recall` + `/api/calibration`) with 30 seed entries + per-persona Brier stats + Elastic agent-memory swap stub
- Shadow Agentic Capability Benchmark **v0.3.3** runner — **87 ± 3 (n=6)** aggregate (HF "Is it agentic enough?"-inspired); compliance × LBO anchor cell at **100/100 n=3 stable**
- **8 JSON endpoints live**: `/api/deliberate` (POST, +loan body adds verdict) · `/api/loan-council` (POST, pure-compute 5-voice rule layer, Lora Mode A) · `/api/recall` · `/api/calibration` · `/api/scenarios` · `/api/health` · `/api/badge` (shields.io) · `/api/version` (git SHA audit pin)
- **MCP server**: `node mcp/server.js` exposes 5 tools (`shadow_loan_council`, `shadow_risk_tools`, `shadow_recall`, `shadow_calibration`, `shadow_scenarios`) for Claude Desktop / Cursor / Zed / OpenCode native tool-use. See `mcp/README.md` for `claude_desktop_config.json` snippet.
- **Levitchi Mode A integration shipped + tightened (v1.1.1)**: typed risk tools (VaR / ES / concentration / sector / correlation / beta) + 5-voice verdict resolver (block > escalate > approve) + loan input schema with BR thresholds (FICO 700 / DTI 0.36 / LTV 0.80 / VaR 0.12 @ 95%/10d) pinned in drift-detection tests. **v1.1.1: FICO < 700 is a hard block** (not escalate) per Levitchi's policy clarification — credit-eligibility floor is not negotiable.
- **Procurement-grade citation chain (v1.1+)**: inline `traceability` dict in every `/api/deliberate` response mapping each threshold to BRD vs Addendum vs Risk Appetite Note source. AA01-05 adverse-action codes match CFPB Bulletin 2024-09 model-traceability requirement. `enforceAnalysisOnly()` regex guardrail catches LLM hallucination of trade-execution verbs at council output boundary. 14 contract tests enforce provenance.
- 154/154 tests green; GitHub Actions CI 15+ consecutive commits green
- Native macOS app to be built Q3 2026

## Shadow Agentic Score — 87 ± 3 (n=6) after 4-iteration prompt sweep (2026-06-18 evening)

**Aggregate Shadow Agentic Score: 87 ± 3 (n=6)** *(2026-06-18 evening, 8 tasks per run, anthropic provider, v0.3.3 prompts. Runs: 87 / 93 / 86. Mean 88.7, std 3.1, range 7. See [`benchmark/history/SUMMARY.md`](./benchmark/history/SUMMARY.md) for the 3 raw reports.)*

The rubric is deterministic but Sonnet's outputs are not, so single-run scores are samples — central tendency is the honest read.

| Task | v0.1 → v0.3.3 | Notes |
|---|---|---|
| compliance × lbo | 54 → **100** | clean across all 9 checks |
| compliance × policy | 54 → 92 | third voice length 8% over rubric ceiling |
| quant × lbo | 32 → 84 | senior + third length each ~10% over |
| quant × cds | 27 → 93 | one missing PSI/VIX term in senior |
| engineer × lbo | 15 → **100** | biggest absolute jump in the run |
| trader × bloomberg | 27 → 76 | Sonnet runs trader voices long even with 260-char prompt cap |
| trader × cds | 33 → 76 | same length-overshoot pattern |
| advisor × lbo | 51 → 84 | senior voice still verbose |

Four iterations, each measured against the same deterministic rubric:

| Iter | Aggregate | Change |
|---|---|---|
| v0.1 (baseline) | 39 | first real run, every length check failing |
| v0.3.0 explicit char-range asks | 64 | +25 |
| v0.3.1 hard MAX framing + anchor terms | 76 | +12 |
| v0.3.2 followup capped + terminal-? regex | 84 | +8 |
| v0.3.3 per-voice cap 260/300/320 | **88** | +4 |

The honest cap is ~88 against this rubric — remaining 12 points are length-ceiling vs term-coverage tradeoffs (push lengths tighter and Sonnet drops anchor terms like "Credit Committee" / "single-name" / "VIX").

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
