---
name: shadow-mentor
description: 5-voice AI compliance council for regulated loan origination. 6 MCP tools (loan_council / risk_tools / recall / calibration / scenarios / traceability). FICO < 700 is a hardcoded JS conditional with pinned tests. Strict-JSON enum verdicts. AA01–AA05 adverse-action codes per CFPB Bulletin 2024-09. MCPTox / OX Security 2026 named-threat coverage mechanically tested.
version: 1.2.0
license: MIT
authors:
  - Alex Xiaoyu Ji
  - Loredana C. Levitchi
runtime: node
install:
  - npm install
  - node bin/install.mjs --host <claude-desktop|cursor|zed|opencode|openclaw>
tools:
  - shadow_loan_council
  - shadow_risk_tools
  - shadow_recall
  - shadow_calibration
  - shadow_scenarios
  - shadow_traceability
---

# shadow-mentor

5-voice AI compliance council for regulated lending. Drop into Claude Desktop / Cursor / Zed / OpenCode / OpenClaw via MCP. Mid-tier US bank pitch: **$1,800 / compliance-officer seat / year**. Open source MIT.

## What it does

Six MCP tools that turn an LLM chat into a procurement-defensible loan-origination compliance surface:

- `shadow_loan_council` — Deterministic 5-voice verdict (block / escalate / approve) + per-voice rationale + risk packet + thresholds applied. **FICO < 700 is a hardcoded `if` with a pinned test.**
- `shadow_risk_tools` — Institutional risk primitives: VaR (historical / parametric / MC), Expected Shortfall, concentration (HHI / Gini), sector exposure, correlation (Pearson / Spearman / EWMA), factor exposures, beta decomposition
- `shadow_recall` — Cross-session memory recall keyed by persona + scenario
- `shadow_calibration` — Per-persona Brier calibration stats (for SR 26-2 model risk monitoring)
- `shadow_scenarios` — Surface enumeration (5 personas × 4 scenarios × 4 device clients × 2 providers)
- `shadow_traceability` — Source attribution for any threshold (BRD vs Addendum vs Risk Appetite Note) per CFPB / ECOA / SR 26-2

All tools run in-process. No network call from inside the tool body. AA01–AA05 adverse-action codes match CFPB Bulletin 2024-09.

## Why a bank's procurement team can grep it in 10 minutes

Three source files + four test files:

1. `lib/audit-guardrail.js` — 12-pattern regex output gate (Schema-Layer Safety)
2. `lib/run-loan-council.js` — `if (loan.fico < CREDIT_THRESHOLDS.FICO_FLOOR) return { verdict: "block", ... }` (Determinism Floor)
3. `installer/tools.json` — frozen install-target × scope catalog (EMA-ready)

Test surface:
- `test/mcptox-canary.test.js` — 28 contract tests covering MCPTox §3 attack categories + MosaicLeaks coverage
- `test/oauth-scaffold.test.js` + `test/oauth-loan-council-wiring.test.js` — Enterprise Managed Auth scope catalog + live wiring
- `test/glm-call.test.js` — Multi-provider contract (Anthropic + GLM-5.2)
- `test/tools-catalog.test.js` — Catalog drift gate

**308/308 tests passing. Shadow Agentic Score 87 ± 3 (n=6).**

## Quick install

```bash
git clone https://github.com/alex-jb/shadow-mentor
cd shadow-mentor
npm install
node bin/install.mjs                          # see which MCP hosts are detected
node bin/install.mjs --host cursor --dry-run  # preview the merged config
node bin/install.mjs --host cursor            # write it
```

## Defends against named 2026 MCP threats

- **OX Security MCP STDIO supply-chain advisory** (May 2026) — Shadow's tool bodies call only frozen `lib/` modules; no untrusted shell input reaches a tool body
- **MCPTox benchmark** (arXiv 2508.14925) — Shadow returns strict-JSON enum verdicts, not narrative; poisoned descriptions cannot widen the response surface beyond schema
- **MosaicLeaks multi-turn information leakage** — canary-token contract tests pin the invariant that an attacker cannot exfiltrate a canary across the tool boundary
- **MCP Enterprise OAuth (EMA)** — opt-in `SHADOW_REQUIRE_BEARER=1` enforces `shadow:council` scope on `/api/loan-council`; works with OAuth2 / Azure AD claim shapes

## Links

- Repo: https://github.com/alex-jb/shadow-mentor
- Release: https://github.com/alex-jb/shadow-mentor/releases/tag/v1.2.0
- Comparison vs Anthropic FS Agents: [`docs/positioning-vs-anthropic-fs.md`](./docs/positioning-vs-anthropic-fs.md)
- Principles: [`docs/principles/schema-layer-safety.md`](./docs/principles/schema-layer-safety.md) · [`docs/principles/determinism-floor.md`](./docs/principles/determinism-floor.md)
- License: MIT
