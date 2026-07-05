# Case studies

Realistic scenarios showing Shadow's council + supporting controls firing end-to-end on synthetic loan applications. For bank procurement teams that want to see the flow, not just the feature matrix.

Every case study includes:

- The full input JSON the underwriter would send
- The full response JSON Shadow returns
- Line-by-line reading: which voice escalated / approved / blocked and WHY (with regulatory citations)
- The auditor's independent verification step (public verifier CLI output)
- What the underwriter does next

## Available

| # | Case | Verdict | Distinguishing feature |
|---|---|---|---|
| 1 | [$2.5M CRE loan with PEP owner + diverse routing](./01-cre-loan-with-pep-and-diverse-routing.md) | `escalate` | AML/KYC + Compliance + Contrarian all fire; diverse routing across Anthropic + GLM + local; Ed25519 verifier demo |

## On the roadmap

- Case 2 — First-time HELOC, low FICO, Rawlsian-min protection: showing how Credit Fundamentals' hard block on FICO<700 vetoes even a confident approval from other voices
- Case 3 — OFAC SDN hit on a small-business loan: showing the AML/KYC block-tier path (verdict = `block`, not `escalate`)
- Case 4 — Approve-with-warnings on a clean loan that still gets Macro Contrarian dissent: showing that dissent doesn't force escalate

Contributions welcome. Follow the pattern in case 1.
