# Case studies

Realistic scenarios showing Shadow's council + supporting controls firing end-to-end on synthetic loan applications. For bank procurement teams that want to see the flow, not just the feature matrix.

Every case study includes:

- The full input JSON the underwriter would send
- The full response JSON Shadow returns
- Line-by-line reading: which voice escalated / approved / blocked and WHY (with regulatory citations)
- The auditor's independent verification step (public verifier CLI output)
- What the underwriter does next

## Available — full 4-case verdict lattice

| # | Case | Verdict | Distinguishing feature |
|---|---|---|---|
| 1 | [$2.5M CRE loan with PEP owner + diverse routing](./01-cre-loan-with-pep-and-diverse-routing.md) | `escalate` | AML/KYC-escalate + Compliance-flag + CRE Contrarian; diverse routing across Anthropic + GLM + local; Ed25519 verifier demo |
| 2 | [First-time HELOC, FICO 640, hard-block by Credit Fundamentals](./02-heloc-fico-hard-block.md) | `block` | FICO<700 non-negotiable policy floor beats 4 approving voices at combined weight ~3× the blocker |
| 3 | [SBA loan, OFAC SDN hit, AML/KYC block](./03-sba-loan-ofac-sanctions-block.md) | `block` | OFAC block-tier flag beats 5 approving voices; borrower-facing text kept general (tipping-off compliance) |
| 4 | [Clean auto loan, Macro Contrarian dissents, still approve](./04-clean-auto-loan-with-macro-dissent.md) | `approve` | Dissent ≠ escalate; Contrarian preserves counter-narrative in audit trail without gatekeeping |

Together these cover the full verdict lattice (approve + escalate + block × 2 distinct block paths). Every branch in `lib/run-loan-council.js + lib/confidence-weighted-verdict.js + lib/aml-kyc-voice.js` is covered by a documented realistic scenario.

## Contributing

Follow the pattern in case 1. Structure: borrower profile table → JSON request → JSON response → line-by-line reading with regulatory citations → auditor verification step → what the underwriter does next → refs.
