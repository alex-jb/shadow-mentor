# Reproducibility Manifest

**Ships in Shadow v1.5.33 (2026-07-08).**
**Anchor:** arXiv:2606.08285 — "Beyond Agent Architecture: Execution Assumptions and Reproducibility in LLM-Based Trading Systems" (Yao/Zheng, 2026-06-06).

## The problem the paper describes

Yao & Zheng audited 30 published LLM-based trading systems and found every one of them failed reproducibility along the same 5 axes:

1. **Data provenance** — which input record was on the table.
2. **Temporal split** — when the decision was made.
3. **Execution environment** — model + provider + runtime.
4. **Threshold configuration** — turnover / stop-loss / rebalance thresholds.
5. **Transaction cost** — fees, spreads, price/rate assumption bundles.

Shadow is not a trading system. Banking underwriting has the same axis structure with different content:

1. **Data provenance** → borrower snapshot at decision time.
2. **Temporal split** → decision timestamp.
3. **Execution environment** → LLM model + provider set + Node runtime.
4. **Threshold configuration** → LOAN_DEFAULTS (FICO/DTI/LTV/VaR) + reason-code dictionary + protected-class blocklist.
5. **Prompt configuration** → active persona prompts + evidence partition scheme + heterogeneity requirement.

## What v1.5.33 ships

Not a new signed field. All 5 axes are already covered by hashes bound in aex-attestation/v1 across v1.5.8/18/19/20/23/24/28/30/32. What v1.5.33 adds is a helper that COMPOSES the existing hashes plus runtime environment data into a single JSON block bank counsel can pin in one line of an exam workpaper.

- `lib/reproducibility.js` — new module.
  - `buildReproducibilityManifest({...})` — returns a canonical 5-axis JSON manifest with `manifest_hash_sha256` at the top level.
  - `manifestHash(manifest)` — SHA-256 hex over sorted-key canonicalization. Stable across environments.
  - `auditManifestCompleteness(manifest)` — verifies every declared axis has at least one populated sub-field. Bank counsel runs this to catch silent axis omission.
  - `REPRODUCIBILITY_AXES` — frozen array of the 5 axis names, imported by tests + docs to prevent drift.
- `test/reproducibility.test.js` — 13 contract tests. Axis structure (2), minimal + full manifest construction (2), provider sort (1), hash determinism + sensitivity (3), audit completeness (4), exam-workpaper end-to-end (1).

Test surface 1120 → 1133 (+13).

## The exam-workpaper use case

Bank counsel writing an exam workpaper on a specific decision today has to chase 8 separate hashes across the attestation object:

```
dictionary_hash                              (v1.5.8)
citation_registry_sha256                     (v1.5.18)
proxy_schema_sha256                          (v1.5.19)
original_content_hash                        (v1.5.20)
policy_invariance_score_sha256               (v1.5.23)
adverse_action_notice_sha256                 (v1.5.24)
sampling_seed_commitment_sha256              (v1.5.28)
evidence_partition_scheme_sha256             (v1.5.30)
heterogeneity_commitment_sha256              (v1.5.32)
```

That's 9 hex strings, each 64 chars, that must all match the archived signed values or the decision cannot be reproduced. Nine paste-and-diff operations per audit.

With the reproducibility manifest, bank counsel pins ONE value:

```
manifest_hash_sha256: 8c1a2e3f4a5b6c7d...
```

If any of the 9 underlying hashes changed post-decision, the manifest_hash no longer matches. If the manifest_hash matches, all 5 axes reproduce.

## Manifest shape

```json
{
  "spec_version": "shadow-reproducibility/v1",
  "anchor": "arXiv:2606.08285",
  "attestation_version": "aex-attestation/v1",
  "axes": {
    "data_provenance": {
      "borrower_snapshot_hash": "..."
    },
    "temporal_split": {
      "decision_timestamp_utc": "2026-07-08T20:00:00.000Z"
    },
    "execution_environment": {
      "model_id": "claude-sonnet-4-6",
      "providers_used_sorted": ["anthropic", "glm"],
      "node_version": "v20.10.0"
    },
    "threshold_configuration": {
      "dictionary_hash": "...",
      "loan_defaults_hash": "...",
      "citation_registry_hash": "...",
      "proxy_schema_hash": "..."
    },
    "prompt_configuration": {
      "persona_prompts_registry_hash": "...",
      "evidence_partition_scheme_hash": "...",
      "heterogeneity_commitment_hash": "..."
    }
  },
  "manifest_hash_sha256": "..."
}
```

## Wiring into `/api/deliberate` — deferred

The primitive ships in v1.5.33 as a helper. Wiring into the `/api/deliberate` response body as an opt-in `reproducibility_manifest` field is deferred to v1.5.34 so callers can flag-gate the transition. Bank counsel who wants the manifest today can call `buildReproducibilityManifest()` directly against an archived response object.

## Not a replacement for the attestation

The manifest is a convenience layer. It is NOT a replacement for the aex-attestation/v1 Ed25519 signature. The manifest itself is not signed. The manifest_hash is a fingerprint of the 5-axis input state at decision time. To verify a specific decision from the audit trail, bank counsel still needs the Ed25519 signature + public key + original request + original response. The manifest is what they pin in the workpaper instead of chasing 9 hashes.

## Related fields in aex-attestation/v1

See `docs/HETEROGENEOUS-DEBATE-ENFORCEMENT.md` § "Related v1.5.x fields already in aex-attestation/v1" for the full field table. Every field is signed via the append-only pattern. The manifest_hash pins their aggregate.
