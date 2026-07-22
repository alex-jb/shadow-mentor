# Attestation v1 signing-envelope ambiguity analysis

**Status:** CONFIRMED (reproduced from real signing bytes). **Fix:** the separate `aex-attestation/v2`
wire version. **v1 is not rewritten** — released v1 proofs stay byte-for-byte verifiable.

> Terminology: this doc is about the **wire version** (`aex-attestation/v1` vs `/v2`), which is what the
> signature covers. It is *not* the packaging/frozen-schema `schema_version` (currently `2.0.0`). Those are
> orthogonal — a proof carries both a `schema_version` and a wire `version`.

## Root cause

`aex-attestation/v1` (`packages/attest-core/attestation.js::_signingPayload`) signs a **delimiter-joined
value array**:

```
parts = [ version, mode, request_commitment, output_commitment, model_id,
          completed_at_utc, previous_hash || "", key_id ]
for each present binding:  parts.push(<hash value>)   // value only — NOT the binding name
signed_bytes = parts.join("|")
```

Because only **values** are joined with `"|"`, three structural facts are invisible to the signature:
field **names**, delimiter **boundaries**, and the difference between **null / empty / absent**.

## The three confirmed ambiguity classes

### 1. Optional-binding relabel — CONFIRMED
A binding's *name* is not signed, only its value. So the same hash under two different governance bindings
produces **identical** signing bytes:

```
{ dictionary_hash: H }            ─┐
{ citation_registry_sha256: H }   ─┴─►  same signature
```

An attacker (or a buggy pipeline) can present a proof as binding a *dictionary* when it was signed as
binding a *citation registry* — the crypto can't tell them apart. Characterization:
`test/legacy-v1-signing-ambiguity-characterization.test.js::V1-OPTIONAL-BINDING-RELABEL-CONFIRMED`.

### 2. Delimiter-boundary collision — CONFIRMED
`"|"` is both the delimiter and a legal character inside a value, so moving it across a field boundary
leaves `join("|")` unchanged:

```
model_id="claude|2026", completed_at_utc="2026-01-01T00:00:00Z"   ─┐
model_id="claude", completed_at_utc="2026|2026-01-01T00:00:00Z"   ─┴─►  same signature
```

Same failure across `previous_hash` / `key_id`. Characterization: the two
`V1-DELIMITER-COLLISION-CONFIRMED` cases.

### 3. null / empty / absent collapse — CONFIRMED
`previous_hash || ""` maps both `null` (chain head) and `""` to the same empty string; and a falsy binding
is *skipped*, so an absent binding and an empty-string binding sign identically:

```
previous_hash: null   ≡  previous_hash: ""          (both → "")
dictionaryHash absent ≡  dictionaryHash: ""         (both → skipped)
```

Characterization: the two `V1-NULL-EMPTY-ABSENT-AMBIGUITY-CONFIRMED` cases.

## Why v1 is left frozen

Rewriting v1's bytes would break every already-released proof and every distributed verifier. The fix is a
new wire version (`aex-attestation/v2`) that signs a **canonical named object**; existing v1 proofs keep
verifying under the unchanged v1 verifier and are labeled **`LEGACY_AMBIGUOUS_ENVELOPE`** in migration
tooling — they remain cryptographically valid but do not *unambiguously* prove which specific typed binding
a value was bound to.

## Impact / severity

- No key compromise. HMAC/Ed25519 primitives are unchanged and sound.
- The risk is **semantic**: a v1 proof does not unambiguously bind field identity. For a procurement /
  audit artifact whose whole value is "this exact typed commitment was signed," that is a real weakness.
- Fixed structurally in v2; see `ATTESTATION_ENVELOPE_V2.md`.
