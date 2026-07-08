# Typed-Claim Envelope

**Ships in Shadow v1.5.37 (2026-07-08).**
**Anchor:** arXiv:2605.20312 — "Pramana: A Protocol-Layer Treatment of Claim Verification in Autonomous Agent Networks" (Kadaboina, 2026-05-19).

## The problem the paper describes

Pre-v1.5.37 Shadow attestations bound the request commitment + response commitment + model_id + timestamp + 9 append-only hashes. What they did NOT declare is the **epistemic class** of the claim. Was this decision derived from direct data observation? From LLM inference? From case-precedent retrieval? From a third-party assertion (bureau credit report, FinCEN response, OFAC list)?

Bank auditor has to figure it out from context — brittle and error-prone at audit time. Worse: different claim classes have different audit-replay expectations, so an auditor who mistakes an inference-class claim for a perception-class claim will skip the seed-commitment verification and miss silent post-hoc model substitution.

## What v1.5.37 ships

- `lib/typed-claims.js` — new module.
  - `CLAIM_TYPE` enum: `PERCEPTION` / `INFERENCE` / `ANALOGY` / `TESTIMONY` (4 classes from Pramana taxonomy, re-labeled for banking context).
  - `AUDIT_EXPECTATION` — per-class replay expectation with `class`, `what_to_verify`, `additional_hashes_required`.
  - `buildTypedClaimEnvelope(claimType)` — canonical envelope with `envelope_hash_sha256` at top level.
  - `claimTypeCommitment(claimType)` — just the hash.
  - `classifyClaimType({scenario, loan, verdict})` — heuristic default hint.
- `lib/attestation.js` — new append-only `claim_type_sha256` field (10th append-only field). Same back-compat pattern.
- `test/typed-claims.test.js` — 17 contract tests.

## The 4 claim classes

| Class | What it means | Audit-replay expectation | Additional hash needed |
|---|---|---|---|
| **PERCEPTION** | Direct observation of borrower data (schema-validated input) | Re-hash borrower snapshot; must match `request_commitment` byte-for-byte | — |
| **INFERENCE** | LLM-derived conclusion (scenario prompt → text response) | Re-run LLM with pinned seed / temperature / model_id from `sampling_seed_commitment_sha256` | `sampling_seed_commitment_sha256` |
| **ANALOGY** | Precedent / case-retrieval reasoning (RAG citation) | Reload precedent registry from `citation_registry_sha256`; confirm cited precedent present | `citation_registry_sha256` |
| **TESTIMONY** | Third-party assertion (bureau, FinCEN, OFAC) | Confirm source queried within staleness window relative to `completed_at_utc` | — |

## Why the taxonomy matters at audit time

Consider a bank counsel opening a decision from 90 days ago. Without typed claims, they have to reverse-engineer which fields to verify:

- Did the decision come from the LBO+loan path? Then it's PERCEPTION-class — replay is deterministic.
- Did the decision come from the pure-council path? Then it's INFERENCE-class — must verify seed commitment.
- Did the decision reference case precedents? Then it's ANALOGY-class — must verify precedent registry.
- Did the decision cite OFAC / FinCEN / a bureau? Then it's TESTIMONY-class — must verify source freshness.

With v1.5.37, one field declares the class, and the auditor knows immediately which additional hashes to verify. Post-hoc reclassification (silent downgrade from INFERENCE to PERCEPTION to skip seed verification) breaks Ed25519 verification.

## Wiring into `/api/deliberate` — deferred

Wiring `classifyClaimType()` into the `/api/deliberate` response body + binding `claim_type_sha256` into the attestation deferred to v1.5.38 so callers can pass an explicit override for cases where the heuristic default is wrong.

## aex-attestation/v1 append-only field surface — now 10

| Field | Version | Anchor |
|---|---|---|
| dictionary_hash | v1.5.8 | Reg B AA-code dictionary |
| citation_registry_sha256 | v1.5.18 | CFR citation registry |
| proxy_schema_sha256 | v1.5.19 | ECOA §701 blocklist |
| original_content_hash | v1.5.20 | CCR (scaffold) |
| policy_invariance_score_sha256 | v1.5.23 | arXiv:2605.06161 Judge Card |
| adverse_action_notice_sha256 | v1.5.24 | arXiv:2607.04103 GAICF L3 |
| sampling_seed_commitment_sha256 | v1.5.28 | arXiv:2606.16121 IMC |
| evidence_partition_scheme_sha256 | v1.5.30 | arXiv:2607.01661 InfoDelphi |
| heterogeneity_commitment_sha256 | v1.5.32 | arXiv:2606.19826 Heterogeneous debate |
| **claim_type_sha256** | **v1.5.37** | **arXiv:2605.20312 Pramana** |
