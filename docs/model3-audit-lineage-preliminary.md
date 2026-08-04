# Model 3 (Audit Completeness & Evidence Lineage) — preliminary implementation

*Companion to the Katz AY2026-2027 proposal. Implements Lora Levitchi's Model 3 as a tested, reusable module over the shipped Orallexa Shadow evidence bundle. 2026-08-04.*

## What this is
Model 3 in the proposal formalizes audit completeness and evidence lineage as measurable quantities. This note reports a working implementation (`lib/audit-lineage.js`, `auditLineageScore()`), so the proposal's Model 3 and the evaluation-table rows ("first-failure localization", "100% verification for untampered bundles; correct failure localization") are **preliminary work, not future work**. Values below are reproducible from the shipped sample bundle.

## Formula → code map
| Model 3 quantity | Definition | Where |
|---|---|---|
| `A_cov` weighted audit completeness | Σ w_r·1[verified_r] / Σ w_r over the required-evidence set R | `auditLineageScore(..., {required})` |
| `C_lin` lineage connectivity | 1 − R_disc | derived from the verified chain prefix |
| `R_disc` disconnected-evidence rate | fraction of the chain with no valid path to the sealed decision (everything after the first failed link) | `firstFailureSeq / N` |
| `D_norm` normalized lineage depth | verified source→decision path length / N | `connectedPrefix / N` |
| first-failure localization | exact seq where stored ≠ recomputed hash, or `prev_hash` breaks | from `verifyBundle` (payload rebind + chain) |
| `P_fail` post-failure invalidation | proportion of the chain invalidated after the first failure | `(N − firstFailureSeq) / N` |
| `A_total` unified score | α·A_cov + β·C_lin + γ·D_norm − δ·R_disc − η·P_fail, clamped [0,1] | default α,β,γ = 0.5,0.3,0.2 (sum 1); δ,η = 0.3,0.2 |

The chain terms are computed by the already-tested `verifyBundle`, which this week was corrected to **carry the plaintext and rebind it to the signed hash** — so an edit to the recorded decision (e.g. a verdict flip) both fails verification and is localized to the exact event. That correction is what makes `first-failure localization` and `100% verification for untampered bundles` demonstrably true rather than aspirational.

## Reproducible result (sample denied-loan bundle, 5 events)
| | integrity | A_cov | C_lin | R_disc | D_norm | first-failure | P_fail | **A_total** |
|---|---|---|---|---|---|---|---|---|
| **Untampered** | ✓ | 1.00 | 1.00 | 0.00 | 1.00 | — | 0.00 | **1.00** |
| **Verdict flipped (seq 2)** | ✗ | 0.00 | 0.40 | 0.60 | 0.40 | **seq 2** | 0.60 | **0.00** |

The score is monotone and interpretable: a fully-covered, fully-connected, untampered record scores 1.0; a single plaintext edit drops it to 0 and names the seq. With an explicit weighted required-evidence set R, `A_cov` degrades gracefully in proportion to the missing evidence's severity weights (tested).

## Tests
`test/audit-lineage.test.js` (5 cases): clean → 1.0 + full connectivity; plaintext tamper → first-failure localized at the edited seq + score drop; weighted A_cov over a required set (4/8 weighted = 0.5, 3/4 unweighted = 0.75); all-missing → A_cov 0; weight override. Runs under `node --test`, no external services.

## Honest scope
This is a preliminary implementation on the linear evidence chain the bundle currently uses. The proposal's fuller Model 3 — a general provenance DAG with per-node importance, evidence centrality, and the data-quality reliability vector (§3.5) — is the research contribution to develop and analyze during the funded period (Sept 2026–Apr 2027). What exists today is the audit-completeness + connectivity + first-failure core, tested and reproducible, as the foundation.
