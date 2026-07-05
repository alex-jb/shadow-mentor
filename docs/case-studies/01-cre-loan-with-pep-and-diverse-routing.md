# Case study — $2.5M CRE loan with PEP owner + diverse-routing council

**Scenario:** A regional bank underwriting a $2.5M commercial real estate loan. Underwriter runs the application through Shadow's 6-voice council with per-voice diverse routing enabled. Result: **escalate to human review** with 4 specific regulatory-rule citations. Bank auditor independently verifies the response with the public Ed25519 key.

This is a synthetic scenario for illustration. Any resemblance to real applicants is coincidental.

## The borrower

| Field | Value |
|---|---|
| Loan amount | $2,500,000 |
| Collateral | Class B office building, Newark NJ metro |
| Sector | commercial_real_estate |
| Credit score (guarantor) | 745 |
| DTI (guarantor) | 0.33 |
| LTV | 0.72 |
| Applicant type | LLC — beneficial owner is a family member of a Cyprus-based former minister |
| KYC status | current |
| Portfolio VaR (95% / 10d) | 0.09 |

## The call

The underwriter's system sends this loan to Shadow's `/api/deliberate` endpoint with `body.diverse: true` set — the bank has all 3 providers configured (Anthropic + GLM + local Ollama) for the anti-hallucination-amplification defense.

```json
POST /api/deliberate
{
  "persona": "compliance",
  "scenario": "lbo",
  "diverse": true,
  "loan": {
    "loan_id": "L-2026-07-0842",
    "credit_score": 745,
    "debt_to_income": 0.33,
    "loan_to_value": 0.72,
    "amount": 2500000,
    "sector": "commercial_real_estate",
    "market_proxy_prices": [98, 97, 99, 96, 95, 100, 98],
    "collateral_positions": [{"ticker": "OFFICE-B-NEWARK", "sector": "cre", "weight": 1.0}],
    "aml_flags": ["pep", "high_risk_country"],
    "kyc_status": "current",
    "fair_lending_review_flag": true,
    "adverse_action_reasons": []
  }
}
```

Note the 3 signals Shadow's council will consume together:
- `sector: "commercial_real_estate"` — triggers Macro Contrarian
- `aml_flags: ["pep", "high_risk_country"]` — triggers AML/KYC Investigator (6th voice attaches)
- `fair_lending_review_flag: true` — triggers Fair Lending Compliance

## The response

Shadow returns in ~1.4 seconds (100ms for the pure-compute council layer, 1.3s for 3 parallel diverse LLM calls to junior/senior/third):

```json
{
  "final_verdict": "escalate",
  "confidence_weighted_verdict": "escalate",
  "aggregated_score": -0.12,
  "voice_contributions": [
    {"voice": "Credit Fundamentals",         "weight": 1.10, "confidence": 0.88, "score":  1.0},
    {"voice": "Risk Officer",                "weight": 1.00, "confidence": 0.78, "score":  1.0},
    {"voice": "Fair Lending Compliance",     "weight": 1.20, "confidence": 0.91, "score":  0.0},
    {"voice": "Customer Advocate",           "weight": 0.85, "confidence": 0.74, "score":  1.0},
    {"voice": "Macro Contrarian",            "weight": 0.85, "confidence": 0.69, "score":  0.0},
    {"voice": "AML/KYC Investigator",        "weight": 1.20, "confidence": 0.75, "score":  0.0}
  ],
  "voices": [
    {
      "voice": "Credit Fundamentals",
      "verdict": "approve",
      "confidence": 0.88,
      "rationale": "FICO 745 exceeds 700 floor per Addendum A. DTI 0.33 within 0.36 ceiling per Addendum B.",
      "adverse_action_codes": []
    },
    {
      "voice": "Risk Officer",
      "verdict": "approve",
      "confidence": 0.78,
      "rationale": "LTV 0.72 within 0.80 ceiling per Addendum C. VaR 95%/10d = 0.09 within 0.12 ceiling; risk_budget_status: within_budget.",
      "adverse_action_codes": []
    },
    {
      "voice": "Fair Lending Compliance",
      "verdict": "escalate",
      "confidence": 0.91,
      "rationale": "fair_lending_review_flag set; ECOA/Reg B disparate-impact escalation required prior to human review per BRD Governance Controls.",
      "adverse_action_codes": [{"code": "AA05", "label": "Fair lending review required", "source": "BRD Governance Controls"}]
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
      "verdict": "escalate",
      "confidence": 0.69,
      "rationale": "sector=commercial_real_estate; late-cycle CRE stress in 2026 warrants recession-sensitivity escalation. See Fed CCAR 2026 severe-adverse scenario CRE assumption.",
      "adverse_action_codes": []
    },
    {
      "voice": "AML/KYC Investigator",
      "verdict": "escalate",
      "confidence": 0.75,
      "rationale": "2 AML/KYC finding(s): FinCEN CDD 31 CFR 1010.230 (PEP); FATF high-risk jurisdiction. See adverse-action codes + reason-code dictionary for borrower-readable text.",
      "adverse_action_codes": [{"code": "AA06", "label": "AML/KYC-related eligibility concern requiring compliance review", "source": "BSA / USA PATRIOT / FinCEN CDD / OFAC"}]
    }
  ],
  "adverse_action_codes": [
    {"code": "AA05", "label": "Fair lending review required", "source": "BRD Governance Controls"},
    {"code": "AA06", "label": "AML/KYC-related eligibility concern requiring compliance review", "source": "BSA / USA PATRIOT / FinCEN CDD / OFAC"}
  ],
  "reason_code_dictionary_check": {"ok": true, "invalid": [], "reason": "all codes in dictionary"},
  "protected_class_proxy_check": {"ok": true, "prohibited": [], "reason": "no protected proxies cited"},
  "presentation_order": [3, 5, 0, 2, 4, 1],
  "provider_diversity": {
    "assignment": {"junior": "glm", "senior": "anthropic", "third": "local"},
    "diversity_score": 1.0,
    "unique_providers_used": 3,
    "providers_available_count": 3,
    "assignment_method": "shuffle_and_walk_v1",
    "actually_routed_diverse": true,
    "per_voice_models": {
      "junior": "glm/glm-5.2",
      "senior": "anthropic/claude-sonnet-4-6",
      "third": "local/phi-4-mini"
    }
  },
  "attestation": {
    "version": "aex-attestation/v1",
    "mode": "ed25519",
    "request_commitment": "b47f2c88a1e9…",
    "output_commitment": "5c3d9e11f0b8…",
    "model_id": "anthropic/claude-sonnet-4-6",
    "completed_at_utc": "2026-07-04T14:32:11.847Z",
    "previous_hash": "89a1e5f0d442…",
    "key_id": "shadow-prod-v1",
    "signature": "iZgvxK/eD5UnQd3aH5+PZi7f…"
  }
}
```

