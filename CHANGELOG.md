# Shadow — Changelog

All notable changes to the Shadow product. Dates are NY local.

This log doubles as evidence of execution velocity for bank-procurement due diligence.

The format loosely follows [Keep a Changelog](https://keepachangelog.com/).

---

## [Unreleased]

Next planned:
- macOS native app POC (ScreenCaptureKit + on-device Phi-4-mini + AppKit overlay)
- 5-minute Loom recording per the rehearsal script
- 30-target cold email round (July) — requires Loom URL substitution
- SOC 2 Type 1 readiness checklist
- shadow.io domain procurement (vs alternatives)
- Vercel Deployment Protection toggle to make demo public
- GLM-5.2 router integration + benchmark
- Elastic agent-memory backend prototype
- HuggingFace agentic-capability benchmark score publication

---

## v1.2 — Day 2 afternoon (2026-06-18) — GLM-5.2 provider + Elastic memory mock + Agentic benchmark

### Added — real code presence for all 3 daily-brief signals

**A) GLM-5.2 provider integration**
- `lib/glm-call.js` — OpenAI-compatible fetch to `open.bigmodel.cn/api/paas/v4`, model `glm-5-plus`, env var `GLM_API_KEY`
- `api/deliberate.js` accepts `{provider: "anthropic"|"glm"}` body param; defaults to anthropic; surfaces clear 500 error when GLM_API_KEY missing on the Vercel project
- Browser UI: provider picker (Claude / GLM-5.2) next to the 🟢 Live button, yellow active highlight
- Mainland-China bank pitch demos now work without changing the engine — only the provider button

**B) Cross-session memory backend (mock)**
- `lib/memory.js` — `InMemoryMemory` class + 30 seed entries (5 personas × 4 scenarios)
- Entry schema: `{entry_id, timestamp_iso, analyst_id, persona, scenario, question, voices, outcome, brier_score, hash_chain_link}`. 30 seeds grounded in real persona+scenario language (Senior Leverage 4.4x B-rated WidgetCo, cov-lite Credit Committee, CDX widening, AAPL coverage initiation, etc.) for believable demos
- `api/recall.js` — GET `/api/recall?persona=X&scenario=Y&max_results=N` returns past entries + `calibration_stats` (n, mean Brier, outcome distribution)
- Browser UI: 📚 Cross-session memory card under audit panel with "Recall past 5" button → renders past entries with outcome badge (approved/blocked/escalated) + Brier score
- Production swap: replace `InMemoryMemory` with `ElasticMemory` hitting `@elastic/elasticsearch` with the same Entry schema

**C) Shadow Agentic Capability Benchmark v0.1**
- `benchmark/runner.js` — 8 representative agentic decision tasks across 5 persona packs
- HF *Is it agentic enough?*-inspired structural eval: voice length ranges, follow-up-is-question check, expected-term coverage per voice, latency under 10s
- Per-task max 100 points; weights: 8/8/8 voice length + 10 question check + 6 length range + 15/20/15 term coverage + 10 latency
- Aggregate Shadow Agentic Score = mean of per-task scores
- Output: `benchmark/report-YYYY-MM-DD.json` with full result trace
- Hits production Vercel endpoint; requires Deployment Protection disabled
- Cost: ~$0.05 per full benchmark run (Anthropic Sonnet 4.6)

### Changed

- `README.md` adds Run the benchmark section + GLM-5.2 provider + cross-session memory recall + agentic benchmark in feature list

---

## v1.1 — Day 2 morning (2026-06-18) — Real backend + Vercel deploy + 20/20 content + 18/18 tests

### Added

- **GitHub repository created**: https://github.com/alex-jb/shadow-mentor (private, MIT-licensed). Day 1 + Day 2 commits pushed.
- **20/20 persona × scenario coverage**: filled 15 previously-default cells with persona-specific 3-voice content. Bloomberg / CDS / Policy × {Compliance, Quant, Engineer, Trader, Advisor} all populated with real-world regulatory grounding (Reg AC / Reg BI / SR 11-7 / ECOA / FINRA 2241 / Bloomberg license terms / Stifel Policy 4.3). Verified by `data-model.test.js`.
- **`api/deliberate.js` — real Anthropic Claude Sonnet 4.6 backend**: Vercel serverless function. POST {persona, scenario, question} → {junior, senior, third, followup, latency_ms, model}. 3-voice Promise.all fan-out + 1 followup-generation call. 5 persona system prompts + 4 scenario contexts. CORS-enabled. 1-3 second end-to-end.
- **Vercel production deployment**: https://shadow-mentor-q0lg7uwz4-alex-jbs-projects.vercel.app — ANTHROPIC_API_KEY env var set on the project. Deployment Protection toggle remains pending (auth-required URL until disabled).
- **`🟢 Live` mode toggle in browser demo**: third option alongside Cloud/Local. Click → fetches `/api/deliberate` → updates HUD with real LLM response + latency tag + model name. Falls back to Cloud mode on error.
- **Test suite, 18/18 green**: `node --test test/*.test.js`. `test/data-model.test.js` (10 tests) covers structure invariants + regulatory-language coverage for Compliance and Quant personas. `test/api-deliberate.test.js` (8 tests) covers HTTP method validation, OPTIONS preflight, persona/scenario routing, missing API key, CORS headers, 5-persona × 4-scenario routing pass.
- **`shadow-product-proposal-v1.1.pdf`** (447KB) — incremental update to v1.0 with 3 daily-brief signals (GLM-5.2 added as 5th local-LLM router option, Elastic agent-memory adopted as cross-session memory backend, HuggingFace `Is it agentic enough?` benchmark adopted as canonical agentic-capability score) plus the live Vercel deployment URL. New sections 8.5 (Cross-Session Memory) and 8.6 (Quantified Agentic Capability).
- **README badges + Live demo prominent**: 4 badges (tests 18/18, live Vercel demo URL, Anthropic Sonnet 4.6 backend, MIT license). Live demo URL surfaced at the top with 4 device × 5 persona × 4 scenario × 3 backend-mode picker breakdown.

