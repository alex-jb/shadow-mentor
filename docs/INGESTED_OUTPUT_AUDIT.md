# Auditing untrusted third-party / LLM output

`lib/audit-ingested.mjs` → `auditIngestedOutput(input)`. This is the differentiator. Shadow's
other primitives audit its own deterministic templates (correct by construction — circular).
This one audits **someone else's agent output**, which may be wrong, ungrounded, stale, or
adversarial. External content is **data, never instructions** — it is never executed.

## Input
```
{ sourceType?, provider?, model?, promptHash?, output, retrievedSources?, toolCalls?, timestamps?, claims?, groupOutcomes?, jurisdiction? }
```

## Pipeline (11 steps)
1. **schema validation** — bad input is `reject`ed, not crashed.
2. **untrusted-content boundary** — output tagged `{channel:"data", executed:false, note:"EXTERNAL CONTENT — NEVER EXECUTE AS INSTRUCTION"}`.
3. **prompt-injection detection / quarantine** — scans output *and* every retrieved source ("ignore previous instructions", "you are now", `<|system|>`, "run the following command", exfiltration…).
4. **claim extraction** — caller-supplied `claims[]`, else sentence segmentation.
5. **citation-requirement detection** — a claim asserting a regulatory reference or a quantitative threshold requires a citation; opinions don't.
6. **citation resolution** — via the citation registry (`normalizeCitation`).
7. **source-support verification** — a resolved citation must be grounded in a provided source.
8. **policy mapping** — ECOA §701 direct-mention scan on the prose (`proxy-detector`).
9. **disparity / fairness** — AIR when `groupOutcomes` provided.
10. **abstain / escalate decision**.
11. **evidence sealing** — a Claim–Evidence Graph + deterministic `sealed_sha256`.

## Per-claim status — the core rule
A **format-valid citation does not pass**. Each claim resolves to exactly one of:

| status | meaning |
|---|---|
| `SUPPORTED` | citation resolves, is current, **and** is grounded in a provided source |
| `PARTIAL` | resolves + current but **not** grounded in any provided source (or a non-factual claim) |
| `UNSUPPORTED` | a factual/quantitative claim with **no** citation |
| `STALE` | cites a superseded/expired reference (e.g. SR 11-7 after 2026-04-17) |
| `UNRESOLVED` | citation-shaped but the registry can't resolve it |

## Decision
- `reject` — schema invalid.
- `escalate` — injection quarantined, ECOA proxy mention, any `UNSUPPORTED` or `STALE`.
- `abstain` — any `UNRESOLVED` (can't verify).
- `seal` — all claims supported/acknowledged; sealed into the graph.

`overall` is the worst claim status (or `UNSUPPORTED` if quarantined). The result seals into a
`shadow-claim-evidence-graph/1.0` graph (see `CLAIM_EVIDENCE_GRAPH.md`) so the same fact source
drives the Unity arc, Flow, and the verifier. Honest scope: SR 26-2 currently carves generative/
agentic AI *out* of model-risk guidance — Shadow is an independent evidence layer filling that
gap, not a claim that regulation already mandates this.
