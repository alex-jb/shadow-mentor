# Case study — Small-business loan, OFAC SDN hit, hard-block by AML/KYC

**Scenario:** A community bank runs a $175K SBA loan application through Shadow's 6-voice council. The applicant's beneficial owner matches the OFAC Specially Designated Nationals (SDN) list. Result: **block**, per USA PATRIOT Act §326 CIP + OFAC regulations. Shows the AML/KYC block-tier path (not just escalate).

Synthetic scenario for illustration.

## The borrower

| Field | Value |
|---|---|
| Product | SBA 7(a) working capital loan |
| Loan amount | $175,000 |
| Applicant type | LLC (single-member) |
| Beneficial owner | Individual with name + DOB match against OFAC SDN list |
| Credit score (guarantor) | 735 |
| DTI | 0.31 |
| LTV | N/A (unsecured working capital) |
| Sector | small_business_services |
| KYC status | current (customer identity verified) |
| AML flags | **sanctions_hit** |

Notably: the guarantor's credit is FINE. FICO 735 > 700 floor. DTI 0.31 < 0.36 ceiling. The applicant went through CIP successfully — kyc_status is `current`, not `not_verified`. But the OFAC SDN screening returns a match on the beneficial owner. That's a HARD BLOCK per BSA + OFAC regulations, regardless of credit quality.

## The call

```json
POST /api/loan-council
{
  "loan": {
    "loan_id": "L-2026-07-1247",
    "credit_score": 735,
    "debt_to_income": 0.31,
    "loan_to_value": 0.05,
    "amount": 175000,
    "sector": "small_business_services",
    "market_proxy_prices": [100, 99, 101, 100, 98, 99, 100],
    "aml_flags": ["sanctions_hit"],
    "kyc_status": "current",
    "fair_lending_review_flag": false,
    "adverse_action_reasons": []
  }
}
```

The `aml_flags: ["sanctions_hit"]` field triggers the AML/KYC Investigator voice (6th voice attaches).

## The response

```json
{
  "final_verdict": "block",
  "confidence_weighted_verdict": "block",
  "aggregated_score": -1.0,
  "voice_contributions": [
    {"voice": "Credit Fundamentals",     "weight": 1.10, "confidence": 0.88, "score":  1.0},
    {"voice": "Risk Officer",            "weight": 1.00, "confidence": 0.79, "score":  1.0},
    {"voice": "Fair Lending Compliance", "weight": 1.20, "confidence": 0.91, "score":  1.0},
    {"voice": "Customer Advocate",       "weight": 0.85, "confidence": 0.74, "score":  1.0},
    {"voice": "Macro Contrarian",        "weight": 0.85, "confidence": 0.68, "score":  1.0},
    {"voice": "AML/KYC Investigator",    "weight": 1.20, "confidence": 0.95, "score": -1.0}
  ],
  "voices": [
    {
      "voice": "Credit Fundamentals",
      "verdict": "approve",
      "confidence": 0.88,
      "rationale": "FICO 735 exceeds 700 floor per Addendum A. DTI 0.31 within 0.36 ceiling per Addendum B."
    },
    {
      "voice": "Risk Officer",
      "verdict": "approve",
      "confidence": 0.79,
      "rationale": "Small-dollar unsecured — VaR envelope not stressed. risk_budget_status: within_budget."
    },
    {
      "voice": "Fair Lending Compliance",
      "verdict": "approve",
      "confidence": 0.91,
      "rationale": "fair_lending_review_flag not set; no adverse-action reasons."
    },
    {
      "voice": "Customer Advocate",
      "verdict": "approve",
      "confidence": 0.74,
      "rationale": "adverse_action_reasons list empty."
    },
    {
      "voice": "Macro Contrarian",
      "verdict": "approve",
      "confidence": 0.68,
      "rationale": "sector=small_business_services; macro stress within tolerance."
    },
    {
      "voice": "AML/KYC Investigator",
      "verdict": "block",
      "confidence": 0.95,
      "rationale": "1 AML/KYC finding(s): OFAC SDN list match. Applicant matches an OFAC-published sanctioned party (SDN or 50%-rule aggregate ownership); origination is prohibited. See adverse-action codes + reason-code dictionary for borrower-readable text.",
      "adverse_action_codes": [{"code": "AA06", "label": "AML/KYC-related eligibility concern requiring compliance review", "source": "BSA / USA PATRIOT / FinCEN CDD / OFAC"}]
    }
  ],
  "adverse_action_codes": [
    {"code": "AA06", "label": "AML/KYC-related eligibility concern requiring compliance review", "source": "BSA / USA PATRIOT / FinCEN CDD / OFAC"}
  ],
  "reason_code_dictionary_check": {"ok": true, "invalid": [], "reason": "all codes in dictionary"},
  "protected_class_proxy_check": {"ok": true, "prohibited": [], "reason": "no protected proxies cited"},
  "presentation_order": [5, 0, 2, 1, 4, 3],
  "thresholds_applied": { "fico_floor": 700, "dti_ceiling": 0.36, "..." },
  "attestation": { "mode": "ed25519", "signature": "…", "..." }
}
```