### Changed

- `package.json` adds `@anthropic-ai/sdk` dependency, `npm install` + `node --test` scripts, `npm run deploy` for Vercel production push.
- `vercel.json` simplified to outputDirectory=`.` after Vercel runtime auto-detection.
- `src/app.js` adds `fetchLiveDeliberation()`, persona-aware question payload, error fallback to Cloud mock.
- `src/style.css` adds `.live-btn.active` purple glow + `.live-btn.thinking` loading state.

### Decisions

- **GitHub visibility = private** by default. Flip via `gh repo edit alex-jb/shadow-mentor --visibility public --accept-visibility-change-consequences` when bank-procurement diligence is far enough along that public scrutiny is welcome. Banking-compliance brand requires that we choose the moment.
- **Live mode = opt-in, not default**. Mock by default keeps demo free + fast. Live mode is the buyer demo trigger.

---

## v1.0 — Canonical Product Proposal (2026-06-17 evening / 2026-06-18 early morning)

Project initialized as a brand-new repository scaffold, locally git-tracked, not yet pushed to a remote.

### Added — Day 1 deliverables

**Product framing**:
- `docs/shadow-product-proposal.pdf` (425KB, 15 pages) — canonical product proposal v1.0. Architecture locked: 1 engine + 4 device clients (Desktop / Even G2 / Brilliant Frame / XReal Air 2 Ultra) + 5 persona packs (Compliance / Quant / Engineer / Trader / Wealth Advisor). $4.9M ARR 3-year SOM across 5 mid-tier banks.
- `docs/shadow-onepager.md` — VC-ready 1-pager.
- `docs/shadow-personas-matrix.md` — 5-persona × 4-device matrix with seat-level pricing, sample $982K ACV mid-tier bank deployment math.

**Demo**:
- `index.html` + `src/style.css` + `src/mock-data.js` + `src/app.js` — browser-runnable Shadow demo. 4-device picker (Desktop / G2 / Frame / XReal) × 5-persona picker × 4 scenarios (LBO / Bloomberg / CDS / Internal Policy). Cloud vs Local mode toggle. WiFi-off proof of local-mode resilience. XReal mode renders 3 floating spatial panels (Risk Surface / Bias Constellation / Counterparty Network) — the "JARVIS mode" that anchors the product narrative. Same backend brain, different HUD treatment per device per persona.
- LBO scenario fully populated for all 5 personas with persona-specific 3-voice content (junior / senior / third). Other 3 scenarios fall back to generic default voices.

**Research and competitive**:
- `docs/2026-06-17-market-research-memo.md` (2500 words) — external research agent memo. Market sizing (TAM $15B, SAM $720M, 3-year SOM $18M ARR), competitive landscape (Glean, Microsoft Copilot, GS-AI Platform, JPM LLM Suite, Cluely), local-LLM landscape (Apple Foundation Model 3 Core Advanced, Phi-4-mini, Gemma 3 9B, Mistral Small 3, Llama 3.3 70B), smart-glasses hardware reality (Meta Ray-Ban Display, Even G2, Apple Vision Pro), pricing benchmarks ($1,500-$2,400/seat/year inside $1,097-$1,331 financial-services L&D budget), founder verdict (rename from AR play to local-only desktop wedge, beachhead = mid-tier wealth-management firms below top-10).
- `docs/competitive-cluely-deep-dive.md` — Cluely as the closest UX competitor. 5 structural blockers prevent it from entering Shadow's market (brand poison, ARR inflation scandal, cloud-only, breach history, no persona pack). 3 lessons to steal (GPU-hook invisible overlay, viral consumer marketing for funnel, market priced by a16z confirms category). 1-sentence positioning: "Cluely is *cheat on everything*. Shadow is *the audit chain regulators demand on every decision in your first 90 days at the bank*."

