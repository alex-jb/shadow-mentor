# Package security boundary (implementation deltas)

`PACKAGE_SECURITY_MODEL.md` is the discovery-time model. This file records
what the fixture-mode implementation actually enforces and what stays open.

## Signed bytes

Exactly one signature: Ed25519 over
`canonicalize(manifest minus signature)` under `shadow-canon/1` — the
`verify/verify-manifest.mjs` precedent, reused. Every member is bound
transitively via `assets[]{path, role, schema_version, byte_size, sha256}`.
Nothing in the package sits outside the signature: two-way completeness
rejects both missing and undeclared files.

## Keys

- Package manifest signing: the repo-committed **FIXTURE RELEASE KEY**
  (`verify/fixture-release-key.mjs`) — deliberately public, demo-labeled,
  deterministic. `key_provenance: "fixture"` is inside the signed bytes and
  the verifier reports `VERIFIED_FIXTURE_KEY`, never plain `VERIFIED`.
- Because the fixture private key is public, a fixture package's signature
  proves **internal consistency only**. The binding checks (package_id
  re-derivation, case↔session consistency, member-hash agreement) are what
  catch re-signed substitutions — this is test-pinned with an
  attacker-holds-the-fixture-key model.
- Private keys are never generated, persisted, printed, or packaged by this
  CLI. Tests scan every member, stdout and stderr for `PRIVATE KEY`.
- Embedded public keys support tamper-evidence only; key-identity trust
  requires out-of-band fingerprint comparison (full-length SHA-256 SPKI
  fingerprints are in the signed manifest for exactly that comparison).

## Resolved vs explicitly scoped out (from PACKAGE_CONTRACT_GAP.md §Cross-cutting)

| Gap | Status in this increment |
|---|---|
| case_id ↔ session_id binding missing | **RESOLVED** — created by the signed manifest (`bindings`), not by changing any member schema |
| Two-way completeness missing | **RESOLVED** — implemented + test-pinned |
| Business first-failure / downstream missing | **UNCHANGED by design** — never synthesized; honest absence preserved |
| Event enum drift (13 vs 18) | **SCOPED OUT** — evidence bytes pass through untouched; `verifyBundle` (which does not schema-validate) is the verification authority, as today |
| Attestation `version` vs `spec_version` drift | **SCOPED OUT** — the attestation member is bound by hash and checked against the code's `version` field; the schema drift is not silently repaired |
| Anchor kind / `anchor_errors` drift | **SCOPED OUT** — anchors ride inside the evidence bundle unchanged |
| Raw-seed base64 vs hex drift | **NOT TOUCHED** — this CLI only consumes PEM keys |
| Tool version provenance missing | **UNCHANGED** — no field exists in Core; not invented here |
| HMAC artifacts | **REJECTED** — `NOT_PORTABLE` at create and verify |
| Payload contents in packages | **DEFAULT NO** (discovery precondition 2) — the reference payload file is deliberately not packaged; hash-bound payloads stay out |
| `identity_ref` | **FLAG-GATED, default off** — create refuses evidence with a non-null `identity_ref` unless `--allow-identity-ref` |

## Non-claims (unchanged from discovery)

No production-security claim. Fixture keys, no key-identity PKI, no
revocation/expiry/CRL/OCSP, no rotation, single-signature bundle
verification (`signatures[0]`), `shadow-canon/1` `-0`/number caveats, and
the attestation untagged-append weakness all remain open and documented.
A valid package signature never implies business correctness, Flow vendor
import success, native Shadow Lens behavior, or physical XR capability.
