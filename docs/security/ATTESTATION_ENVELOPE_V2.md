# aex-attestation/v2 — unambiguous named-envelope format spec

The `aex-attestation/v2` wire version signs a **canonical named object**, removing all three confirmed v1
ambiguities (`ATTESTATION_V1_AMBIGUITY_ANALYSIS.md`). Source: `packages/attest-core/attestation-v2.js`.

> Not to be confused with `schema_version 2.0.0` (packaging/frozen-schema). This is the **wire** version —
> the thing the signature covers.

## The signed object

The signed bytes are the **UTF-8 of the canonical (sorted-key) JSON** of this object — the same
`canonicalize()` used for v1's request/output commitments, so Node / browser / C# reproduce identical
bytes.

```json
{
  "algorithm": "hmac-sha256",
  "bindings": { "citation_registry_sha256": "…", "dictionary_hash": "…" },
  "completed_at_utc": "2026-01-02T03:04:05.000Z",
  "domain": "shadow-attestation",
  "key_id": "shadow-prod-2026-q1",
  "model_id": "claude-opus-4-8",
  "output_commitment": "…64-hex…",
  "previous_hash": null,
  "request_commitment": "…64-hex…",
  "wire_version": "aex-attestation/v2"
}
```

### What is signed and why it fixes v1

| Property | Type / rule | Fixes |
|---|---|---|
| `domain` | constant `shadow-attestation` | cross-protocol replay separation |
| `wire_version` | constant `aex-attestation/v2` | version cannot be swapped under the signature |
| `algorithm` | `hmac-sha256` \| `ed25519` | algorithm is inside the bytes (no downgrade) |
| `request_commitment` / `output_commitment` | lowercase 64-hex (`/^[0-9a-f]{64}$/`) | strict hash shape |
| `model_id` / `key_id` | printable ASCII, ≤200, no control/Unicode, no trim | **delimiter collision gone** (names signed, no join char) |
| `completed_at_utc` | RFC 3339 UTC, normalized once to `…Z` | boundary + format drift gone |
| `previous_hash` | **`null`** (chain head) or a hash — **never `""`** | **null/empty collapse gone** |
| `bindings` | object of *named* known bindings → hash; unknown keys **fail closed**; no `null`/`""` values | **relabel + absent/empty collapse gone** |

Field **names** and binding **names** are literally in the signed bytes (proven by `V2-NAMED-ENVELOPE` and
the golden parity test), so relabeling any field changes the signature. There is **no delimiter**, so no
boundary collision. `canonicalize` emits `null` distinctly and omits absent keys, so null / empty / absent
are three different byte sequences — and empty-string values are rejected before signing.

## Canonical byte rules (cross-runtime contract)

1. Object keys are sorted lexicographically (UTF-16 code unit == ASCII ordinal for all v2 keys).
2. `bindings` is a nested object, keys also sorted; `{}` when there are none.
3. Values are strings or the single literal `null`. No numbers, no arrays, no other nesting.
4. All strings are constrained to printable ASCII / lowercase-hex / RFC 3339, so escaping is minimal and
   identical across `JSON.stringify`, `System.Text.Json`, and a hand serializer.

The committed golden vector `packages/attest-core/golden/v2-golden-vectors.json` is the byte-for-byte
contract; `test/attestation-v2-golden-parity.test.js` (Node) and `packages/attest-core/csharp-parity/`
(C#) both reproduce it.

## Strict schema (fail before signing)

`buildV2Envelope` validates every field and throws `AttestationV2Error` with a stable `code`
(`ERR_V2_BAD_HASH`, `ERR_V2_BAD_TIMESTAMP`, `ERR_V2_BAD_IDENT`, `ERR_V2_BAD_PREVIOUS_HASH`,
`ERR_V2_UNKNOWN_BINDING`, `ERR_V2_NULL_BINDING`, `ERR_V2_EMPTY_BINDING`, `ERR_V2_BAD_ALGORITHM`) — malformed
input never reaches the signer. Prototype-pollution binding keys (`__proto__`/`prototype`/`constructor`)
are rejected.

## Production default-secret guard (§9)

`assertSecureSecret` throws `ERR_INSECURE_DEFAULT_SECRET` when signing HMAC in production
(`NODE_ENV==="production"` or `SHADOW_ENV==="production"`) with the dev default or no secret. Ed25519 (no
shared secret) and any explicit secret are allowed. Dev/test keep the default so fixtures work. The error
message never contains the secret value.

## API

- `signAttestation(params)` — **preferred** entry for new code; defaults to v2.
- `buildAttestationV2(params)` / `verifyAttestationV2(att, keys)` — explicit v2.
- `verifyAttestationAny(att, keys, req?, res?)` — routes by the explicit `version` field (v1 → v1 verifier,
  v2 → v2 verifier, unknown → fail closed). No heuristic detection.
- `buildAttestation` (v1) is unchanged and still available for deliberate legacy proofs.
