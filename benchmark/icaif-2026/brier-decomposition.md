# Per-persona Brier decomposition (Murphy 1973) — real per-class probabilities

Rows: 2400 council decisions across 12 seeds · bins=10 · realized event = gold_verdict (ground truth).
Deterministic pipeline (no LLM): persona probabilities derive from rule margins (lib/persona-probabilities.js).

| Persona | n | multiclass Brier | class | Brier | REL | RES | UNC | base rate |
|---|---|---|---|---|---|---|---|---|
| Credit Fundamentals | 2400 | 0.202338 | approve | 0.090047 | 0.065133 | 0.205068 | 0.230979 | 0.637917 |
|  |  |  | escalate | 0.079826 | 0.055612 | 0.14406 | 0.167822 | 0.213333 |
|  |  |  | block | 0.032465 | 0.031935 | 0.126623 | 0.126623 | 0.14875 |
| Risk Officer | 2400 | 0.45782 | approve | 0.172081 | 0.009522 | 0.066033 | 0.230979 | 0.637917 |
|  |  |  | escalate | 0.17434 | 0.016723 | 0.008513 | 0.167822 | 0.213333 |
|  |  |  | block | 0.111398 | 0.013821 | 0.026835 | 0.126623 | 0.14875 |
| Fair Lending Compliance | 2400 | 0.576304 | approve | 0.274023 | 0.054372 | 0.011328 | 0.230979 | 0.637917 |
|  |  |  | escalate | 0.187797 | 0.019975 | 0 | 0.167822 | 0.213333 |
|  |  |  | block | 0.114483 | 0.008032 | 0.020172 | 0.126623 | 0.14875 |
| Customer Advocate | 2400 | 0.622671 | approve | 0.295537 | 0.064558 | 0 | 0.230979 | 0.637917 |
|  |  |  | escalate | 0.187797 | 0.019975 | 0 | 0.167822 | 0.213333 |
|  |  |  | block | 0.139336 | 0.012713 | 0 | 0.126623 | 0.14875 |
| Macro Contrarian | 2400 | 0.476207 | approve | 0.200544 | 0.024838 | 0.055273 | 0.230979 | 0.637917 |
|  |  |  | escalate | 0.138142 | 0.00731 | 0.03699 | 0.167822 | 0.213333 |
|  |  |  | block | 0.137521 | 0.01176 | 0 | 0.126623 | 0.14875 |

`binning_residual` per class lives in brier-decomposition.json (within-bin variance; standard).

## Reproduction

```
commit: dcc712e8edf640d3d01c76aa440565a9ecb1913d
dataset: synthetic loans from scripts/icaif-batch-eval.mjs generator (committed jsonl)
seeds: 20260710, 20260711, 20260712, 20260713, 20260714, 20260715, 20260716, 20260717, 20260718, 20260719, 20260720, 20260721
n per seed: 200 (2,400 total)
probability method: lib/persona-probabilities.js — deterministic rule-margin logistic; argmax(p) === verdict by construction; no LLM
commands:
  for s in <seeds>; do node scripts/icaif-batch-eval.mjs --n 200 --seed $s --out benchmark/icaif-2026; done
  BENCH_COMMIT=$(git rev-parse HEAD) node scripts/icaif-brier-decomposition.mjs
```

## Limitations (stated up front, not buried)

- Synthetic loan generator, not production traffic; base rates are generator artifacts.
- Probabilities are rule-margin transforms, not learned forecasts; REL/RES reflect the margin geometry.
- gold_verdict is the generator's label, not a bank adjudication.
- Dissent personas (Advocate/Contrarian/Fair-Lending) are BY DESIGN weak ground-truth forecasters; their high Brier is the division-of-labor story, not a defect — and is reported, not filtered.
- CI95 is a deterministic-seed bootstrap (1,000 resamples) over decisions; seeds are fixed, so run-to-run variance is zero by construction.
