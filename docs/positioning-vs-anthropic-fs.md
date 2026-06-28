# Shadow vs Anthropic Financial Services Agents — Positioning

> **What changed (2026-05-05).** Anthropic announced pre-built Financial Services agent templates (pitchbooks, KYC, month-end close), Moody's embedded as a native Claude app, and a $1.5B Goldman / Blackstone / H&F vehicle. Claude Opus 4.7 is now positioned as the "Wall Street model."
>
> **Why this doc exists.** The 30-bank pipeline buyer will Google "Anthropic financial agents" before signing. Shadow needs a clear "not-Anthropic" wedge that's defensible by an examiner, not a marketer.

## Three-row positioning

| Axis | Anthropic FS Agents | Shadow |
|---|---|---|
| **Source visibility** | Closed templates; prompts not auditable. The model is the policy. | MIT license. `lib/run-loan-council.js` + `lib/traceability.js` readable by any examiner. The code is the technical file (EU AI Act Article 13). |
| **Deployment** | Cloud-only, Anthropic API. Loan applicant data leaves your VPC. | Pure compute. `enforceAnalysisOnly()` regex runs at the council output boundary. Can run on-prem; no LLM call inside the tool body. |
| **Governance attribution** | One narrative response, no traceability dictionary. Examiner gets prose. | Inline `traceability` dict in every `/api/deliberate` response, mapping each threshold to its correct governance layer (BRD / Addenda / Risk Appetite Note / Regulatory) — the **BRD vs. Addenda Source Separation Principle** named by Loredana C. Levitchi, IEEE VR/VIS 2027 co-first-author. |

## What we don't pretend to compete on

- **Data depth.** Anthropic + Moody's gets you 600M company records native. Shadow has 30 mid-tier bank pipeline targets; we are not a data vendor.
- **Brand.** Anthropic ships with Goldman / Blackstone validation. Shadow ships with Loredana Levitchi (14 years global banking software) + a forthcoming IEEE VR/VIS 2027 paper. Different validators, different rooms.
- **Pitchbook automation.** Out of scope; Shadow is loan-origination compliance.

## What we win on

1. **Schema-layer safety** — see [`principles/schema-layer-safety.md`](./principles/schema-layer-safety.md). Anthropic's templates return narrative; Shadow returns strict-JSON enum verdicts (block / approve / escalate) with `rationale_short < 500 chars` and a 12-pattern regex guardrail catching trade-execution hallucinations at the council boundary. Hebbia / Anthropic cannot grep their own safety into the codebase; Shadow procurement can grep `lib/audit-guardrail.js`.
2. **Determinism floor** — see [`principles/determinism-floor.md`](./principles/determinism-floor.md). FICO < 700 is a hardcoded JS conditional with a pinned test (`test/loan-policy.test.js`). AA01–AA05 codes emit from `lib/schemas/adverse-action.js` with `AA_SOURCES` attribution. Examiner can read 8 lines of code, not 80 pages of MRM documentation.
3. **Multi-provider, mainland-friendly** — Shadow routes Anthropic / OpenAI / GLM (Zhipu, for Mainland China mid-tier banks where Anthropic is unavailable). Anthropic FS templates are Anthropic-only.
4. **Procurement-defensible cost** — Anthropic enterprise contracts price in 6 figures. Shadow seat target is **$1,800 / year per compliance officer**. The wedge for mid-tier banks (Raymond James, Stifel, LPL) that can't afford Hebbia / Anthropic at scale.

### Multi-provider isn't sales copy — own-dogfood evidence (2026-06-28)

On 2026-06-28 we hit our own Anthropic monthly usage cap mid-day. Two production systems immediately surfaced the failure:

- **Shadow's OCR live-smoke suite** failed on a `400 invalid_request_error: You have reached your specified API usage limits. You will regain access on 2026-07-01 at 00:00 UTC.` ([commit `beb5602`](https://github.com/alex-jb/shadow-mentor/commit/beb5602)).
- **Our internal daily-brief distill cron** produced an `[ERROR] anthropic call failed (non-billing)` stub because its envelope matcher only knew the older "credit balance too low" wording, not the new "usage limits" wording ([alex-brain commit `2d12937`](https://github.com/alex-jb/alex-brain/commit/2d12937)).

Both were patched within hours by treating envelope errors as graceful fallbacks. The point for procurement: a single-provider deployment hits the same wall on the same day, but a bank running on Shadow's multi-provider router with the GLM-5.2 fallback ([`lib/glm-call.js`](../lib/glm-call.js) + [`test/glm-call.test.js`](../test/glm-call.test.js) 12 contract tests) keeps approving loans while Anthropic resets. This is not "we believe multi-provider matters" — this is "we got the bill on 6/28, and the bank wouldn't have."

Anthropic FS templates are Anthropic-only by construction. Shadow is provider-agnostic by construction. The difference shows up on the day you actually need it.

## The buyer's mental model

Anthropic FS Agents and Hebbia own the **research seat** at $10K+ / year. Shadow owns the **compliance officer seat at $1,800 / year**. Pitch is *complementary*, not replacement:

> "Your Hebbia / Anthropic analyst writes the memo. Shadow's 5-voice council renders the binding verdict your examiner can audit in JSON."

## References

- [Anthropic Financial Services Agents (2026-05-05)](https://www.anthropic.com/news/finance-agents)
- [Anthropic + Goldman / Blackstone / H&F $1.5B vehicle (Fortune, 2026-05-05)](https://fortune.com/2026/05/05/anthropic-wall-street-financial-services-agents-jamie-dimon/)
- [Hebbia 2026 pricing — Sacra](https://sacra.com/c/hebbia/)
- [BRD vs. Addenda Source Separation Principle — Levitchi 2026](./principles/source-separation.md) *(forthcoming)*
