# aex-attestation/v1 — signed-field inventory (§2)

Every field that enters the v1 signature, in signing order, with its serialized form, validation, and the
null/empty/absent behavior that makes it ambiguous. Source of truth:
`packages/attest-core/attestation.js::_signingPayload`. See `ATTESTATION_V1_AMBIGUITY_ANALYSIS.md` for how
these combine into the three confirmed collisions, and `ATTESTATION_ENVELOPE_V2.md` for the v2 fix per row.

## Core positional fields (always present, in this order)

| # | Property (stored) | In signed bytes as | Required | Validation (v1) | null/empty/absent behavior | Back-compat requirement |
|---|---|---|---|---|---|---|
| 0 | `version` | value only, position 0 | yes | none (constant `aex-attestation/v1`) | n/a | frozen |
| 1 | `mode` | value only, position 1 | yes | `hmac-sha256` or `ed25519` | n/a | frozen |
| 2 | `request_commitment` | value only, position 2 | yes | sha256 hex of canonical request | absent → collision risk | frozen |
| 3 | `output_commitment` | value only, position 3 | yes | sha256 hex of canonical output | absent → collision risk | frozen |
| 4 | `model_id` | value only, position 4 | yes | free string (unbounded) | `"|"` inside → boundary collision | frozen |
| 5 | `completed_at_utc` | value only, position 5 | yes | free string (no normalization) | `"|"` inside → boundary collision | frozen |
| 6 | `previous_hash` | `previous_hash \|\| ""`, position 6 | no | free string or null | **null ≡ "" collapse** | frozen |
| 7 | `key_id` | value only, position 7 | yes | free string (unbounded) | `"|"` inside → boundary collision | frozen |

## Optional bindings (appended by value only, name NOT signed)

Each present binding is `parts.push(<value>)` — the **name never enters the signed bytes**, which is the
relabel-collision root cause. A falsy value is skipped (absent ≡ `""`).

| Property (stored) | Build param | Appended when | Serialized as | v1 ambiguity |
|---|---|---|---|---|
| `dictionary_hash` | `dictionaryHash` | truthy | value only | relabel + absent/empty collapse |
| `citation_registry_sha256` | `citationRegistrySha256` | truthy | value only | relabel |
| `proxy_schema_sha256` | `proxySchemaSha256` | truthy | value only | relabel |
| `original_content_hash` | `originalContentHash` | truthy | value only | relabel |
| `policy_invariance_score_sha256` | `policyInvarianceScoreSha256` | truthy | value only | relabel |
| `adverse_action_notice_sha256` | `adverseActionNoticeSha256` | truthy | value only | relabel |
| `sampling_seed_commitment_sha256` | `samplingSeedCommitmentSha256` | truthy | value only | relabel |
| `evidence_partition_scheme_sha256` | `evidencePartitionSchemeSha256` | truthy | value only | relabel |
| `heterogeneity_commitment_sha256` | `heterogeneityCommitmentSha256` | truthy | value only | relabel |
| `claim_type_sha256` | `claimTypeSha256` | truthy | value only | relabel |
| `bian_coverage_sha256` | `bianCoverageSha256` | truthy | value only | relabel |
| `eticas_taxonomy_sha256` | `eticasTaxonomySha256` | truthy | value only | relabel |
| `sive_fixture_set_sha256` | `siveFixtureSetSha256` | truthy | value only | relabel |
| `calibration_ranking_split_sha256` | `calibrationRankingSplitSha256` | truthy | value only | relabel |

## Security meaning

- **Positional core** proves *what was decided* (request/output commitments), *by which model at what time*
  (model_id/completed_at_utc), *in which key epoch* (key_id), and *linked to what prior* (previous_hash).
- **Bindings** prove *which governance artifacts* the decision was bound to (dictionary, citation registry,
  proxy schema, adverse-action notice, sampling seed, etc.).

In v1 the field **identity** of every one of these is outside the signature. v2 signs all 10 core field
names + the named `bindings` object, so identity is covered. Coverage is asserted by
`test/attestation-v2-security.test.js::V2-NAMED-ENVELOPE` and the golden parity test.
