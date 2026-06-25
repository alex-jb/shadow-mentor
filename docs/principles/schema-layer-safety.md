# Schema-Layer Safety

> A named procurement-defensibility pattern. The safety guarantee lives in the response schema, not in the model's behavior.

## The pattern

Tools that return narrative ("the loan looks risky because…") cannot be unit-tested for safety. A model that emits free text can be jailbroken into emitting a trade-execution verb, a policy-attribution lie, or a leaked system-prompt fragment.

Tools that return **strict-JSON enums + bounded free-text fields** can be:

1. **Validated at the response boundary** before the agent emits anything to the user.
2. **Grepped at deploy time** by procurement reviewers reading the source.
3. **Unit-tested in CI** so a regression in the prompt cannot ship.

This is what Shadow does. The safety is in the JSON schema, not in the system prompt.

## How Shadow implements it

### 1. Verdict is an enum, not free text

`shadow_loan_council` returns:

```json
{
  "final_verdict": "approve" | "escalate" | "block",
  "voices": [{ "voice_id": "credit", "verdict": "approve", ... }, ...],
  "traceability": { ... },
  "requires_human": true
}
```

A jailbroken model cannot return `"final_verdict": "execute trade"` or `"final_verdict": "ignore policy"` — the JSON parser rejects the response before it leaves the tool. This is **mechanical** narrowing of the leak surface, not behavioral.

### 2. `rationale_short` is bounded

Each voice's `rationale_short` is capped at **500 characters**. A model attempting to exfiltrate a system prompt or paste a multi-thousand-character attack payload trips the length guard.

Test: `test/run-loan-council.test.js::rationale_short respects 500 char cap`.

### 3. `enforceAnalysisOnly()` regex guardrail

`lib/audit-guardrail.js` runs a 12-pattern regex over every voice rationale at the council output boundary. Patterns block:

- Trade-execution verbs (`place_order`, `auto_approve`, `submit_to_broker`, `execute trade`, `buy <ticker>`, `sell <ticker>`, ...)
- Policy-bypass framings (`override the rule`, `ignore the threshold`, ...)
- Hallucinated authority claims (`I will execute`, `submitting now`, ...)

Match → `AnalysisOnlyViolationError` thrown. The response never reaches the model layer that would emit it. Tested by 14 contract assertions in `test/traceability-and-guardrail.test.js`.

### 4. Strict-JSON output schema

The 8 HTTP endpoints + 6 MCP tools all declare typed response schemas. A response that fails to validate against the schema is dropped by the response middleware before transit.

## What this gets you in procurement

- A bank's **examiner can grep `lib/audit-guardrail.js`** and read the 12 regex patterns. There is no hand-waving. The safety is the code.
- An EU AI Act Article 13 reviewer can point at the schema as the **technical file** — the structured constraints are the documentation.
- A risk officer running Shadow can be certain that **no prompt edit by a future contributor** can introduce a trade-execution verb without the CI failing first.

## What this does NOT replace

- Schema-layer safety does **not** prevent indirect prompt injection (IPI). IPI attacks the *interpretation* of `proposed_action` content; the JSON output schema does not see that. See [`principles/indirect-prompt-injection-defense.md`](./indirect-prompt-injection-defense.md) (forthcoming v0.3) for the canary-token Class 2 LIVE test pattern.
- It does not protect against tool-poisoning attacks on the MCP tool description itself (MCPTox / OX Security 2026). That is mitigated separately by the MCP Enterprise OAuth (EMA) attestation layer.

## Why competitors can't copy this on a roadmap

Hebbia, Anthropic FS, Quantexa, Zest AI all return narrative reports. To match Schema-Layer Safety they would have to:

1. Re-architect the response shape to strict JSON enum verdicts (multi-quarter effort)
2. Write 12+ regex patterns for trade-execution verbs (hours, but requires the verdict schema first)
3. Add CI gates preventing prompt-edit regressions
4. Publish the source so procurement can grep it

The first step alone is a product-defining refactor for them. Shadow shipped it as v1.0.

## See also

- `lib/audit-guardrail.js` — the 12-pattern regex
- `lib/run-loan-council.js` — the verdict resolver (block > escalate > approve)
- `test/traceability-and-guardrail.test.js` — 14 contract tests
- [`positioning-vs-anthropic-fs.md`](../positioning-vs-anthropic-fs.md) — the Anthropic FS comparison
- [`determinism-floor.md`](./determinism-floor.md) — the sibling pattern (deterministic threshold enforcement)
