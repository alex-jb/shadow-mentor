# Shadow Agentic Score — Stability Record

> The rubric is deterministic. The LLM calls are not. So the aggregate score is a sample, not a fixed value. This folder keeps every run so reviewers can audit the central tendency themselves.

## Source provenance (2026-06-19 — per Loredana C. Levitchi's BRD vs Addenda guidance)

Every benchmark expected term is attributed to one of three governance layers. Mis-attributing a term to a higher layer than it belongs (e.g. citing BRD for an underwriting cutoff that is actually a product-line policy) is the classic procurement-audit failure mode. This split was formalized by Lora on 2026-06-19 and is now enforced inline by Shadow's `/api/deliberate` response (`traceability` field) and by the `test/traceability-and-guardrail.test.js` contract suite.

| Benchmark term | Source | Layer | Implementation |
|---|---|---|---|
| `FICO >= 700` | Addendum A — Loan Origination Credit Policy | Product-line policy | `lib/run-loan-council.js` + AA01 |
| `DTI <= 0.36` | Addendum B — DTI Eligibility Policy | Product-line policy | `lib/run-loan-council.js` + AA02 |
| `LTV <= 0.80` | Addendum C — Collateral / LTV Policy | Product-line policy | `lib/run-loan-council.js` + AA03 |
| `VaR <= 0.12` | Addendum C — Risk Appetite Note | Benchmark calibration | `lib/traceability.js::classifyVarStatus` + AA04 |
| VaR / ES math framework | BRD Risk Core Specification | Institutional risk framework | `lib/risk-tools/index.js` |
| 10-day horizon | BRD Risk Packet Methodology | Institutional risk framework | `LOAN_DEFAULTS.var_horizon_days` |
| 95% confidence | BRD Risk Packet Methodology | Institutional risk framework | `LOAN_DEFAULTS.var_confidence` |
| Analysis-only / no-trade invariant | BRD Governance Controls | Institutional risk framework | `lib/audit-guardrail.js::enforceAnalysisOnly` |
| ECOA / Reg B integration | CFPB Circular 2026-03 + BRD Governance | Regulatory | Fair Lending Compliance voice + AA05 |
| SR 11-7 effective challenge | Federal Reserve Model Risk Mgmt | Regulatory | benchmark rubric + Risk Officer voice |

This is the source separation that makes the Shadow benchmark procurement-defensible. Examiners can audit any cited rule back to the correct depth — institutional / product-line / calibration / regulatory — without conflation.

## Pre-BR (v0.3.3 rubric — compliance × LBO terms ["policy 4.3", "B-rated", "leverage"])

2026-06-18 evening, anthropic provider:

| Run | Score | Notes |
|---|---|---|
| A | 87/100 | trader × bloomberg 64 (low outlier), trader × cds 100 |
| B | 93/100 | best run — 4 perfect tasks (compliance × lbo, engineer × lbo, trader × cds, trader × bloomberg) |
| C | 86/100 | trader × cds dropped to 71, otherwise tracks A |

**Pre-BR mean: 88.7 / 100 · std: 3.1 · range: 86-93 (spread 7)**

Aggregate badge string at the time: `89 ± 3 (n=3)`

## Post-BR (v0.3.4 rubric — compliance × LBO terms ["Policy 4.3", "B-rated", "FICO", "DTI", "LTV"])

2026-06-19 early UTC (2026-06-18 late NY), anthropic provider. **Compliance × LBO question reframed to include Loredana's Aura Alexa BR thresholds** (FICO 720 / DTI 0.32 / LTV 0.78) so the council must reference her threshold framing to score full term-coverage. 3 expected terms → 5 expected terms.

| Run | Score | compliance × LBO cell | Notes |
|---|---|---|---|
| A | 86/100 | 92/100 (1.0/1.0/1.0 term cov) | all 3 voices echo all 5 BR terms |
| B | 87/100 | 86/100 (0.80/1.0/0.80) | junior + third each missed 1 of 5 terms (likely "FICO" or "DTI") |
| C | 85/100 | 92/100 (1.0/1.0/1.0) | all 3 voices echo all 5 BR terms |

**Post-BR mean: 86.0 / 100 · std: 1.0 · range: 85-87 (spread 2)**

Aggregate badge string: `86 ± 1 (n=3, post-BR)`

## Pre-BR → Post-BR delta

| Metric | Pre-BR | Post-BR | Δ |
|---|---|---|---|
| Aggregate mean | 88.7 | 86.0 | **-2.7** |
| Aggregate std | 3.1 | 1.0 | **-2.1 (tighter)** |
| compliance × LBO (cell) | 100 stable | 92/86/92 mean ~90 | **-10 on the modified cell** |
| Term coverage strictness | 3-term per voice | 5-term per voice | +2 terms ≈ +67% bar |

**Honest reading**:
- Adding 2 more required terms (FICO, DTI) shaved ~10 points off the cell that was modified. Sonnet's compliance voice consistently includes "Policy", "B-rated", "leverage" already; it does NOT always include "FICO" or "DTI" verbatim despite the question naming them.
- The aggregate dropped less than the cell (~3 vs 10) because compliance × LBO is 1 of 8 tasks.
- Variance got tighter — counter-intuitively, the harder rubric is MORE reproducible. Likely because the 5-term threshold is closer to a step function (4 of 5 or 5 of 5) so less stochastic than the 3-term version (1/3 vs 2/3 vs 3/3 has more granularity).

**This is exactly the kind of result that demands honest reporting, not tuning**. We commit to neither (a) reverting the BR threshold wiring nor (b) updating persona prompts to chase the lost points. The Aura Alexa BR thresholds are the procurement-defensible source of truth — the council should reference them or the eval should reveal the gap.

## Mixed n=6 aggregate (all runs ever, regardless of rubric version)

For continuity with the existing drift-detection test in `test/benchmark-stats.test.js`, the `aggregate-history.mjs` script reads all JSON files in this folder and computes:

**`87 ± 3 (n=6)` · mean 87.3 · std 2.6 · range 85-93**

This mixes two rubric versions and should be read as "all Shadow benchmark runs ever observed." For procurement, prefer the per-version splits above.

## How to reproduce

```bash
export ANTHROPIC_API_KEY=...
node benchmark/runner.js   # writes benchmark/report-YYYY-MM-DD.json
                            # NOTE: YYYY-MM-DD is UTC date, not local
# Cost ~$0.05 per run. Capture: cp the report file to history/ with
# a distinct name. The runner overwrites the same report file on each run.
```
