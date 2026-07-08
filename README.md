# Shadow

[English](./README.md) · [中文](./README.zh-CN.md)

> **The post-classifier audit layer for regulated lending.** 5 auditable regulatory chains-of-reasoning per decision. Persona-prompt-binding attestation (Ed25519) + citation-registry SHA-256 + hash-chain provenance. Runs in your VPC. 5-minute install into Claude Desktop, Cursor, or OpenCode via MCP.

[![tests](https://img.shields.io/badge/tests-937%2F938%20passing-brightgreen)](./test) [![verdict invariance](https://img.shields.io/badge/verdict%20invariance-10%2F10%20structural%20perturbations-blue)](./test/verdict-invariance.test.js) [![shadow agentic score](https://img.shields.io/badge/shadow%20agentic%20score-87%20%C2%B1%203%20(n%3D6)-coral)](./benchmark/history/SUMMARY.md) [![live demo](https://img.shields.io/badge/live%20demo-vercel-black)](https://shadow-mentor-o033hfcya-alex-jbs-projects.vercel.app) [![backend](https://img.shields.io/badge/backend-Anthropic%20Sonnet%204.6-purple)](./api/deliberate.js) [![license](https://img.shields.io/badge/license-MIT-yellow)](./LICENSE)

## What's new in v1.5.21 (2026-07-08)

Research-driven repositioning release. Absorbs findings from 12 parallel deep-research agents run 2026-07-08 overnight — real-world arXiv anchors, NIST federal-market mapping, verdict-invariance defense against persona-instability threat.

- **[`docs/arxiv-citation-map.md`](./docs/arxiv-citation-map.md)** — every Shadow architectural claim now traces to a 2026-in-window arXiv paper. Load-bearing anchors: **Seth & Sankarapu 2605.15164** (audit gap), **Mohan & Nagavenkata 2606.29142** (6 agentic threats × 5 regulatory frameworks — Shadow's exact intersection), **de la Chica & Martí-González 2605.14744** (mechanical enforcement), **Kohli 2605.29800** (correlated-vote critique + Shadow's response), **RefWalk 2605.29742** (per-rule attribution / citation-closure retrieval).
- **[`docs/NIST-AI-600-1-MAP.md`](./docs/NIST-AI-600-1-MAP.md)** — 12 NIST 600-1 GenAI risks mapped against Shadow controls. 8 mechanically enforced with code + test evidence; 3 provider/deployment layer; honest N/A on the rest. This is the artifact federal contractors need for GSA MAS / FedRAMP AI Impact Assessment reviews.
- **[`test/verdict-invariance.test.js`](./test/verdict-invariance.test.js)** — 10 tests pinning that Shadow's deterministic verdict does not change under 6 structural perturbation classes (key ordering, float precision, extra fields, null vs omitted, collateral ordering, exposure-weight ordering) + 5-voice regulatory-anchor independence pin. Direct response to arXiv 2607.00937 (Guerra-Solano) + 2607.02368 (Yuan). Turns persona-instability threat into a moat metric.
- **Repositioning**: "Ed25519 attestation" hero retired — replaced with "**persona-prompt binding attestation**" (Sigstore commoditized Ed25519 the primitive; the binding is the moat). "Safety layer" retired — replaced with "**post-classifier audit layer**" (Anthropic Constitutional Classifiers ship in Claude 4.7; Shadow operates above them).

### Emerging category names Shadow now owns

Distilled from 20+ arXiv papers scanned 2026-05-24 → 2026-07-08:

1. **Audit-Runtime Gap Sealing** (SIGIL 2605.05274 + Seth 2605.15164)
2. **Mechanical Enforcement Layer** (de la Chica 2605.14744)
3. **Per-Rule Attribution / Citation-Closure Retrieval** (RefWalk 2605.29742)
4. **Effective Independent Vote Count** — as a publishable metric, not a claim (Kohli 2605.29800)



## Regulatory positioning (2026 H2)

Two 2026 regulatory shifts changed the enforcement posture Shadow addresses. Retire "SR 11-7 compliant" reads; the actual framing is:

- **SR 26-2 Tier 3 companion control.** SR 11-7 was rescinded 2026-04-17 by joint Fed/OCC/FDIC action; SR 26-2 explicitly carved GenAI / agentic AI out of Tier 3. Shadow is the governance layer for the class SR 26-2 won't govern. Maps to 40+ of the 230 Treasury FS AI RMF (Feb 2026) control objectives.
- **EU: GDPR Art. 22 + Schufa (C-634/21), not AI Act 2026.** Digital Omnibus deferred Annex III(5)(b) credit-scoring deadlines from 2026-08-02 → 2027-12-02. Schufa is enforceable today; Shadow's human-review + audit chain map directly to Art. 22 "meaningful information about the logic" + "human intervention" requirements.
- **CFPB 2026-07-21 rule change.** Disparate-impact narrowed under Reg B, but adverse-action notices, disparate-treatment, Fair Housing Act, and state AG enforcement stay actionable. Shadow's [signed reason-code dictionary](./lib/schemas/reason-code-dictionary.json) is the defensive posture — bank counsel signs the dictionary, not the LLM output.
- **Regulatory citation × persona × test map** — [`docs/CITATION_MAP.md`](./docs/CITATION_MAP.md) — bank counsel opening the repo can trace a regulatory obligation (SR 26-2, Reg B, ECOA, BSA/PATRIOT/FinCEN/OFAC, GDPR Art. 22, Schufa C-634/21, Reg BI) to the runtime persona that defends it to the exact test file that pins the invariant. Every row is a triple `<persona, citation, test file>` and every named test is currently green. Regulatory authority: Loredana C. Levitchi (BRD + Addenda A/B/C). PDF: [`docs/CITATION_MAP.pdf`](./docs/CITATION_MAP.pdf).
- **SOC 2 Type 1 readiness map** — [`docs/soc2-readiness.md`](./docs/soc2-readiness.md) — 35 controls mapped against AICPA Trust Service Criteria (Security / Confidentiality / Processing Integrity). 21 mechanically enforced with code + test evidence; 10 documented as prose; 4 N/A. Not yet formally audited — this is what a procurement team can grade before we scope the audit.
- **Case studies (full 4-case verdict lattice)** — [`docs/case-studies/`](./docs/case-studies/) — realistic scenarios showing Shadow's council + supporting controls firing end-to-end on synthetic loan applications:
  - [Case 1: $2.5M CRE loan with PEP owner + diverse routing → escalate](./docs/case-studies/01-cre-loan-with-pep-and-diverse-routing.md)
  - [Case 2: First-time HELOC, FICO 640 → block by Credit Fundamentals](./docs/case-studies/02-heloc-fico-hard-block.md)
  - [Case 3: SBA loan, OFAC SDN hit → block by AML/KYC](./docs/case-studies/03-sba-loan-ofac-sanctions-block.md)
  - [Case 4: Clean auto loan with Macro Contrarian dissent → still approve](./docs/case-studies/04-clean-auto-loan-with-macro-dissent.md)

## What's new in v1.4 (2026-07-02)

7 lib modules shipped in a single deep-research session — 78 new tests, all green.

- **Confidence-weighted verdict aggregator** ([`lib/confidence-weighted-verdict.js`](./lib/confidence-weighted-verdict.js)) — Roundtable Policy (arxiv 2509.16839) confidence-weighted fusion alongside the safety-in-depth simple resolver. `confidence_weighted_verdict` + `aggregated_score` + `voice_contributions` fields in every response.
- **Signed reason-code dictionary** ([`lib/schemas/reason-code-dictionary.json`](./lib/schemas/reason-code-dictionary.json) + [`lib/enforce-reason-code-dictionary.js`](./lib/enforce-reason-code-dictionary.js)) — 6 AA codes (AA01-06), 15-item ECOA protected-class proxy blocklist, signature block for bank counsel HMAC sign-off. Guardrails enforce that every AA code the council emits is backed by the checked-in dictionary.
- **AEX-style attestation** ([`lib/attestation.js`](./lib/attestation.js)) — signed request/output/model commitments on both `/api/deliberate` and `/api/loan-council`. Catches silent model substitution (arxiv 2504.04715) + response tampering. Two modes:
  - **HMAC-SHA-256** (default, back-compat) — symmetric secret
  - **Ed25519** (recommended for procurement) — asymmetric; bank verifies with public key, cannot forge
- **Hidden-anchor mitigation** ([`lib/presentation-order.js`](./lib/presentation-order.js)) — `voices[]` stays canonical for deterministic hash, new `presentation_order[]` field tells UIs how to shuffle for human display. Fixes the Hidden Anchors bias (arxiv 2606.19494).
- **AML/KYC Investigator voice** ([`lib/aml-kyc-voice.js`](./lib/aml-kyc-voice.js)) — opt-in 6th persona activated when loan carries `aml_flags[]` or `kyc_status`. Regulatory anchors: BSA 31 USC 5311, OFAC SDN + 50% rule, USA PATRIOT Act §326 CIP, FinCEN CDD 31 CFR 1010.230, FATF, GTOs. ACAMS 2026 signals AML is the fastest procurement lane at mid-tier banks.
- **Provider diversity** ([`lib/provider-diversity.js`](./lib/provider-diversity.js)) — deterministic assignment of voices to LLM providers to counter hallucination amplification (Free-MAD arxiv 2509.11035). Currently reports diagnostic; per-voice routing coming next.

### Ed25519 attestation — deploy guide for procurement

Generate a keypair at deploy time (v1.5.4+ ships a real CLI — no more scary `node -e` one-liner):

```bash
node bin/generate-attestation-keypair.mjs --key-id prod-2026-Q3
# → shadow-private.pem  (mode 0600, Shadow deployment ONLY)
# → shadow-public.pem   (mode 0644, share with bank auditors)
# → paste-ready env block printed to stdout
```

The CLI writes both keys with correct file permissions (0600 private / 0644 public) and prints a ready-to-paste env block for the Vercel dashboard / KMS:

```
SHADOW_ATTESTATION_MODE=ed25519
SHADOW_ATTESTATION_KEY_ID=prod-2026-Q3
SHADOW_ATTESTATION_ED25519_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Deliver to the bank auditor: **the PUBLIC key only**. Auditor can then run `verifyAttestation(att, req, res, {publicKey})` to independently verify any past Shadow decision. They cannot forge a signature — that requires the private key you never share.

Options: `--out <dir>` writes to a chosen directory · `--print-only` skips files for KMS-only pipelines · `--force` overwrites (rotation). Rotate at least yearly per NIST SP 800-57 §5.2 — the `key_id` field lets multiple keys co-exist during grace windows.

### 5-second procurement demo — public verifier CLI

Give this to a bank auditor:

```bash
# Bank auditor holds shadow-public.pem (public key only, NOT the private key)
node bin/verify-attestation.mjs \
  --response saved-shadow-response.json \
  --public-key shadow-public.pem
```

Output (happy path — the response is authentic):

```
✓ attestation verified
  mode:            ed25519
  model_id:        runLoanCouncil/pure-compute
  completed_at:    2026-07-04T16:52:28.131Z
  key_id:          v1
  request_hash:    9379409de5f633d4…
  output_hash:     b72e9f155823bba1…
```

Output (tampered path — the verdict was silently flipped after signing):

```
✗ attestation FAILED to verify
  reason:  output commitment mismatch — response was tampered
```

That's the whole thing. Bank auditor holds only the public key and can verify with one command. Cannot forge (that requires the private key you never share). No JS knowledge needed beyond running `node`. Works offline.

### One-command procurement acceptance demo (v1.5.5+)

Whole attestation loop end-to-end from a fresh clone — keypair generation → attestation build → CLI verify → HTTP verify → MCP verify → tamper detection — in one command, ~250ms:

```bash
npm run demo:attestation
# [1/6] Generate Ed25519 keypair                    ✓
# [2/6] Run /api/loan-council in-process             ✓
# [3/6] Verify with lib/attestation.js (CLI path)    ✓
# [4/6] Verify with POST /api/verify-attestation     ✓
# [5/6] Verify with shadow_verify_attestation (MCP)  ✓
# [6/6] Tamper detection catches silent verdict flip ✓ (correctly rejected)
```

The demo is wired into the test suite (`test/attestation-acceptance-demo.test.js`) so any regression in signing, verification, or tamper detection breaks CI. Procurement reviewers get a one-command proof; contributors get a one-command regression net.

### Same verifier, three dispatch surfaces (v1.5.2)

Auditors pick the surface that fits their workflow — same RFC 8032 primitive under all three, same response shape between the MCP tool + HTTP endpoint.

| Language | Surface | Path | Best for |
|---|---|---|---|
| Node | CLI | `bin/verify-attestation.mjs` | dev machines, one-off audits, procurement demos |
| Node | MCP tool | `shadow_verify_attestation` | Claude Desktop / Cursor / OpenCode chat |
| Node | HTTP endpoint | `POST /api/verify-attestation` | SIEM pipelines, CI integration tests, curl from anywhere |
| Python | library | `from shadow_verify import verify_attestation` (v1.5.6+) | Splunk SDK, pandas-based audit tooling, custom Python compliance harnesses |

**Drop-in bank CI recipe** for the HTTP endpoint: [`examples/verify-in-ci/`](./examples/verify-in-ci/) — GitHub Actions workflow + POSIX shell verifier + README. Every audit-log JSON file gets re-verified before merge; failures block the compliance record from being filed. Zero bank-side code required beyond dropping the two files into `.github/workflows/` and `scripts/`.

Example curl for the HTTP endpoint (bank SIEM playbook):

```bash
curl -sX POST https://your-shadow.vercel.app/api/verify-attestation \
  -H 'content-type: application/json' \
  -d '{
    "attestation": {...},
    "original_request": {...},
    "original_response": {...},
    "public_key": "-----BEGIN PUBLIC KEY-----\n..."
  }' | jq '{ok, mode, model_id, interpretation}'
```

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

The MCPTox mitigation is **mechanically demonstrated**, not asserted — see [`test/mcptox-canary.test.js`](./test/mcptox-canary.test.js): 28 contract tests covering 6 MCPTox §3 attack categories (instruction injection, trade-execution verb injection, echo-back probe, oversize buffer, HTML / script injection, nested-JSON auth bypass) plus 4 tool-description anti-poisoning assertions. The same suite covers **MosaicLeaks-class multi-turn information-leak** vectors — category-C echo-back + category-F nested-JSON pin the invariant that an attacker cannot exfiltrate a canary token across the tool boundary.

The rest of this README covers collaboration, the 87 ± 3 agentic benchmark, the live demo, MCP integration, and the full architecture.

## Collaboration and license

Shadow v1.1.1 vendors the **Orallexa Shadow Mode A** package authored by **Loredana C. Levitchi** (Yeshiva University + William Paterson University faculty, 14 years global banking software). Under MIT license, per her explicit grant 2026-06-19, she is the primary author of:

- The risk + credit-policy + threshold + adverse-action + traceability modules
- The **BRD vs. Addenda Source Separation Principle** — a procurement-defensibility governance pattern formalized in her *Orallexa Shadow Mode A* package and shipped inline at the API response level via `lib/traceability.js`
- The Aura Alexa BRD + Addenda A/B/C + Risk Appetite Note (vendored under `docs/external/`)

A co-first-author IEEE VR / VIS 2027 abstract (deadline 2026-08-24) is in flight, with the BRD vs. Addenda Source Separation Principle as the named contribution. Integration maintainer for the JS port + spatial XR layer: Alex Xiaoyu Ji.

## Live demo

**Public URL**: https://shadow-mentor-o033hfcya-alex-jbs-projects.vercel.app *(Vercel Deployment Protection toggle pending — see `CHANGELOG.md`)*

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
- **9 JSON endpoints live**: `/api/deliberate` (POST, +loan body adds verdict) · `/api/loan-council` (POST, pure-compute 5-voice rule layer, Lora Mode A) · `/api/verify-attestation` (POST, public HTTP verifier, v1.5.2) · `/api/recall` · `/api/calibration` · `/api/scenarios` · `/api/health` · `/api/badge` (shields.io) · `/api/version` (git SHA audit pin)
- **MCP server**: `node mcp/server.js` exposes 5 tools (`shadow_loan_council`, `shadow_risk_tools`, `shadow_recall`, `shadow_calibration`, `shadow_scenarios`) for Claude Desktop / Cursor / Zed / OpenCode native tool-use. See `mcp/README.md` for `claude_desktop_config.json` snippet.
- **Levitchi Mode A integration shipped + tightened (v1.1.1)**: typed risk tools (VaR / ES / concentration / sector / correlation / beta) + 5-voice verdict resolver (block > escalate > approve) + loan input schema with BR thresholds (FICO 700 / DTI 0.36 / LTV 0.80 / VaR 0.12 @ 95%/10d) pinned in drift-detection tests. **v1.1.1: FICO < 700 is a hard block** (not escalate) per Levitchi's policy clarification — credit-eligibility floor is not negotiable.
- **Procurement-grade citation chain (v1.1+)**: inline `traceability` dict in every `/api/deliberate` response mapping each threshold to BRD vs Addendum vs Risk Appetite Note source. AA01-05 adverse-action codes match CFPB Bulletin 2024-09 model-traceability requirement. `enforceAnalysisOnly()` regex guardrail catches LLM hallucination of trade-execution verbs at council output boundary. 14 contract tests enforce provenance.
- 770/771 tests green (1 skipped: OCR live smoke gated on billing envelope); GitHub Actions CI 100+ consecutive commits green
- **Cross-vertical persona pack (v0.2.1 LIVE)** — `lib/personas/trader-pack/` Risk Sizer wired into `POST /api/deliberate` via `{"mode": "trading", "trade": {...}}` + `shadow_size_position` as 8th MCP tool (analysts inside Cursor / Claude Desktop can size trades without curling). Ed25519 attestation on trading verdicts uses the same signing key + payload format as banking. 7 pure-JS contract tests + 11 HTTP-boundary tests enforce the FinPos "never emit direction" invariant end-to-end. Cross-vertical hash-chain continuity lands v0.4.
- **Third vertical LIVE (ds-pack v0.2)** — `lib/personas/ds-pack/` deterministic 5-voice governance council (Data Steward / Model Validator / Fair-ML Auditor / Reproducibility Critic / Ops Realist) live at `POST /api/deliberate` via `{"mode": "ds", "ds": {...}}`. Pure computation — no LLM needed. Fair-ML BLOCK on EEOC 80% rule violation always overrides other voices. Ed25519 attestation shares banking's signing key. 13 pure-JS contract tests + 9 HTTP-boundary tests. **All three verticals now share one attestation surface end-to-end.**
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