## Reading the response

### The verdict is `escalate` — not approve, not block

**Two policy-floor voices escalated:**

- **Fair Lending Compliance** (weight 1.20) → because `fair_lending_review_flag` was set, and only this voice has the authority to hard-block on ECOA / Reg B disparate-impact concerns. It escalated (not blocked) because the flag indicates the review is REQUIRED, not that the loan definitely violates.
- **AML/KYC Investigator** (weight 1.20) → because the borrower is a PEP (Politically Exposed Person) with a Cyprus beneficial owner (FATF high-risk jurisdiction). Both flags are escalate-tier per `AML_FLAG_POLICY` in `lib/aml-kyc-voice.js`. Neither is block-tier (only OFAC SDN hit or unverified CIP would block).

**One prudential voice dissented:**

- **Macro Contrarian** (weight 0.85) → CRE loans in 2026 warrant recession-sensitivity escalation per Fed CCAR severe-adverse scenario assumptions. This voice can never block; its escalate is a signal to the human reviewer to weight CRE cycle risk.

**Three voices approved:**

- Credit Fundamentals (FICO 745 > 700 floor, DTI 0.33 < 0.36 ceiling)
- Risk Officer (LTV 0.72 < 0.80 ceiling, VaR 0.09 < 0.12 ceiling)
- Customer Advocate (no adverse-action reasons in the input)

### The confidence-weighted verdict tells the same story

The `aggregated_score: -0.12` is negative because 3 voices escalated (score 0) and only 3 voices approved (score 1), and the 3 escalating voices carry higher confidence-weighted mass (0.91 + 0.75 + 0.69 = 2.35) than the 3 approving voices (0.88 + 0.78 + 0.74 = 2.40) is close, but their per-voice WEIGHT matters — Compliance's 1.20 vs Advocate's 0.85 tips the aggregation toward escalate.

Per the `AGGREGATION_THRESHOLDS` in `lib/confidence-weighted-verdict.js`: aggregated score between -0.35 and +0.35 → `escalate` (the conservative middle band). This matches `final_verdict: "escalate"`. The confidence-weighted verdict AGREES with the simple resolver's escalate here; that's the expected case when the safety-in-depth simple resolver and the confidence-weighted aggregator surface the same verdict.

### Adverse-action codes are BOTH backed by the signed dictionary

`reason_code_dictionary_check.ok: true` confirms that AA05 (fair-lending review) and AA06 (AML/KYC compliance review) are both real rows in `lib/schemas/reason-code-dictionary.json` — bank counsel signed both when the deployment was configured. Any denial letter the bank generates can cite these codes with borrower-readable text pulled directly from the signed dictionary.

### Protected-class proxy check passed

