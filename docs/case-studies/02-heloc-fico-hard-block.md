# Case study — First-time HELOC, FICO 640, hard-block by Credit Fundamentals

**Scenario:** A regional bank runs a HELOC application through Shadow's 5-voice council. The borrower's guarantor FICO is 640 — below Lora Levitchi's non-negotiable 700 policy floor per her 2026-06-19 binding decision. Result: **block**, despite two other voices being willing to approve. Shows the FICO<700 hard block in action.

Synthetic scenario for illustration.

## The borrower

| Field | Value |
|---|---|
| Product | Home equity line of credit |
| Loan amount | $85,000 (equivalent draw ceiling) |
| Collateral | Owner-occupied SFR, Bakersfield CA |
| Sector | consumer_secured |
| Credit score | **640** |
| DTI | 0.29 |
| LTV | 0.62 (well within 0.80 ceiling) |
| Portfolio VaR (95% / 10d) | 0.06 |
| KYC status | not set (AML/KYC voice does not attach) |
| Fair-lending review flag | false |

The borrower has a good LTV, moderate DTI, and no fair-lending flag. Only the credit score fails.

## The call

```json
POST /api/loan-council
{
  "loan": {
    "loan_id": "L-2026-07-1109",
    "credit_score": 640,
    "debt_to_income": 0.29,
    "loan_to_value": 0.62,
    "amount": 85000,
    "sector": "consumer_secured",
    "market_proxy_prices": [100, 99, 101, 98, 100, 99, 101],
    "fair_lending_review_flag": false,
    "adverse_action_reasons": []
  }
}
```

No `aml_flags` / `kyc_status` fields → the AML/KYC Investigator voice does NOT attach. Council runs 5 voices.

## The response

Shadow returns in ~2ms (pure-compute path — no LLM invoked):

```json
{
  "final_verdict": "block",
  "confidence_weighted_verdict": "block",
  "aggregated_score": -1.0,
  "voice_contributions": [
    {"voice": "Credit Fundamentals",     "weight": 1.10, "confidence": 0.95, "score": -1.0},
    {"voice": "Risk Officer",            "weight": 1.00, "confidence": 0.81, "score":  1.0},
    {"voice": "Fair Lending Compliance", "weight": 1.20, "confidence": 0.91, "score":  1.0},
    {"voice": "Customer Advocate",       "weight": 0.85, "confidence": 0.74, "score":  1.0},
    {"voice": "Macro Contrarian",        "weight": 0.85, "confidence": 0.71, "score":  1.0}
  ],
  "voices": [
    {
      "voice": "Credit Fundamentals",
      "verdict": "block",
      "confidence": 0.95,
      "rationale": "FICO 640 below 700 floor per Addendum A. This is the credit-eligibility floor per Lora Levitchi's 2026-06-19 policy clarification — failing FICO returns block, not escalate. DTI 0.29 within 0.36 ceiling per Addendum B (not the issue).",
      "adverse_action_codes": [{"code": "AA01", "label": "Insufficient credit score", "source": "Addendum A"}]
    },
    {
      "voice": "Risk Officer",
      "verdict": "approve",
      "confidence": 0.81,
      "rationale": "LTV 0.62 well within 0.80 ceiling per Addendum C. VaR 95%/10d = 0.06 well within 0.12 ceiling; risk_budget_status: within_budget.",
      "adverse_action_codes": []
    },
    {
      "voice": "Fair Lending Compliance",
      "verdict": "approve",
      "confidence": 0.91,
      "rationale": "fair_lending_review_flag not set; ECOA/Reg B adverse-action and disparate-impact checks completed.",
      "adverse_action_codes": []
    },
    {
      "voice": "Customer Advocate",
      "verdict": "approve",
      "confidence": 0.74,
      "rationale": "adverse_action_reasons list empty; explanation quality not applicable.",
      "adverse_action_codes": []
    },
    {
      "voice": "Macro Contrarian",
      "verdict": "approve",
      "confidence": 0.71,
      "rationale": "sector=consumer_secured; macro stress within tolerance for owner-occupied SFR collateral.",
      "adverse_action_codes": []
    }
  ],
  "adverse_action_codes": [
    {"code": "AA01", "label": "Insufficient credit score for standard approval threshold", "source": "Addendum A"}
  ],
  "reason_code_dictionary_check": {"ok": true, "invalid": [], "reason": "all codes in dictionary"},
  "protected_class_proxy_check": {"ok": true, "prohibited": [], "reason": "no protected proxies cited"},
  "presentation_order": [0, 2, 4, 1, 3],
  "risk_packet": {"var_95_10d": 0.06, "risk_budget_status": "within_budget"},
  "thresholds_applied": {
    "fico_floor": 700,
    "dti_ceiling": 0.36,
    "ltv_ceiling": 0.80,
    "var_ceiling": 0.12
  },
  "attestation": { "mode": "ed25519", "signature": "…", "..." }
}
```

