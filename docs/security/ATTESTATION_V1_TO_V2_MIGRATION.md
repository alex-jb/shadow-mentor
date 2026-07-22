# Migrating attestation signing from v1 to v2

`aex-attestation/v2` is additive. **Nothing about v1 changes** — released v1 proofs keep verifying under the
unchanged v1 verifier. No key rotation is required. This doc is the operator playbook.

## TL;DR

- **New code:** call `signAttestation(...)` (defaults to v2) instead of `buildAttestation(...)`.
- **Verifiers:** call `verifyAttestationAny(att, keys, req?, res?)` — it routes by the proof's explicit
  `version` field. v1 proofs → v1 verifier; v2 proofs → v2 verifier.
- **Existing v1 proofs:** still valid, labeled `LEGACY_AMBIGUOUS_ENVELOPE` (below). Re-sign as v2 only if you
  need the stronger typed-binding guarantee.
- **Production:** set an explicit HMAC secret or use Ed25519/KMS — signing HMAC with the dev default now
  fails loud (`ERR_INSECURE_DEFAULT_SECRET`).

## Behavioral differences a caller will notice

| Aspect | v1 | v2 |
|---|---|---|
| Signed shape | delimiter-joined values | canonical named object |
| Field names in signature | no | **yes** |
| `previous_hash` chain head | `null` or `""` (collapse) | **`null` only** — `""` rejected |
| Empty-string binding | silently skipped | **rejected** (`ERR_V2_EMPTY_BINDING`) — omit the key instead |
| Unknown binding | silently appended by value | **rejected** (`ERR_V2_UNKNOWN_BINDING`) |
| `model_id` / `key_id` | any string | printable ASCII, ≤200, no control chars |
| `completed_at_utc` | any string | RFC 3339 UTC, normalized to `…Z` |
| Malformed input | may still sign | **throws before signing** |

If you currently pass `previous_hash: ""` for a chain head, switch to `null`. If you pass a binding as `""`
to mean "not bound," omit the key.

## `LEGACY_AMBIGUOUS_ENVELOPE` label

Migration/inventory tooling labels every v1 proof `LEGACY_AMBIGUOUS_ENVELOPE`. Meaning: the signature is
cryptographically valid, **but** because v1 does not sign field/binding names, delimiters, or null/empty
distinctions, the proof does not *unambiguously* establish which specific typed binding a value was bound
to. Treat it as "signed and untampered" but not as "unambiguous typed commitment." v2 proofs carry no such
label.

## Rollout sequence (suggested)

1. Deploy the code (v2 available; v1 untouched). No behavior change yet.
2. Point new signing paths at `signAttestation` / `buildAttestationV2`. Existing fixtures untouched.
3. Switch verifiers to `verifyAttestationAny` so both versions verify during the overlap.
4. Configure the production HMAC secret (or Ed25519/KMS) so the guard passes in prod.
5. Optionally re-issue high-value legacy proofs as v2 to shed the `LEGACY_AMBIGUOUS_ENVELOPE` label.

## What did NOT change

- v1 signing bytes and v1 verification (pinned by `test/attestation-v1-backcompat-fixtures.test.js`).
- Crypto primitives (HMAC-SHA256, Ed25519).
- The chain-hash / bundle / anchoring APIs.
- Stable APK / Unity runtime / frozen verifier artifacts.
