# External — Source documents authored by Loredana C. Levitchi

These documents are the authoritative source of the loan-origination
policy thresholds, risk-appetite calibration parameters, traceability
matrix, and architectural framing wired into Shadow v1.1.0+.

License: MIT, per explicit grant 2026-06-19 from the author.

| File | Authority |
|---|---|
| `BRD_ALIGNMENT.md` | Institutional risk framework (BRD-derived) |
| `ADDENDUM_A_CREDIT_POLICY.md` | Product-line policy — FICO ≥ 700 + AA01 |
| `ADDENDUM_B_DTI_POLICY.md` | Product-line policy — DTI ≤ 0.36 + AA02 |
| `ADDENDUM_C_LTV_AND_RISK_APPETITE.md` | Product-line policy — LTV ≤ 0.80 + Risk Appetite Note (VaR ≤ 0.12 calibration parameter) + AA03 + AA04 |
| `TRACEABILITY_MATRIX.md` | Benchmark-rule → source-document mapping |
| `IMPLEMENTATION_GUIDE.md` | Step-by-step Mode A integration runbook |
| `TECHNICAL_REPORT.docx` + `.pdf` | Mode A architectural design + governance |

## Authorship and license

- **Primary author of risk, credit-policy, threshold, adverse-action, and
  traceability modules**: Loredana C. Levitchi
- **Integration maintainer**: Alex Xiaoyu Ji
- **License**: MIT
- **Source basis**: Orallexa Mode A BRD + Addenda A/B/C + Risk Appetite Note

These documents are versioned and shipped with the repository so any
audit can verify Shadow's policy semantics against the authoritative
source without separate retrieval.

## Policy semantics (preserved verbatim from author's 2026-06-19 confirmation)

- FICO < 700 → **block** (credit-eligibility floor failure is a hard
  block, not escalate)
- DTI > 0.36 → escalate (repayment-capacity signal; human review may
  resolve via compensating factors or income verification)
- LTV > 0.80 → escalate (collateral-risk signal; mitigatable via
  stronger collateral, lower amount, guarantor, or revised structure)
- 10-day VaR > 0.12 → escalate / risk-appetite breach (Addendum C
  calibration parameter, not BRD-derived)
- All outputs remain **analysis-only** (no broker, order, trade, or
  execution path)

Wired into `lib/run-loan-council.js` and enforced in
`test/run-loan-council.test.js` + `test/traceability-and-guardrail.test.js`.

## How to cite

Internal: cite Addendum A/B/C as the source for policy thresholds and
`BRD_ALIGNMENT.md` as the source for the institutional risk framework.

External: cite the Tech Report (Sections 1-3 and the Traceability Matrix
in particular) for the BRD vs Addenda Source Separation Principle —
the named contribution of the IEEE VR / VIS 2027 abstract draft.
