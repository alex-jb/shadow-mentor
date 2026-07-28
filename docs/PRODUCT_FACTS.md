# Product facts — the single source of truth

`product-facts.json` (repo root) is canonical. README, `llms.txt`, `index.html`,
`skills/README.md`, and any presentation copy are **validated against it** by
`test/product-facts-drift.test.js`. Change a fact there once; the drift guard tells you
which surface still disagrees. This replaces hand-editing "6 → 7 → 11 tools" in six files.

## What it pins

| Fact | Value | Enforced by |
|---|---|---|
| Positioning | Independent evidence and decision audit layer for AI systems | drift guard (llms.txt) |
| Council voices | 5 | drift guard |
| MCP tools | **11** (was drifting 6/7) | drift guard vs `mcp/server.js` registrations |
| Current standard | **SR 26-2** (superseding SR 11-7) | drift guard + coherence test |
| EU refs | EU AI Act Art. 14 **and** GDPR Art. 22 **and** Schufa — complementary | drift guard |

## Regulatory discipline (do not "fix" these into each other)

- **SR 26-2 supersedes SR 11-7.** Write "SR 26-2 (superseding SR 11-7)". Keep SR 11-7 as a
  *searchable legacy alias* for migration / historical audit — never delete it, never cite it
  as current (the citation gate REWORKs a current SR 11-7 citation after 2026-04-17).
- **EU AI Act Article 14** (human oversight) and **GDPR Article 22** (automated individual
  decision-making) and the **Schufa** interpretation are **complementary layers**, not
  substitutes. Do not replace Art. 14 with Art. 22.
- **Conformal / coverage** work is **research-grade pilot** only (n<100). Never "guaranteed
  90% correctness" or "certified banking decision".
- **Head-directed focus ≠ eye tracking.** UI copy: "HEAD-DIRECTED FOCUS" / "XR GAZE
  INTERACTION". Never "eye tracking" / "user is looking at…".

## Confidence semantics

The per-voice `confidence` numbers in the deterministic council (0.82 / 0.78 / 0.91 / 0.74 /
0.69) are **fixed persona priors** — "STANCE STRENGTH" — **not** model probabilities and **not**
a probability of correctness. A reliability diagram **cannot** be drawn from constants.

The council response now carries a machine-readable declaration:

```json
"confidence_semantics": {
  "kind": "persona_prior",
  "ui_label": "STANCE STRENGTH",
  "is_model_probability": false,
  "is_probability_of_correctness": false,
  "reliability_diagram_valid": false
}
```

Allowed `kind` values: `persona_prior | model_probability | calibrated_probability |
fixture_score | unknown`. The `confidence` field name is retained for backward compatibility;
its **meaning** is declared here, and every surface (Node JSON, Unity COUNCIL label, PPT,
README) must read it under this semantics — the Unity stage now labels it "STANCE STRENGTH",
not "confidence".

## Capability ladder

`source-authored → host-tested → unity-authored → device-pending → device-validated`.
Nothing claims a higher rung than it has reached. XR audit arc + head-directed focus are
`unity-authored` / `device-pending` (Beam Pro). Semantic audit of ingested output and the
claim–evidence graph are `source-authored` this slice.
