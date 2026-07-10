# Shadow architecture

**Status**: authoritative as of v2.0.0-rc1 (2026-07-10).

This document resolves the earlier README contradiction between "pure-compute verdicts" and "5-persona LLM council." The correct description of what Shadow actually ships is a two-layer design.

## Two layers

```
                     ┌────────────────────────────────────┐
    Loan JSON  ──▶   │      Layer 1 — Verdict engine       │  ──▶  verdict
                     │  Deterministic rules, no LLM call.   │       (refuse_to_serve
                     │  lib/run-loan-council.js             │        / block
                     │  Reproducible bit-for-bit.           │        / escalate
                     │  This is what the attestation binds. │        / approve)
                     └────────────────────────────────────┘
                                     │
                                     │  (advisory only)
                                     ▼
                     ┌────────────────────────────────────┐
                     │      Layer 2 — Rationale layer      │  ──▶  prose rationale,
                     │  5 LLM personas, prompted separately.│       one per persona,
                     │  api/deliberate.js                   │       for the human
                     │  Cannot change the verdict — it has   │       reviewer / AA
                     │  already been computed.              │       notice narrative.
                     └────────────────────────────────────┘
                                     │
                                     ▼
                     ┌────────────────────────────────────┐
                     │      Layer 3 — Attestation          │  ──▶  Ed25519-signed
                     │  Signs verdict + input commitment + │       decision +
                     │  output commitment + hash chain +   │       hash chain link.
                     │  optional bindings.                  │
                     │  lib/attestation.js                  │
                     └────────────────────────────────────┘
```

## Layer 1 — Verdict engine (deterministic)

**File**: `lib/run-loan-council.js`.

The verdict engine reads the normalized loan (`credit_score`, `debt_to_income`, `loan_to_value`, `amount`, `sector`, optional `market_proxy_prices` / `collateral_positions` / `borrower_exposure_weights`) and produces exactly one of `refuse_to_serve`, `block`, `escalate`, or `approve`.

The five persona voices in the return payload — Credit Fundamentals, Risk Officer, Fair Lending Compliance, Customer Advocate, Macro Contrarian — are also deterministic rule outputs at this layer. Each voice returns a `verdict` field derived from thresholds (FICO floor, DTI ceiling, LTV ceiling, VaR ceiling, sector regime). The final verdict is the aggregation of the voice verdicts via a documented priority order (`refuse_to_serve > block > escalate > approve`).

**No LLM call is made inside this layer.** Given the same input, it returns bit-identical output. This is what makes the attestation meaningful — a signed hash of an unreproducible computation would prove nothing to a later auditor.

## Layer 2 — Rationale layer (LLM-backed, advisory)

**File**: `api/deliberate.js` + `lib/prompts.js`.

`/api/deliberate` calls the verdict engine first, then optionally calls an LLM (Anthropic Sonnet 4.6 by default; OpenAI-compatible and GLM providers configurable) to generate prose rationale text for each persona voice. The five prose blocks are shipped back to the caller alongside the verdict.

The rationale layer is a **product choice**, not a regulatory requirement. Regulation B §1002.9 requires **specific principal reasons**, not multi-perspective narratives. Shadow's five voices exist because (a) an internal-audit workpaper reader benefits from multiple angles on the same decision, (b) the adverse-action notice drafter has more raw material to work from, and (c) it makes the reason-code selection more defensible when a state examiner asks "why this code and not that one." None of these are legal mandates.

The rationale layer **cannot change the verdict**. By construction, the verdict has already been computed before the rationale layer runs. A rationale-layer LLM cannot promote an `escalate` to an `approve` or vice versa. If a caller wants a different verdict, they must change the input, not the rationale.

## Layer 3 — Attestation (Ed25519)

**File**: `lib/attestation.js`.

Every decision is signed with Ed25519 over a canonical serialization of:

- Attestation spec version
- Signing mode (HMAC or Ed25519)
- Input commitment (SHA-256 of canonicalized request)
- Output commitment (SHA-256 of canonicalized response)
- Model ID (`claude-sonnet-4-6`, etc.)
- Completion timestamp
- Previous hash (chain link)
- Key ID

Plus 14 optional append-only bindings, each conditionally included when the caller supplies them (dictionary hash, reproducibility manifest, sampling-seed commitment, heterogeneity commitment, typed-claim envelope hash, calibration-ranking split hash, and others). Old attestations verify against new verifier code because bindings are appended, not inserted or reordered.

The attestation binds **the entire response** — verdict, per-persona voice output, and prose rationale. If any byte of the response is altered post-sign, verification fails. The heterogeneity commitment and sampling-seed commitment attest properties of the **rationale layer only**, since only the rationale layer has heterogeneity and sampling-seed properties to attest.

## `/api/loan-council` vs `/api/deliberate`

| | `/api/loan-council` | `/api/deliberate` |
|---|---|---|
| Verdict | Yes | Yes (identical to `/api/loan-council` for the same input) |
| Rationale prose | No | Yes (5 persona blocks) |
| LLM call inside handler | No | Yes |
| On-device / VPC executable | Yes | Only if the LLM provider is on-device / in-VPC |
| Attestation | Yes | Yes |
| Deterministic across runs | Yes | Verdict yes; rationale text no |
| Cost per call | ~$0 (compute only) | LLM cost + compute |
| Latency (p95) | Sub-10ms | Depends on LLM provider (typically 2–10 sec) |

Callers who need the audit-evidence property but not the prose rationale should call `/api/loan-council`. Callers who need both should call `/api/deliberate`.

## What the attestation proves and does not prove

Proves:
- The response bytes were signed by the holder of the private key at the recorded timestamp.
- The response has not been altered post-sign.
- The chain has not been reordered, insertions have not occurred between two attested points, and truncation of the head is detectable if the caller retains any newer entry.
- If dictionary binding was used, the reason-code dictionary the lender was operating under at the time of the decision has a matching hash.

Does not prove:
- That the verdict was correct.
- That the input was truthful.
- That the LLM rationale is factually accurate.
- That the bank did not re-sign the chain with the same private key at a later date. This is the "insider at the bank" adversary. Defeating this requires an external timestamp anchor — RFC 3161 TSA or an append-only public log (Sigstore Rekor, for example). Neither is currently wired into Shadow. See v2.1 roadmap.

## What is not part of this architecture

- Shadow does not include a loan origination system, credit models, or underwriter workflow. A bank deciding a real loan uses those upstream and passes the resulting decision through Shadow for attestation.
- Shadow does not include a fair-lending validator for its own rationale layer. Persona prompt wording can influence prose outputs, and disparate-treatment risk enters through prompt design. The rationale layer needs its own fair-lending validation before production use in a regulated context.
- Shadow does not host or manage the private signing key. Key management, rotation, and hardware-security-module integration are the operator's responsibility.

## References

- `lib/run-loan-council.js` — verdict engine
- `lib/prompts.js` — persona prompt catalog
- `api/deliberate.js` — rationale layer HTTP handler
- `lib/attestation.js` — Ed25519 signing + verification
- `docs/THREAT_MODEL.md` — threat classes and coverage
- `docs/SIVE_BASELINE_FINDINGS.md` — response-function characterization
