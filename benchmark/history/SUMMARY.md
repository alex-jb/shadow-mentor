# Shadow Agentic Score — Stability Record

> The rubric is deterministic. The LLM calls are not. So the aggregate score is a sample, not a fixed value. This folder keeps every run so reviewers can audit the central tendency themselves.

## 2026-06-18 evening (v0.3.3 prompts)

| Run | Score | Provider | Notes |
|---|---|---|---|
| A | 87/100 | anthropic | trader × bloomberg 64 (low outlier), trader × cds 100 |
| B | 93/100 | anthropic | best run — 4 perfect tasks (compliance × lbo, engineer × lbo, trader × cds + tier) |
| C | 86/100 | anthropic | trader × cds dropped to 71, otherwise tracks A |

**Mean: 88.7 / 100**
**Std dev: 3.1**
**Range: 86-93 (spread of 7 points)**

## Honest reading

- Aggregate score reported as `88 ± 4 (n=3)` in marketing materials.
- The most volatile cells are trader × bloomberg and trader × cds — Sonnet runs the trader voice long, occasionally over the rubric ceiling on length checks.
- Compliance × policy, engineer × lbo, advisor × lbo are the most stable (within ±5 of their own mean across runs).
- Three perfect 100/100 tasks observed at least once each: compliance × lbo, engineer × lbo, trader × cds. None hit 100 every run.

## How to reproduce

```bash
export ANTHROPIC_API_KEY=...
node benchmark/runner.js
# writes benchmark/report-YYYY-MM-DD.json
# cost ~$0.05/run
```

Capture multiple runs into this folder by renaming the dated report
to `benchmark/history/YYYY-MM-DD-run-X.json` after each invocation.