**Sales prep (July outreach kit)**:
- `docs/sales-30-target-banks.md` — 30 mid-tier US bank target list ranked Tier A wealth-mgmt (7) + Tier B boutique IB (10) + Tier C consulting (5) + Tier D regional banks (8). Tier A includes Raymond James, Stifel, LPL, Edward Jones, Ameriprise, Cetera, Commonwealth. Tier B includes Houlihan Lokey, Lazard, William Blair, Jefferies, Piper Sandler, Robert W. Baird, Harris Williams, Moelis, PJT, Evercore. Canonical July cold email template v1.0 (3 subject variants, single-paragraph ~180 word body). Conversion math: 30 emails → 5 replies → 2 demos → 1 pilot → $75K first contract.
- `docs/loom-5min-rehearsal-script.md` — 5:15 hard-capped recording script for the cold-email Loom. Pre-flight + 6-segment shot list with 5-second JARVIS-mode silent pause at 3:30 + recording rules + after-recording flow + backup soundbite.

**Regulatory and compliance**:
- `docs/eu-ai-act-self-attestation-shadow.md` (template v1.0, effective 2026-08-02) — 13 attestations against EU AI Act Article 14(1)-14(5), plus 4 supplementary attestations against U.S. Fed SR 11-7. Each attestation has a "verifiable by" clause for independent customer audit. Required for second-round bank procurement (risk + legal review).

### Engineering reuse from ECC monorepo (60%)

- `council-runner` (Promise.all fan-out + weighted aggregation + HTTP server) — slimmed from 5 voices to 3 for the on-device latency budget; switches to 5-voice fan-out in XReal JARVIS mode where compute headroom exists.
- `council-voices` (10 system prompts → 5 new persona-pack-specific prompts).
- `embodied-perception` (YOLO-World + SAM2 + Depth Anything V2 protocols + Mock providers + SceneGrounder) — adapted from real-world object detection to screen-region identification.
- Hash chain audit (WebCrypto SHA-256) — Q&A audit trail for L&D + compliance documentation.

### Engineering new build (40%)

- macOS screen-capture pipeline (Accessibility API + ScreenCaptureKit) — to be built Q3 2026
- Local LLM router (Phi-4-mini / Gemma 3 9B / Apple Foundation Model 3 Core Advanced) — to be built Q3 2026
- Native macOS overlay (AppKit or Electron) — to be built Q3 2026
- Intern context model (firm-specific onboarding curriculum loader) — to be built Q4 2026
- SOC 2 Type 1 readiness, EU AI Act self-attestation evidence pipeline — to be built Q4 2026

---

## Decisions and research verdicts (non-code)

- **Shadow = canonical product** for all banking, trading, intern, advisor, quant, and engineer AI mentor work going forward. ECC remains the academic deliverable that feeds Shadow's IEEE VR 2027 paper, Loredana's IEEE banking paper, Dr. NGO's class final, and Yang's capstone.
- **Council debate is plumbing, not hero.** Every external communication (VC pitch, cold email, hackathon entry, paper abstract) frames multi-voice as the engineering implementation; the user-facing pitch leads with regulatory + persona + form-factor.
- **Quest 3S permanently dropped.** Apple paused Vision Pro overhaul 2025-10-01 to reallocate engineering toward smart glasses; immersive headsets are not the 2026-2028 daily-wear form factor for regulated finance.
- **Beachhead = mid-tier US banks** $5B-$50B AUM, MacBook-deployed, L&D-budget-having. NOT Goldman / JPM / Citi (they will build it in-house using existing internal LLM Suites).
- **Pricing locked**: base engine $120K/yr + persona packs $1,500-$2,400/seat/yr. Sample mid-tier bank ACV $982K. 3-year SOM $4.9M ARR.

---

## Cumulative artifact count (Day 1)

- 6 docs in `docs/` (canonical proposal, personas matrix, one-pager, market research, competitive Cluely deep dive, 30-bank target list, Loom script, EU AI Act self-attestation)
- 4 demo files (`index.html`, `src/style.css`, `src/mock-data.js`, `src/app.js`)
- 1 README
- Local git initialized with 8+ commits
- Remote not yet configured (decision pending on public vs private visibility)

---

## Companion repositories

- `github.com/alex-jb/embodied-compliance-council` — academic deliverable with ECC v3.1 proposal, IEEE VR 2027 paper skeleton, Phase 4 EU AI Act evaluation design, 41 tests green
- `github.com/alex-jb/council-diff` — Brier-audit engine used in council-runner backend
- `github.com/alex-jb/council-for-slack-2026` — production proof of council in Slack workspace (Slack Agent Builder hackathon entry, separate framing)
- `github.com/alex-jb/orallexa-ai-trading-agent` — daily trading research pipeline that powers trader persona pack
