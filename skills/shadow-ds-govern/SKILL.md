---
name: shadow-ds-govern
description: >
  Run a 5-voice data-science governance council on an ML artifact reference.
  Data Steward (drift), Model Validator (calibration), Fair-ML Auditor
  (EEOC 80% rule, always blocks on violation), Reproducibility Critic
  (metadata completeness), Ops Realist (p95 latency). Returns SHIP / REWORK
  / BLOCK with per-voice rationale. Pure computation — no LLM. Use before
  shipping any ML pipeline that will make consumer-facing decisions.
version: 1.0.1
author: Alex Xiaoyu Ji
authors:
  - Alex Xiaoyu Ji <xji1@mail.yu.edu>
license: MIT
repo: https://github.com/alex-jb/shadow-mentor
tags:
  - shadow
  - data-science
  - ml-governance
  - fair-ml
  - eeoc
  - model-risk
  - psi-drift
  - brier
scope: shadow:council
depends_on:
  - shadow_ds_council MCP tool (v1.5.15+ via POST /api/deliberate?mode=ds)
---

# Shadow DS Govern

Model-risk council for data-science pipelines. Deterministic. No LLM.

## When to use

The user's request contains an ML artifact reference — at minimum a model + feature list — and asks any variant of:

- "Should we ship this?"
- "Is this defensible for production?"
- "Would compliance sign off on this?"
- "Are we above the disparate-impact ratio?"

## Required input

An `MLArtifactRef` object. Minimum viable payload:

```json
{
  "artifact_id": "mlflow-run-abc123",
  "model_type": "xgboost.XGBClassifier",
  "task": "credit_scoring",
  "feature_columns": ["fico", "dti", "ltv", "amount", "sector"]
}
```

Optional but recommended (missing → REWORK on the relevant voice):

- `drift_snapshot.psi` — Population Stability Index (Data Steward)
- `calibration.brier` — out-of-sample Brier score (Model Validator)
- `disparate_impact.aim_ratio` — adverse-impact ratio (Fair-ML Auditor)
- `ops_metrics.p95_ms` — inference latency (Ops Realist)

## What it does

Five voices, each applying a declarative scorer:

| Voice | Trigger | Verdict |
|---|---|---|
| Data Steward | PSI > 0.25 | REWORK |
| Model Validator | Brier > 0.25 | REWORK |
| Fair-ML Auditor | adverse-impact ratio < 0.80 | **BLOCK** (EEOC 80% rule) |
| Reproducibility Critic | artifact_id or feature_columns missing | REWORK |
| Ops Realist | p95 > 1000 ms | REWORK |

Resolver: ANY BLOCK → BLOCK; ANY REWORK → REWORK; ALL SHIP → SHIP. Same conservatism as banking-side block > escalate > approve.

## The named invariants

1. **Fair-ML BLOCK is unconditional.** If adverse-impact ratio is below 0.80, verdict is BLOCK regardless of what the other four voices say. EEOC 80% rule is a hard floor.
2. **Missing metadata is REWORK, never SHIP.** Reproducibility Critic returns REWORK if either `artifact_id` or `feature_columns` is missing. You cannot ship a model you cannot re-run three years from now.
3. **AA05 fires when Fair-ML BLOCK fires.** The response `adverse_action_codes` will contain "AA05" if consumer-facing.

Contract test coverage in `test/ds-pack-council-contract.test.js` (13 pure-JS tests) + `test/api-deliberate-ds-mode.test.js` (9 HTTP-boundary tests).

## Approval boundary

If verdict is BLOCK, the model must not ship without a documented less-discriminatory-alternative analysis under the FFIEC three-step framework. This skill produces the verdict; the LDA analysis is separate work.

If verdict is REWORK, ship-review is paused. The rationale names which voice failed and why (specific threshold breach).

## Non-goals

- Not a model-training tool. Consumes MLflow / Weights & Biases / manual metadata.
- Not a full model-risk management framework. Focuses on the boundary conditions SR 26-2 (GenAI/agentic AI carved out by footnote 3) explicitly carved out — LLM-in-the-loop feature engineering and generated pipeline code.
- Not a regulator. This is Shadow's opinion; the bank's compliance officer makes the final call.

## Reference

- `lib/personas/ds-pack/run-ds-council.js` — the JS implementation.
- EEOC 80% rule (Uniform Guidelines on Employee Selection Procedures, 29 CFR 1607.4D).
- FFIEC three-step framework for disparate-impact analysis.
- Barocas & Selbst 2016 (Big Data's Disparate Impact) — proxy blocklist reference.
