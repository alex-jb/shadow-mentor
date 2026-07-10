# GSAR 552.239-7001 Provenance Disclosure Kit (Shadow v1.5.26+)

**Reference**: GSAR 552.239-7001 draft "Basic Safeguarding of Artificial Intelligence Systems" — published 2026-03-06 by GSA. Applies to all MAS vendors offering AI. MAS-Refresh-32 candidate.

**Third-party summary**: [Gibson Dunn, "GSA AI Procurement Rules Would Introduce New Disclosure and Use Rights Requirements for Federal Contractors"](https://www.gibsondunn.com/gsa-ai-procurement-rules-would-introduce-new-disclosure-and-use-rights-requirements-for-federal-contractors/)

## Who this document is for

Federal contractors (SAIC, Booz Allen, Leidos, ManTech, and any other GSA MAS-Refresh-32 vendor) submitting Shadow as a subcomponent in a federal AI procurement response. This kit packages Shadow's existing cryptographic evidence layer into the shape a GSAR-format provenance disclosure requires.

Shadow's cryptographic evidence layer already answers each GSAR requirement. This kit + `bin/gsar-provenance-report.mjs` render that evidence into the exact JSON shape a GSA MAS reviewer expects.

## Generate a provenance report

```bash
node bin/gsar-provenance-report.mjs > shadow-provenance-$(date +%Y-%m-%d).json
```

The generated JSON has seven sections plus a `report_sha256` that federal contractors pin in their procurement response. Any post-hoc edit to the underlying repo files (persona prompts, citation registry, reason-code dictionary, protected-classes schema) changes the SHA-256 and is detectable independently of Shadow.

Sample invocation output layout:

```json
{
  "schema": "shadow://gsar-552-239-7001/v1",
  "protocol_version": "1",
  "reference": "GSAR 552.239-7001 (draft 2026-03-06)",
  "generated_at_utc": "2026-07-08T20:00:00.000Z",
  "product_identification": { ... },
  "model_provenance": { ... },
  "data_origins": { ... },
  "risk_assessments": { ... },
  "cryptographic_evidence": { ... },
  "test_surface": { ... },
  "bill_of_tools": { ... },
  "report_sha256": "8b8bd701..."
}
```

## What each section answers

### §1. Product identification

Name, version, license, repository URL, author + contributor attribution. Sourced from `package.json`. Contributor list includes Loredana C. Levitchi (primary author of risk / credit-policy / threshold / adverse-action / traceability modules per the 2026-06-19 MIT-licensed merge grant).

### §2. Model provenance

Answers GSAR requirement (1) "model provenance." Shadow supports three provider paths:

- **Anthropic** — `claude-sonnet-4-5-20250929`, `claude-haiku-4-5-20251001`
- **OpenAI** — `gpt-5.2`
- **Zhipu GLM** — `glm-5`

Every provider entry names an Ed25519 substitution-detection guarantee: the `model_id` field in every attestation is bound cryptographically, so an API provider silently swapping models (arXiv:2504.04715 threat) is detectable.

Shadow also ships **deterministic paths** with no LLM calls: `runLoanCouncil` (banking), `runDSCouncil` (data science), `sizePosition` (trader-pack). Federal deployments can constrain to these paths for reproducibility.

### §3. Data origins

Answers GSAR requirement (2) "data origins." Shadow explicitly declares:

- **Shadow training data**: none. Shadow does not train models.
- **Persona prompts source**: `lib/prompts.js` — hand-authored, citation-grounded, Ed25519-signed per attestation
- **Regulatory citations source**: `lib/schemas/citation-registry.json` — primary-source URLs (federalreserve.gov, cfpb.gov, ecfr.gov, sec.gov, fincen.gov)
- **Reason codes source**: `lib/schemas/reason-code-dictionary.json` — CFPB Circular 2026-03 aligned + Loredana Levitchi BRD Addenda A/B/C
- **Model training cutoffs**: enumerated per provider, sourced from published model cards

### §4. Risk assessments

Answers GSAR requirement (3) "risk assessments." Each risk area names a specific document + test-file path:

- **NIST AI 600-1 GenAI Profile** → `docs/NIST-AI-600-1-MAP.md`
- **SR 26-2 footnote 3 delegation positioning** → not-primary-model-risk-mgmt
- **Reg B / ECOA §701 adverse action** → `docs/CITATION_MAP.md` AA01-AA06 triples
- **BSA / AML** → `lib/aml-kyc-voice.js` opt-in 6th persona voice
- **GDPR Art. 22 + Schufa C-634/21** → EU-GDPR citation registry entries
- **Reg BI** → `docs/CITATION_MAP.md` Best-Interest triples
- **Verdict invariance** → `test/verdict-invariance.test.js` (10 structural perturbation tests)
- **Policy Invariance Score** → `docs/JUDGE-CARD.md` (3 named metrics per arXiv:2605.06161)
- **GAICF layer 3 adverse-action drafter** → `docs/GAICF-COMPATIBILITY.md` (arXiv:2607.04103)
- **FinCEN NPRM 2026-04-07 alignment** → `docs/FINCEN-NPRM-2026-04-07-ALIGNMENT.md` (stage-aware citation resolver)

### §5. Cryptographic evidence

The heart of the report. Every hash here is computed from the current repo state at report-generation time. Federal contractors pin these SHA-256 values in the procurement response, and any post-hoc edit to the underlying file changes the hash independently of Shadow.

Fields include:

- `persona_prompts_sha256` — covers `lib/prompts.js`
- `citation_registry_sha256` — covers `lib/schemas/citation-registry.json`
- `reason_code_dictionary_sha256` — covers `lib/schemas/reason-code-dictionary.json`
- `protected_classes_schema_sha256` — covers concatenation of both US-ECOA + EU-GDPR schemas
- `protected_classes_us_ecoa_sha256` + `protected_classes_eu_gdpr_sha256` — split hashes for auditors who want to pin one jurisdiction at a time
- `attestation_signature_algorithm`: `Ed25519 (RFC 8032)`
- `per_response_attestation_fields`: the full list of 13 fields Ed25519-signed per response, including all six append-only v1.5.8/18/19/20/23/24 fields

### §6. Test surface

- `total_tests`: 1033 as of v1.5.25
- `total_release_tags`: 26
- Notable test files listed inline
- CI status URL: https://github.com/alex-jb/shadow-mentor/actions

### §7. Bill of tools (MCP-manifest SBOM equivalent)

Points at the live `/api/mcp-manifest` endpoint on the Vercel production URL. GSA MAS reviewers can independently fetch it and cross-check every tool's SHA-256 against this report.

Currently 8 MCP tools: `shadow_loan_council`, `shadow_risk_tools`, `shadow_recall`, `shadow_calibration`, `shadow_scenarios`, `shadow_traceability`, `shadow_verify_attestation`, `shadow_verify_chain`.

## `report_sha256` — the single-line pin for procurement responses

The `report_sha256` field at the top level covers the exact JSON bytes of the report with `report_sha256` field removed. Federal contractors pin this single value in a procurement response. Shadow re-generates the same report from the same repo commit + same `generated_at_utc` and can verify the pin independently.

## Determinism guarantee

Given the same repo commit + same `generated_at_utc`, `generateGsarReport()` produces byte-identical output. This is asserted in `test/gsar-provenance-report.test.js`.

## Not a replacement for a live FedRAMP audit

This kit is a self-attestation. It packages evidence a GSA MAS reviewer can independently verify (persona prompt SHA-256, citation registry SHA-256, MCP-manifest endpoint contents, GitHub CI green history), but it does not substitute for an active FedRAMP Moderate audit. Federal deployments requiring a live FedRAMP Moderate authorization use this kit as pre-audit evidence.

## Related documents

- `docs/NIST-AI-600-1-MAP.md` — Federal contractor mapping for the NIST GenAI Profile 12 risks
- `docs/CITATION_MAP.md` — Loredana Levitchi's regulatory-citation-to-test triple map
- `docs/GAICF-COMPATIBILITY.md` — GAICF three-layer control matrix
- `docs/JUDGE-CARD.md` — Policy Invariance Score reporting protocol
- `docs/FINCEN-NPRM-2026-04-07-ALIGNMENT.md` — BSA/AML NPRM transition path
