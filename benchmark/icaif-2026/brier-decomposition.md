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
