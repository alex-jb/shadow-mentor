# Shadow DS Pack — Data-Science persona pack (third vertical)

**Version:** 0.2 (5-voice council LIVE, 2026-07-07) · **Status:** live at `POST /api/deliberate` with `{"mode": "ds", "ds": {...}}`
**Target:** ML/analytics governance for institutions running production data-science pipelines (regulated fraud detection, credit risk scorecards, marketing propensity, insurance underwriting).
**Sibling packs:** `../trader-pack/` (LIVE at `/api/deliberate?mode=trading` per v1.5.15) · banking mode is the default `/api/deliberate` path (5-voice loan council).

---

## Why this exists

Per `docs/strategy/roadmap-2026-2028.md`, Shadow's product surface serves three verticals: **Bank / Trading / Data-Science**. Trading landed in v1.5.15. Data-science is next.

**The regulatory gap this fills:**

Data-science teams inside banks + insurers ship models under three overlapping regimes:

1. **SR 26-2 Tier 1 (Traditional Models)** — the trained scikit-learn / XGBoost / statsmodels artifact — full effective challenge required. Well-covered by ModelOp / Credo AI / Holistic AI.
2. **SR 26-2 Tier 2 (Non-Model Tools)** — feature engineering DAGs, Great Expectations checks, sklearn `Pipeline` objects. General governance only.
3. **SR 26-2 (GenAI/agentic AI carved out by footnote 3) (Excluded Innovations)** — LLM-in-the-loop pipelines: RAG-augmented scorecards, LLM-generated features, LLM code that writes Pyspark/Snowpark. **Explicitly carved out.** This is the Shadow gap.

The DS-pack governs the **Tier 3 boundary** — the moment when a data scientist inside a bank prompts Claude / GPT to write feature-engineering code, or asks an LLM to justify why a specific model + threshold combination clears Reg B disparate-impact.

---

## Persona mapping (banking ↔ trading ↔ data-science)

| Banking (Shadow LIVE) | Trading (LIVE v1.5.15) | Data-Science (this pack, v0.1) |
|---|---|---|
| Credit Fundamentals | Bull (thesis-for) | Data Steward (data lineage + drift owner) |
| Risk Officer | Bear (thesis-against) | Model Validator (SR 26-2 effective challenge for the ML artifact) |
| Fair Lending Compliance | Judge (synthesis + verdict) | Fair-ML Auditor (disparate-impact + parity metrics) |
| Customer Advocate | Critic (Polyseer-style meta-critique) | Reproducibility Critic (can this pipeline be re-run 3 years from now?) |
| Macro Contrarian | Polyseer (multi-source verifier) | Ops Realist (production-latency + memory + cost) |
| AML/KYC Investigator (opt-in) | Risk Sizer (FinPos, opt-in) | ML Attribution Auditor (opt-in — feature-importance disparate-impact) |

The wire format is identical across all three verticals. `TradingVoice` from `../trader-pack/types.js` is the byte-identical shape a `DSVoice` will inherit from — so cross-language attestation stays byte-identical whether the source is banking (JS), trading (JS + Orallexa Python), or data-science (JS + a future Python data-science skill).

---

## What ships in v0.2 (deterministic 5-voice council LIVE at the HTTP boundary)

Types + deterministic 5-voice governance council + 13 pure-JS contract tests + 9 HTTP-boundary tests + live dispatch at `/api/deliberate` when `body.mode === "ds"`. **No LLM calls** — the DS vertical is pure computation on the caller-provided `MLArtifactRef`. Same attestation contract as banking + trading.

- `types.js` — JSDoc types for `DSVoice`, `DSDebateInput`, `DSDebateOutput`, `MLArtifactRef`. Byte-identical shape to `../trader-pack/types.js:TradingVoice`.
- `run-ds-council.js` — 5 deterministic voice scorers + conservative verdict resolver (ANY BLOCK → BLOCK; ANY REWORK → REWORK; ALL SHIP → SHIP). See § "Voice triggers" below.
- `test/ds-pack-council-contract.test.js` — 13 pure-JS contract tests enforcing the 5 named invariants.
- `test/api-deliberate-ds-mode.test.js` — 9 HTTP-boundary tests: valid dispatch, Fair-ML BLOCK propagation, Ed25519 attestation shape + tamper detection, input validation, banking-mode isolation, governance_packet shape.

Not yet shipped:
- LLM-augmented voice rationales (v0.3 — narrative layer on top of the deterministic verdicts)
- MCP tool `shadow_ds_council` as 9th canonical MCP tool (v0.3)
- MLflow + Great Expectations metadata integration (v0.4)

---

## Voice triggers (v0.2)