`protected_class_proxy_check.ok: true` — no feature cited across all 6 voices' rationales is on the ECOA protected-class proxy blocklist. Specifically, the AML/KYC voice cited `pep` and `high_risk_country`, both of which are LEGITIMATE regulatory triggers, not protected-class proxies (compare with, e.g., `zipcode` or `surname_ethnicity_score`, which WOULD be blocked).

### Diverse routing fired

`provider_diversity.actually_routed_diverse: true` + the `per_voice_models` breakdown shows the junior voice ran on GLM, senior on Anthropic Claude Sonnet 4.6, and third on a local Phi-4-mini. The `providers_available_count: 3` confirms all 3 keys were configured at request time — the diversity defense is ACTIVE, not just claimed.

If all 3 voices had run on Anthropic and the model had drifted into a specific hallucination about (say) whether Cyprus PEP status is escalate-tier or block-tier, all 3 voices would have inherited the same hallucination. Per corpora.ai's *Hallucination Amplification in Multi-Agent Debate*, that's the failure mode diverse routing exists to defend. With 3 different providers, the odds of the same hallucination across all 3 are dramatically lower.

## The auditor verification (5 seconds later)

The bank's compliance officer saves the response to `L-2026-07-0842.json` and runs the public verifier:

```bash
node bin/verify-attestation.mjs \
  --response L-2026-07-0842.json \
  --public-key shadow-prod-v1.pub
```

Output:

```
✓ attestation verified
  mode:            ed25519
  model_id:        anthropic/claude-sonnet-4-6
  completed_at:    2026-07-04T14:32:11.847Z
  key_id:          shadow-prod-v1
  request_hash:    b47f2c88a1e9…
  output_hash:     5c3d9e11f0b8…
  chain_prev:      89a1e5f0d442…
```

Bank compliance now has cryptographic proof that:

1. **The response wasn't tampered** in transit or at rest (output_commitment matches SHA-256 of the response body).
2. **The request wasn't tampered** either (request_commitment matches SHA-256 of the loan input).
3. **The specific model reported ran** — if Anthropic silently swapped Sonnet for Haiku behind the scenes, the model_id in the signed payload wouldn't verify.
4. **This deployment's key was Shadow's key** — the public key belongs to the Shadow instance the bank contracted with.
5. **The decision chains back** to the previous decision Shadow made (via `previous_hash`), building an end-to-end audit trail.

None of this required the bank to hold Shadow's private key. They can VERIFY but cannot FORGE.

## What the underwriter does next

The verdict is `escalate`, so the loan doesn't auto-approve OR auto-deny. It moves to a named human reviewer (per bank SOP) with:

- The full JSON response persisted (with the signed attestation) for the audit trail
- 2 adverse-action codes pre-populated (AA05 + AA06) — the borrower-readable text is pulled directly from the signed reason-code dictionary if the reviewer decides to deny
- Specific regulatory citations already lined up: Fair Housing Act via BRD Governance Controls, FinCEN CDD 31 CFR 1010.230 for PEP, FATF for high-risk jurisdiction

If the human reviewer denies, the adverse-action notice writes itself. If the reviewer approves conditional on enhanced due diligence, the audit trail preserves the specific rationale — including who overrode which escalate voice.

## What this case study demonstrates

- **The 6-voice council is not overkill for a mid-size loan.** Three of the six voices had material signal in this case (Compliance, AML/KYC, Contrarian). The three that approved provided a documented baseline: the borrower CLEARS the standard thresholds, so any denial has to be justified by the escalations, not by fabricated concerns.
- **Regulatory citations are baked in.** Every rationale cites the SPECIFIC rule (Addendum A/B/C, ECOA/Reg B, FinCEN CDD 31 CFR 1010.230, FATF). No template phrases. CFPB Circular 2022-03 is satisfied.
- **Diverse routing was ACTIVE, not just diagnostic.** Three different providers ran three different voices, defending against hallucination amplification.
- **Cryptographic proof lives at the edge.** Bank auditor doesn't have to trust Shadow — they can VERIFY every past decision themselves with just the public key.

## Refs

- `lib/run-loan-council.js` — the resolver
- `lib/aml-kyc-voice.js` — the AML_FLAG_POLICY + KYC_STATUS_POLICY frozen tables
- `lib/confidence-weighted-verdict.js` — DEFAULT_PERSONA_WEIGHTS + AGGREGATION_THRESHOLDS
- `lib/schemas/reason-code-dictionary.json` — the signed dictionary with AA05 + AA06 rows
- `lib/attestation.js` — Ed25519 attestation
- `lib/diverse-caller.js` — per-voice diverse routing
- `bin/verify-attestation.mjs` — public verifier CLI
- README § "Regulatory positioning (2026 H2)" — SR 26-2 Tier 3 + GDPR Art. 22 + CFPB 2026-07-21 defense
- `docs/soc2-readiness.md` — 35-control map against AICPA Trust Service Criteria
