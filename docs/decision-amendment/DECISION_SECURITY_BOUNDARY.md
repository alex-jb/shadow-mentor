# Decision Security Boundary

Status: IMPLEMENTED (fixture mode). What the decision-amendment increment
proves, what it detects, and what it deliberately cannot claim.

## Role separation (never collapsed)

| Role | Identified by | NOT identified by |
|---|---|---|
| Package signer | fixture key label + SPKI fingerprints in `manifest.signing` | any actor field |
| Decision actor | `actor` block inside the signed decision member | the signing key — **an Ed25519 key identifies a signer, never a reviewer** |
| Decision authority | nothing (fixture mode) — `authorization.status` is pinned to `DECISION_AUTHORITY_UNVERIFIED` | signature validity, role strings, display names |
| Verifier / importing operator | not represented in artifacts | — |

## What a valid decision package proves

- The decision bytes (actor assertion, reason, target hashes, policy flags,
  honesty tokens) are exactly what the fixture key signed — tamper-evidence.
- The decision is bound to one predecessor (package id + manifest sha256 over
  file bytes incl. signature), one case, one evidence session, and one target
  object hash. Splices, substitutions and cross-case replays break a binding
  check (`DECISION_TARGET_MISMATCH`, `TARGET_OBJECT_MISMATCH`,
  `CASE_MISMATCH`, `SESSION_MISMATCH`, `SUPERSESSION_MALFORMED`).
- Post-signing edits are detected: byte edits break member hashes
  (`TAMPERED`) or the manifest signature; coherent re-forges that keep the
  old `decision_id` fail re-derivation (`DECISION_MALFORMED`).

## What it can NEVER prove (signed into every decision as status tokens)

- **Actor authentication** — `DECISION_IDENTITY_DECLARED_NOT_VERIFIED`:
  fixture actors are operator-declared strings.
- **Decision authority** — `DECISION_AUTHORITY_UNVERIFIED`: no authorization
  source exists; `authorization_ref` is reserved (`null`) for a future one.
- **Separation-of-duties enforcement** — `SEPARATION_OF_DUTIES_NOT_ENFORCED`:
  the same-actor check is structural, against the DECLARED signed policy
  only. An operator can trivially declare two fixture actors that are one
  person. Organizational SoD enforcement is never claimed, including in the
  violation message itself.
- **Production decision semantics** — `FIXTURE_DECISION_ONLY`.
- **Analytical/business correctness, regulatory sign-off, global latest** —
  the decision boundary statement + `SUPERSESSION_IS_NOT_GLOBAL_LATEST` +
  `DERIVED_FROM_LOCAL_SET`.

These tokens live INSIDE the signed member bytes: stripping them breaks the
signature. Display layers cannot remove them without producing a package that
fails verification.

## Known limitation (inherited, documented)

Fixture keys are repo-committed and public by design: a fixture-key holder
can forge a *coherent* decision package — consistent bindings, re-derived
decision_id, valid signature. The verifier detects every broken binding, not
a dishonest signer. This is the documented key-compromise limitation of the
whole fixture evidence stack (PACKAGE_SUPERSESSION_SECURITY_BOUNDARY.md) and
is unchanged here; production keys, rotation, revocation and transparency
logs remain explicitly out of scope.

## Offline + key hygiene

No network, no credentials, no env-var secrets in the entire decide/verify
path (test-pinned with a bare `PATH`-only environment). The private key is
never written, printed, packaged, or echoed into errors; the assembly privacy
gate additionally rejects any member matching private-key or credential
patterns — including operator-authored reason text.
