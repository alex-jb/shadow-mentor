# Reason-code dictionary hash → attestation binding

The core moat question: **can an auditor verify that the reason shown today is the same versioned reason
definition that was bound to the original decision?** A human-readable reason string is not authoritative
by itself — it can be silently rewritten. Binding it to a hashed, versioned dictionary makes a swap
detectable. Explainer: `demos/animations/reason-code-attestation.html`; fixture:
`fixtures/animations/reason-code-attestation.json`; tests: `test/reason-code-attestation.test.js`.

## The distinct concepts (do not conflate)
- **reason-code identifier** — e.g. `RC-017`. A pointer, not the meaning.
- **reason-code dictionary** — the versioned map from id → title + definition.
- **dictionary version** — e.g. `v3`. A new definition set requires a new version.
- **canonical dictionary bytes** — the dictionary serialized deterministically (sorted keys), `shadow-canon/1`.
- **dictionary hash** — SHA-256 of the canonical bytes. Changes if *any* definition changes.
- **selected reason codes** — the ids the decision cited (`RC-017`, `RC-021`).
- **evidence references** — the evidence ids each code points to (`B0L1`…).
- **attestation** — the signed record binding: dictionary id/version/hash, selected code ids, evidence
  references, decision sequence, signer fingerprint.
- **independent verification** — a verifier that *recomputes* the hash and *rechecks* the bindings, not
  one that trusts the displayed text.

## Verification procedure
1. Load the dictionary (from an independent copy, not the display).
2. Canonicalize → recompute SHA-256.
3. Compare recomputed hash to `attestation.dictionary_hash` (and version to `attestation.dictionary_version`).
4. Check each selected code exists in the dictionary.
5. Check each selected code is in `attestation.selected_reason_codes` (bound).
6. Check each selected code's evidence references resolve.
7. Keep the attestation signature and record integrity as **independent** checks.

## Tamper cases (each fails a *specific* check; others stay independent)
| tamper | first failed check | stays VERIFIED (independent) |
|---|---|---|
| **Dictionary text modified** (change RC-017's definition after signing) | `DICTIONARY_HASH` (recomputed ≠ bound) | signature (over the original attestation), reason binding, evidence |
| **Reason code replaced** (RC-017→RC-009 in the display) | `REASON_CODE_EXISTS` (not in dictionary) + not bound | dictionary hash, evidence |
| **Evidence reference removed** | `EVIDENCE_REFERENCES` | dictionary hash, version, signature |
| **Dictionary version changed** (v3→v4) | `DICTIONARY_VERSION` | reason code exists (a similar id does not bypass version binding) |
The UI marks the **FIRST FAILED** check vs **DOWNSTREAM** failures (e.g. record integrity fails *because*
a specific check failed).

## Trust boundary — what it does NOT prove
A matching hash + valid binding proves the reason **text/version wasn't swapped** and the code is **bound**.
It does **not** prove the reason is **adequate**, **fair**, **legal**, or **analytically correct** — those
stay `NOT EVALUATED`. The verifier never emits `TRUSTED` or `COMPLIANT`. The signer fingerprint must still
be cross-checked from an independent channel. A label alone is never sufficient evidence.

## Limitations
Demonstration fixture only — **not** production bank policy or regulatory language. The signature check in
the explainer is illustrative (the point is that it stays *independent* of a display-side tamper).

## Integrating with banking-v1 (later)
`banking-v1` already emits AA/reason codes + a reason-code dictionary and Ed25519 attestation (`lib/` +
`docs/CITATION_MAP.md`). Integration = have the loan council bind `dictionary_id/version/hash + selected
codes + evidence refs + decision sequence` into the attestation, and have `verify.html` run exactly this
recompute + rebind procedure. **A dictionary update requires a new version + a new hash** — you cannot
edit a definition in place without breaking every prior attestation that bound the old hash (which is the
protective property).