Each voice applies one declarative scorer to the `MLArtifactRef`. Thresholds are caller-overridable via `runDSCouncil(input, thresholds)` — defaults documented in `run-ds-council.js:DEFAULT_THRESHOLDS`.

| Voice | Trigger | Default threshold | Verdict when triggered |
|---|---|---|---|
| Data Steward | `drift_snapshot.psi` too high | > 0.25 | REWORK |
| Model Validator | `calibration.brier` too high | > 0.25 | REWORK |
| Fair-ML Auditor | `disparate_impact.aim_ratio` below 80% rule | < 0.80 | **BLOCK** (EEOC 80% rule) |
| Reproducibility Critic | `artifact_id` or `feature_columns` missing | present required | REWORK |
| Ops Realist | `ops_metrics.p95_ms` too slow | > 1000ms | REWORK |

Missing metadata is REWORK, never SHIP. This is the core Reproducibility invariant.

---

## Wire-format contract

```
POST /api/deliberate
Content-Type: application/json

{
  "mode": "ds",
  "ds": {
    "artifact": {
      "artifact_id": "mlflow-run-abc123",
      "model_type": "xgboost.XGBClassifier",
      "task": "credit_scoring",
      "feature_columns": ["fico", "dti", "ltv", "amount", "sector"],
      "drift_snapshot": { "psi": 0.10 },
      "calibration": { "brier": 0.15 },
      "disparate_impact": { "aim_ratio": 0.92 },
      "ops_metrics": { "p95_ms": 250 }
    },
    "lifecycle_stage": "pre_deploy" // optional: pre_deploy | post_deploy_monitor | decommission
  }
}
```

Response:

```json
{
  "mode": "ds",
  "voices": [ /* 5 DSVoice objects */ ],
  "verdict": "SHIP" | "REWORK" | "BLOCK",
  "governance_packet": {
    "drift_status": "SHIP",
    "model_validation_status": "SHIP",
    "fair_ml_status": "SHIP",
    "reproducibility_status": "SHIP",
    "ops_status": "SHIP"
  },
  "adverse_action_codes": ["AA05"], // AA05 populated when Fair-ML BLOCK fires
  "ds_pack_version": "v0.2",
  "latency_ms": 2,
  "attestation": {
    "model_id": "shadow/ds-pack@v0.2",
    "signature": "...",
    ...
  }
}
```

---

## Roadmap

- **v0.3** (~4 hours): LLM-augmented voice rationales — deterministic scorer above still fires the verdict, but Claude Sonnet re-writes the rationale field with regulator-fluent language (SR 26-2 effective challenge / FFIEC three-step / GDPR Art. 22 as applicable). Adds MCP tool `shadow_ds_council` as the 9th canonical MCP tool.
- **v0.4** (~4 hours): Great Expectations + MLflow integration — DS pack reads metadata directly from MLflow tracking server + Great Expectations suite results.
- **v0.5** — production-ready release. This is when the Shadow "one engine, three verticals" claim is demonstrable end-to-end at bank + broker-dealer + insurer prospect meetings.

---

## Cross-language attestation invariant

Every DS-vertical decision's attestation payload must be byte-identical whether generated by the JS ds-pack or by a future Python data-science library (analogous to how the trader-pack is byte-identical to Orallexa Python).

Specifically:
- `signing_payload` = pipe-delimited `{model_id}|{request_commitment}|{output_commitment}|{completed_at_utc}|{previous_hash}|{key_id}[|{dictionary_hash}]`
- `modelId` for pure-computation DS paths is `shadow/ds-pack@vX.Y`; for LLM-driven DS voices it's a composite id like `anthropic/sonnet-4-6+shadow/ds-pack@vX.Y`
- Byte-identical to what the trader-pack + banking-pack already emit — so a bank SIEM that consumes one consumes the rest

---

## Non-goals for v0.1 (explicit)

- Not competing with MLflow, Weights & Biases, or Great Expectations at the tracking layer. Shadow is the **governance opinion layer** that reads their outputs.
- Not shipping a trained model. Data-science governance ≠ model training.
- Not an LLM-agnostic Layer, but a Constitution-v2 layered persona pack (L1 mission / L2 guidelines / L3 thresholds) as documented in `../../persona-schema.json`.

---

## Contact

- Alex Xiaoyu Ji · xji1@mail.yu.edu — cross-vertical architecture + strategic direction
- Loredana C. Levitchi · [email verify] — banking-domain guidance on the Bank ↔ DS regulatory boundary
- (open) — data-science-vertical expert (target: someone with ML production ops + Fair-ML audit chops)

*This scaffold is a public artifact of `shadow-mentor` (MIT). Do not `import` from it until v0.2 lands.*
