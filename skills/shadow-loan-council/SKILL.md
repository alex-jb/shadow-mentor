---
name: shadow-loan-council
description: 5-to-6 voice AI compliance council for regulated lending. Deterministic verdict in milliseconds. Signed Ed25519 attestation. Runs in your VPC. Cites CFPB / SR 26-2 / ECOA / Reg B / BSA / OFAC / FinCEN CDD by construction. Pure-compute pass — no LLM in the tool body.
version: 1.4.0
authors:
  - Alex Xiaoyu Ji <xji1@mail.yu.edu>
  - Loredana C. Levitchi (BRD + Addenda A/B/C + Risk Appetite Note)
license: MIT
repo: https://github.com/alex-jb/shadow-mentor
tags:
  - banking
  - regulated-lending
  - loan-origination
  - underwriting
  - compliance
  - sr-26-2
  - cfpb
  - ecoa
  - reg-b
  - aml
  - kyc
  - hitl
  - human-in-the-loop
  - attestation
  - ed25519
  - mcp
---

# Shadow Loan Council

The **pure-compute** verdict layer of Shadow's compliance council. Takes a typed loan dict + policy + optional AML/KYC signals; returns a `{verdict, voices, adverse_action_codes, traceability, attestation, ...}` bundle in milliseconds. NO LLM call inside the tool body — every threshold is hardcoded to a checked-in policy artifact.

## When to use

Install this skill in Claude Desktop / Cursor / OpenCode when you want Claude to:

- Get an immediate policy-driven verdict on a loan application without waiting for a stochastic LLM call
- Verify what Shadow's council would say against your own reasoning (audit path)
- Generate the adverse-action code + borrower-readable notice text from a signed reason-code dictionary
- Screen an AML/KYC risk with specific rule citations (BSA, OFAC, USA PATRIOT §326, FinCEN CDD, FATF)
- Get an Ed25519-signed attestation binding the loan input to the exact verdict, so the bank auditor can verify with the public key

## What the response contains

```json
{
  "final_verdict": "approve" | "escalate" | "block",
  "confidence_weighted_verdict": "approve" | "escalate" | "block",
  "aggregated_score": -1.0 to 1.0,
  "voice_contributions": [{ voice, weight, confidence, score }],
  "voices": [ { voice, verdict, confidence, rationale, adverse_action_codes, metrics } ],
  "presentation_order": [3, 0, 1, 5, 2, 4],
  "risk_packet": { var_95_10d, es_95_10d, concentration, sector_exposure, risk_budget_status },
  "adverse_action_codes": [ { code: "AA01" | ... | "AA06", label, source } ],
  "reason_code_dictionary_check": { ok, invalid, reason },
  "protected_class_proxy_check": { ok, prohibited, reason },
  "thresholds_applied": { fico_floor, dti_ceiling, ltv_ceiling, var_ceiling, ... },
  "traceability": { ...maps every threshold to BRD vs Addendum vs Risk Appetite Note... },
  "attestation": {
    "version": "aex-attestation/v1",
    "mode": "ed25519" | "hmac-sha256",
    "request_commitment": "sha256 hex",
    "output_commitment": "sha256 hex",
    "model_id": "runLoanCouncil/pure-compute",
    "completed_at_utc": "2026-07-03T...",
    "signature": "base64 (Ed25519) or hex (HMAC)"
  }
}
```

## Voices

5 fixed voices; 6th (AML/KYC Investigator) attached when the loan carries `aml_flags[]` or `kyc_status`:

1. **Credit Fundamentals** — FICO / DTI (weight 1.10)
2. **Risk Officer** — VaR / LTV / concentration (weight 1.00)
3. **Fair Lending Compliance** — ECOA / Reg B (weight 1.20)
4. **Customer Advocate** — adverse-action quality (weight 0.85)
5. **Macro Contrarian** — sector cycle (weight 0.85)
6. **AML/KYC Investigator** (opt-in) — BSA / OFAC / PATRIOT §326 / FinCEN CDD (weight 1.20)

## Install

```bash
npx skills add alex-jb/shadow-mentor/skills/shadow-loan-council
```

Or install the full Shadow MCP server:

```bash
git clone https://github.com/alex-jb/shadow-mentor
cd shadow-mentor
node bin/install.mjs --host cursor    # or claude / opencode / zed
```

This gives you `shadow_loan_council` as an MCP tool Claude can call directly.

## Ed25519 attestation — for procurement

Every response is signed. To let a bank auditor independently verify without holding your server secret:

1. Generate a keypair at deploy time (see README's Ed25519 section)
2. Set `SHADOW_ATTESTATION_MODE=ed25519` + private key env var on Shadow
3. Deliver ONLY the public key to the auditor
4. Auditor calls `verifyAttestation(att, req, res, { publicKey })` on any past decision

RFC 8032 EdDSA. Bank can VERIFY, cannot FORGE.

## Refs

- Full repo: https://github.com/alex-jb/shadow-mentor
- Latest release: https://github.com/alex-jb/shadow-mentor/releases/tag/v1.4.0
- CHANGELOG: https://github.com/alex-jb/shadow-mentor/blob/main/CHANGELOG.md
- Reason-code dictionary (signed by bank counsel): `lib/schemas/reason-code-dictionary.json`
- Persona L1/L2/L3 metadata: `lib/persona-schema.json`
- Confidence-weighted verdict aggregator (Roundtable Policy arxiv 2509.16839): `lib/confidence-weighted-verdict.js`
- Attestation (AEX arxiv 2603.14283 + RFC 8032): `lib/attestation.js`
- AML/KYC voice (ACAMS 2026 procurement lane): `lib/aml-kyc-voice.js`