## Reading the response

### 5 voices say approve. One voice says block. Block wins.

Same safety-in-depth pattern as case 2: the `computeConfidenceWeightedVerdict` short-circuits to block regardless of the aggregation math because ONE voice with block authority said block. But here it's the AML/KYC Investigator, not Credit Fundamentals.

The AML/KYC voice's block authority is grounded in **OFAC regulations + BSA**, not policy preference. OFAC hits are legally binding: originating a loan to a Specially Designated National is a federal offense regardless of any commercial or credit merit. Shadow encoding this as a policy-floor block (not a confidence-weighted signal) matches the legal reality.

From `lib/aml-kyc-voice.js AML_FLAG_POLICY`:

```javascript
sanctions_hit: {
  tier: "block",
  citation: "OFAC SDN list match",
  rationale: "Applicant matches an OFAC-published sanctioned party " +
    "(SDN or 50%-rule aggregate ownership); origination is prohibited.",
},
```

The `tier: "block"` here is the load-bearing bit. Every other AML flag in the table (`structuring`, `pep`, `high_risk_country`, `beneficial_ownership_opaque`, `gto_metro`) is tier `escalate`. OFAC hits and unverified CIP are the ONLY two block-tier flags. That distinction matches real-world regulatory hierarchy.

### The other 5 voices' approves are NOT lost — they're persisted

The audit trail records:

- Credit was fine (FICO 735 clear)
- Risk was fine (small-dollar unsecured, no VaR issue)
- Compliance was fine (no fair-lending flag)
- Advocate was fine (no AA reasons to review)
- Contrarian was fine (sector within tolerance)

This matters. If regulators later ask "did Shadow deny this loan because of OFAC or because of some other pretext?", the audit trail proves it was OFAC, and only OFAC. Every other dimension approved.

### AA06 is the borrower-facing code

The signed reason-code dictionary borrower-readable text at `lib/schemas/reason-code-dictionary.json`:

> "An anti-money-laundering, sanctions, or customer-identification compliance concern requires additional review. This includes screening under the Bank Secrecy Act, OFAC sanctions, USA PATRIOT Act §326 Customer Identification Program, and FinCEN Customer Due Diligence requirements. This is a regulatory eligibility concern, not a merit-based denial."

Notably, this text does NOT tell the borrower the specific reason (OFAC SDN hit). That's intentional — telling a sanctioned party WHY they were flagged is a tipping-off violation. The borrower gets the general category ("regulatory compliance concern"); the SPECIFIC citation stays in Shadow's audit trail for regulators, not the borrower.

The bank's compliance team follows up separately per SAR / OFAC reporting SOP.

## What this case study demonstrates

- **AML/KYC block-tier is real.** OFAC + unverified CIP get the hard-block treatment. Structuring / PEP / high-risk-country get escalate. The tier hierarchy matches actual regulatory severity.
- **Block wins over 5 approving voices.** Same safety-in-depth pattern as FICO<700, but grounded in different regulations.
- **The borrower-facing text is deliberately general.** Specific OFAC citations stay in the audit trail, not the notice — this is a tipping-off compliance requirement.
- **The audit trail persists ALL voices' verdicts.** Regulators can verify the denial was OFAC-specific, not pretext.

## Refs

- `lib/aml-kyc-voice.js AML_FLAG_POLICY.sanctions_hit` — the block-tier row
- `lib/schemas/reason-code-dictionary.json` AA06 — the borrower-readable text
- `lib/confidence-weighted-verdict.js` — safety-in-depth block short-circuit
- OFAC Specially Designated Nationals list (OFAC.gov)
- Bank Secrecy Act 31 USC 5311 + 5322 + 5324
- USA PATRIOT Act §326 (CIP)
- Case 1: [PEP + high-risk-country escalate path](./01-cre-loan-with-pep-and-diverse-routing.md)
- Case 2: [FICO<700 hard block](./02-heloc-fico-hard-block.md)
- Case 4: Clean approve with Contrarian dissent (approve-with-warning path)
