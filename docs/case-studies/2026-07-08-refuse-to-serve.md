# Case Study — OFAC SDN Match → `refuse_to_serve`

**Ships in Shadow v1.5.36 (2026-07-08).**
**Anchor:** arXiv:2606.29142 § refuse_to_serve populations (Table 4 row 1)
**Purpose:** Show the full request → response → attestation chain for a decision that pre-v1.5.35 Shadow returned as `escalate` and now correctly returns as `refuse_to_serve`.

## The applicant scenario

Mid-size regional bank is evaluating a $4.5M commercial real estate loan. Applicant profile scanned into the loan-origination system flags an OFAC SDN list match at the KYC step. Everything else on the file (FICO 720, DTI 0.30, LTV 0.70, borrower rating BBB) would pass standard credit-fundamental review.

Under BSA §5318(g)(2), a bank cannot disclose the existence of a SAR filing to the customer, and under 31 CFR 501.603, an OFAC SDN match prohibits origination regardless of credit fundamentals.

Pre-v1.5.35 Shadow returned `verdict: "escalate"` for this case. That is factually wrong on two fronts:
1. Implies discretion the compliance officer does not have (statute controls).
2. Downstream call-center scripts route "escalate" to a human-reviewer queue that would say "your application is being reviewed" — which if the reviewer then discloses the SDN basis becomes a §5318(g)(2) violation.

Shadow v1.5.36 fixes both by returning `verdict: "refuse_to_serve"` with the correct citation chain and a minimal borrower-facing notice.

## The request

```json
POST /api/deliberate
Content-Type: application/json

{
  "persona": "compliance",
  "scenario": "lbo",
  "loan": {
    "credit_score": 720,
    "debt_to_income": 0.30,
    "loan_to_value": 0.70,
    "amount": 4500000,
    "sector": "commercial_real_estate",
    "borrower_rating": "BBB",
    "aml_flags": ["OFAC_SDN_MATCH"]
  }
}
```

## The response — key fields

```json
{
  "verdict": "refuse_to_serve",
  "refuse_to_serve": {
    "verdict": "refuse_to_serve",
    "refusal_category": "ofac_sdn_match",
    "borrower_facing_notice": "We cannot proceed with your application at this time. Please contact our compliance department at [BANK-COMPLIANCE-PHONE] for further information. This notice is provided in accordance with the Equal Credit Opportunity Act and applicable federal law.",
    "internal_audit_note": "Non-discretionary refusal per 31 CFR 501.603 (OFAC SDN) + 50% rule (OFAC guidance) + Executive Order 13224 (or applicable EO). Bank counsel cannot override without violating cited law. Category: ofac_sdn_match. See arXiv:2606.29142 for systematization.",
    "citations": [
      "31 CFR 501.603 (OFAC SDN)",
      "50% rule (OFAC guidance)",
      "Executive Order 13224 (or applicable EO)"
    ],
    "anchor": "arXiv:2606.29142",
    "escalation_valid": false
  },
  "claim_type_envelope": {
    "claim_type": "testimony",
    "audit_expectation_class": "source-freshness-replay",
    "additional_hashes_required": [],
    "envelope_hash_sha256": "…",
    "anchor": "arXiv:2605.20312"
  },
  "heterogeneity_enforcement": {
    "ok": true,
    "min_required": 2,
    "unique_providers_used": 2,
    "providers_used_sorted": ["anthropic", "glm"],
    "commitment_sha256": "…",
    "strict_mode_requested": false,
    "anchor": "arXiv:2606.19826"
  },
  "attestation": {
    "version": "aex-attestation/v1",
    "mode": "ed25519",
    "request_commitment": "…",
    "output_commitment": "…",
    "model_id": "anthropic/claude-sonnet-4-5",
    "completed_at_utc": "2026-07-08T…",
    "previous_hash": "…",
    "dictionary_hash": "…",
    "citation_registry_sha256": "…",
    "proxy_schema_sha256": "…",
    "heterogeneity_commitment_sha256": "…",
    "claim_type_sha256": "…",
    "signature": "…"
  },
  "reproducibility_manifest": {
    "spec_version": "shadow-reproducibility/v1",
    "anchor": "arXiv:2606.08285",
    "axes": { "data_provenance": {…}, "temporal_split": {…}, "execution_environment": {…}, "threshold_configuration": {…}, "prompt_configuration": {…} },
    "manifest_hash_sha256": "…"
  }
}
```