## Reading the response

### The block-veto path fires immediately

Look at the `voice_contributions`: 4 of 5 voices approve at solid confidence (0.71–0.91). Only Credit Fundamentals blocks. **The block-veto path in `computeConfidenceWeightedVerdict` short-circuits to `block` regardless of how the other 4 voices weight.**

From `lib/confidence-weighted-verdict.js`:

```javascript
// Safety-in-depth: if any voice says block, the weighted verdict
// MUST also say block. Compliance/Credit hard floors are not
// negotiable — you cannot outvote a policy floor via confidence.
const anyBlock = voices.some((v) => v.verdict === "block");
if (anyBlock) {
  return { confidence_weighted_verdict: "block", ..., any_block: true };
}
```

The 4 approve voices carry combined weighted score `(1.00 × 0.81) + (1.20 × 0.91) + (0.85 × 0.74) + (0.85 × 0.71) = 3.13`. Credit Fundamentals' block carries `1.10 × 0.95 = 1.045`. The 4 approving voices out-mass the blocker by ~3× — and they still lose.

This is by design. FICO<700 is Lora's non-negotiable policy floor per her 2026-06-19 binding decision. You cannot outvote a policy floor via confidence math. If you could, someone could ship a Shadow deployment with a "high confidence approve" override and quietly weaken the credit floor.

### The rationale cites the specific policy source

Credit Fundamentals' rationale reads:

> "FICO 640 below 700 floor per Addendum A. This is the credit-eligibility floor per Lora Levitchi's 2026-06-19 policy clarification — failing FICO returns block, not escalate. DTI 0.29 within 0.36 ceiling per Addendum B (not the issue)."

Notice:

1. **Specific threshold cited** (700 floor)
2. **Source document cited** (Addendum A)
3. **Explicit call-out that block ≠ escalate** here — this isn't a threshold you can escalate around
4. **Clarifies DTI is fine** — so the borrower / underwriter know exactly which field is disqualifying

CFPB Circular 2022-03's "model complexity is not a defense" is satisfied by this rationale. If the borrower asks "why was I denied?", the answer is a specific number against a specific policy document, not a template phrase.

### AA01 flows into adverse_action_codes

The bank's adverse-action notice writes itself:

> "Your application was declined because: **Credit score of 640 is below the eligibility floor of 700 required for standard approval per Addendum A — Credit Policy. This includes both new borrower scores and any recent updates to the primary credit reference.** — AA01"

The borrower-readable text comes DIRECTLY from `lib/schemas/reason-code-dictionary.json`. Bank counsel signed that dictionary at deploy time.

### The 4 approving voices matter

They're not decorative. Their rationale gets persisted so the audit trail records:

- Risk Officer: "LTV 0.62 well within 0.80 ceiling" — no additional risk denial
- Fair Lending Compliance: "flag not set" — no fair-lending denial
- Macro Contrarian: "macro stress within tolerance" — no cycle risk denial

If the borrower appeals or files an ECOA complaint, the audit trail proves that Shadow considered these dimensions and found them acceptable. The denial is narrowly on FICO — nowhere else.

## What this case study demonstrates

- **The FICO<700 hard block is real.** It cannot be softened by 4 approving voices at high confidence. This is the whole point of Lora's binding decision.
- **The confidence-weighted aggregator has a safety-in-depth layer.** It doesn't just weight votes — it respects policy floors first.
- **Adverse-action notices are auto-generated** from the signed reason-code dictionary. No template phrases. CFPB-compliant by construction.
- **The audit trail records the WHOLE deliberation**, not just the block. Post-hoc appeal / regulator inspection gets the full picture.

## Refs

- `lib/run-loan-council.js` — FICO threshold check + block emission
- `lib/schemas/loan.js LOAN_DEFAULTS.fico_approve_floor` — the 700 constant
- `lib/confidence-weighted-verdict.js` — safety-in-depth block short-circuit
- `lib/schemas/reason-code-dictionary.json` — AA01 borrower-readable text
- brain `lora_2026_06_19_confirmations.md` — the binding policy decision
- Case 1: [$2.5M CRE loan with PEP owner + diverse routing](./01-cre-loan-with-pep-and-diverse-routing.md) (escalate path)
- Case 3: OFAC SDN hit (block path via AML/KYC)
- Case 4: Clean approve with Contrarian dissent (approve-with-warning path)
