# Heterogeneous-Debate Enforcement

**Ships in Shadow v1.5.32 (2026-07-08).**
**Anchor:** arXiv:2606.19826 — "Heterogeneous LLM Debate Under Adversarial Peers" (Nilayam et al., 2026-06-18).

## The problem the paper describes

A multi-agent LLM debate is only a defense against hallucination or bias when the agents do not share priors. If all voices route to the same base model, the debate AMPLIFIES the shared prior instead of correcting it. Worse: when one voice is silently compromised (prompt injection, adversarial-tuning backdoor, a provider outage that gets silently substituted for another provider), a homogeneous council amplifies that voice's error through debate rather than isolating it.

The Nilayam et al. paper argues heterogeneity across model providers is the minimum-viable defense against a single-provider adversarial peer. Two providers is the floor. Three defends against two-provider collusion.

## What v1.5.32 changes

Shadow shipped `lib/provider-diversity.js` in v1.4.0 (2026-07-02). That module computed a `diversity_score` and surfaced `providers_available_count` in the response body. Bank counsel could read it. Nothing enforced it.

v1.5.32 flips diagnostic → enforcement:

- `lib/heterogeneous-debate.js` — new module.
- `enforceHeterogeneousDebate({ voiceNames, availableProviders, minProviders })` — returns `{ ok: false, reason: "..." }` when the deployment does not meet the min-provider floor. Default floor is 2.
- `heterogeneityCommitment({ minProviders, uniqueProvidersUsed, providersUsedSorted })` — computes a SHA-256 hex over the enforcement inputs. Order-insensitive, deterministic, 64 chars.
- `enforceAndCommit(params)` — convenience wrapper that returns both.
- `detectDominanceRisk(assignment, dominanceThreshold=0.6)` — flags when a single provider takes ≥60% of voices in a multi-provider deployment. Structural shape check.
- `lib/attestation.js` — new append-only `heterogeneity_commitment_sha256` field. Same back-compat pattern as v1.5.8/18/19/20/23/24/28/30. Pre-v1.5.32 attestations verify unchanged.
- `test/heterogeneous-debate.test.js` — 20 contract tests. Enforcement gate (5), commitment determinism + order-insensitivity + distinctness (4), dominance detection (3), attestation binding (HMAC + Ed25519) + tamper detection + back-compat (5), adversarial-peer scenario end-to-end (1).

Test surface 1100 → 1120 (+20). Full suite green.

## Enforcement policy

`enforceHeterogeneousDebate()` is a primitive, not a policy. Callers who wire it into `/api/deliberate` can choose:

1. **Strict mode**: refuse deliberation with HTTP 428 (Precondition Required) + JSON body `{ error: "heterogeneity_floor_not_met", reason: "..." }`. This is the correct choice for regulated deployments — a bank counsel cannot accept a signed decision from a deployment that structurally failed the adversarial-peer defense.
2. **Warn mode**: proceed with deliberation, include the enforcement result in the response body under `heterogeneity_enforcement.ok = false`, log to SIEM. Correct choice for pre-production shakedown.
3. **Escalate mode**: proceed to deliberation but force the verdict resolver to `escalate` even if the underlying voices reach consensus. Correct choice for staged rollouts.

Shadow ships the primitive at `lib/heterogeneous-debate.js`. Wiring into `/api/deliberate` as strict mode is deferred to v1.5.33 so bank counsel can flag-gate the transition per deployment.

## Why attestation binding matters

Without the commitment SHA-256, a bank could silently lower `min_providers` from 2 to 1 after a decision was made, then claim (post-hoc) that the deployment always accepted single-provider deliberation. The Ed25519 signature over `heterogeneity_commitment_sha256` prevents this: verification recomputes the commitment from `{min_providers, unique_providers_used, providers_used_sorted}` and re-verifies the signature. Any silent relaxation breaks verification.

Bank counsel pins the `heterogeneity_commitment_sha256` value in procurement contracts alongside `dictionary_hash`, `citation_registry_sha256`, `proxy_schema_sha256`, `policy_invariance_score_sha256`, `adverse_action_notice_sha256`, `sampling_seed_commitment_sha256`, and `evidence_partition_scheme_sha256`. All eight append-only fields are the current binding surface for the aex-attestation/v1 canonical payload.

## Back-compat

Pre-v1.5.32 attestations do not carry the `heterogeneity_commitment_sha256` field. Their signing payloads never included it. Their signatures verify unchanged because `_signingPayload()` only appends the field when present.

Deployments running with a single provider that pre-date v1.5.32 continue to produce verifiable attestations. Bank counsel reviewing a specific decision from before 2026-07-08 will see no `heterogeneity_commitment_sha256` in the attestation and interpret that as "this decision predates enforcement." No wire break.

## What bank counsel should ask on procurement review

1. **Which providers are configured in this deployment?** Confirm at least two of `ANTHROPIC_API_KEY`, `GLM_API_KEY`, `SHADOW_LOCAL_LLM_URL` are set.
2. **What is the `min_providers` value pinned in the procurement contract?** Default is 2. Bank counsel can pin 3 for higher-risk lending books.
3. **What is the deployment's response to enforcement failure?** Strict / warn / escalate. Only strict is procurement-defensible for regulated lending.
4. **Which persona is assigned to which provider?** The assignment is deterministic per request (seeded Fisher-Yates shuffle) and reported in `per_voice_models` on each response body.
5. **What is the `heterogeneity_commitment_sha256` for the specific decision under audit?** Pin this in the exam workpaper alongside the Ed25519 signature.

## Related v1.5.x fields already in aex-attestation/v1

| Field | Version | Anchor |
|---|---|---|
| `dictionary_hash` | v1.5.8 | Reg B AA-code signed dictionary |
| `citation_registry_sha256` | v1.5.18 | CFR citation registry |
| `proxy_schema_sha256` | v1.5.19 | ECOA §701 protected-class schema |
| `original_content_hash` | v1.5.20 | CCR pre-compression content (scaffold) |
| `policy_invariance_score_sha256` | v1.5.23 | Judge Card (arXiv:2605.06161) |
| `adverse_action_notice_sha256` | v1.5.24 | GAICF layer 3 notice (arXiv:2607.04103) |
| `sampling_seed_commitment_sha256` | v1.5.28 | Invisible manipulation defense (arXiv:2606.16121) |
| `evidence_partition_scheme_sha256` | v1.5.30 | InfoDelphi partition (arXiv:2607.01661) |
| **`heterogeneity_commitment_sha256`** | **v1.5.32** | **Heterogeneous debate enforcement (arXiv:2606.19826)** |

Each field ships with (a) a canonical hash function, (b) a contract test proving the hash is order-insensitive and deterministic, (c) an attestation binding test proving tamper detection breaks Ed25519 verification, and (d) a back-compat test proving pre-version attestations verify unchanged. This pattern lets Shadow ship regulatory + academic moats without ever breaking the wire format.