## Why each field matters at audit time

1. **`verdict: "refuse_to_serve"`** — call-center scripts route this to the sanctions-review workflow, not the human-reviewer queue. `escalation_valid: false` is enforced.
2. **`borrower_facing_notice`** — minimal by design. No mention of OFAC / SDN / sanctions / SAR — those words would be a §5318(g)(2) violation.
3. **`internal_audit_note`** — rich rationale for the auditor. Cites specific CFR + OFAC guidance + EO.
4. **`citations[]`** — pinned in procurement contract. Bank counsel signs off on the citation chain, not the LLM output.
5. **`claim_type_envelope.claim_type: "testimony"`** — declares this decision is grounded in third-party assertion (the OFAC SDN list). Auditor knows to verify source freshness, NOT seed-commitment (which would be the check for an INFERENCE-class claim).
6. **`heterogeneity_enforcement.ok: true`** — two distinct LLM providers (Anthropic + GLM) participated. Structurally defends against adversarial-peer amplification per arXiv:2606.19826.
7. **`attestation.heterogeneity_commitment_sha256`** — post-hoc silent relaxation of `min_providers` would break Ed25519 verification.
8. **`attestation.claim_type_sha256`** — post-hoc silent reclassification from TESTIMONY to INFERENCE (skipping seed-commitment verification the auditor was expecting) would break Ed25519 verification.
9. **`reproducibility_manifest.manifest_hash_sha256`** — bank counsel pins ONE hash in the exam workpaper. If any of 9 underlying hashes changed post-decision, this no longer matches.

## Verification (the audit-time story)

Bank auditor 90 days later opens the archived decision. They:
1. Rehash the borrower snapshot → compare to `request_commitment`.
2. Rehash the response body → compare to `output_commitment`.
3. Verify Ed25519 signature over the concatenated payload including all 10 append-only fields.
4. Confirm `claim_type` is TESTIMONY → check OFAC source freshness at `completed_at_utc`. Do NOT need to check seed commitment (that's INFERENCE-class only).
5. Confirm dictionary hash matches the version bank counsel signed off on.
6. Confirm `manifest_hash_sha256` matches — if yes, all 9 underlying hashes match and reproducibility is proven.

If any check fails, the audit trail broke. The bank finds out AT AUDIT TIME, not months later when a regulator asks.

## Contrast with Norm AI + Anthropic-FIS

Norm AI ($120M Series C 2026-07-07) does not ship this. Their SaaS agent produces the reason string but does not sign it, does not bind it to a dictionary hash, does not distinguish `refuse_to_serve` from `escalate`, does not classify the epistemic class of the claim. Bank counsel who wants the signed audit trail cannot buy it from Norm.

Anthropic + FIS Financial Crimes Agent (GA 2H 2026) may compress AML investigations from hours to minutes but does not ship the governance layer around the output. Shadow's positioning: verifies FIS agent output, not competes with it.

## Try it locally (no API key required)

```bash
node examples/mock-deliberate.mjs
```

Or with custom loan:

```bash
node examples/mock-deliberate.mjs --loan '{"credit_score":720,"debt_to_income":0.3,"loan_to_value":0.7,"amount":4500000,"aml_flags":["OFAC_SDN_MATCH"]}'
```

Byte-for-byte the shape a real `/api/deliberate` response produces. Zero live LLM calls. Zero API cost. Zero data egress. Useful for offline demos + air-gapped procurement reviews + presentation fallback when Vercel is down or Anthropic billing is dry.

## Try it against the live endpoint (requires ANTHROPIC_API_KEY)

```bash
curl -X POST https://shadow-mentor.vercel.app/api/deliberate \
  -H 'Content-Type: application/json' \
  -d '{
    "persona": "compliance",
    "scenario": "lbo",
    "loan": {
      "credit_score": 720,
      "debt_to_income": 0.30,
      "loan_to_value": 0.70,
      "amount": 4500000,
      "sector": "commercial_real_estate",
      "borrower_rating": "BBB",
      "aml_flags": ["OFAC_SDN_MATCH"]
    }
  }' | jq
```

Same response shape, but with actual LLM-generated persona rationales in `junior` / `senior` / `third` fields.
