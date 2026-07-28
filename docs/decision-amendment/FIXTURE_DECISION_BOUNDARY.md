# Fixture-Mode Decision Boundary

Status: discovery only. Defines what an honest fixture-mode implementation of
decision amendments may and may not claim.

## What fixture mode MAY support

| Capability | Honest form |
|---|---|
| Reviewer identity | Deterministic fixture identity: `actor_id` like `fixture:reviewer-1`, display name from fixture input. |
| Approver identity | Same pattern, distinct fixture actor. |
| Roles | Explicit operator-declared `role` values from the closed role set (`reviewer`, `approver`), marked `identity_class: operator_declared`. |
| Signing | Fixture-only Ed25519 keys, clearly labeled (`key_class: fixture`), same key hygiene as the existing package fixture signer (0600 private / 0644 public). |
| Reason codes | Synthetic closed reason-code set shipped with fixtures. |
| Timestamps | Deterministic, taken from fixture input files — never wall clock — so package bytes and IDs are reproducible. |
| Network / credentials | None. Fully offline. No env-var secrets required beyond the fixture key path. |
| Separation of duties | *Recorded* as a signed policy flag and *validated* against the declared policy (e.g. reject same-actor approve when the fixture declares enforcement). |

## What fixture mode MUST NOT claim

| Forbidden claim | Why | Required status token instead |
|---|---|---|
| Authenticated employee identity | No authentication exists. | `DECISION_IDENTITY_DECLARED_NOT_VERIFIED` |
| Real bank authorization | No authorization source exists. | `DECISION_AUTHORITY_UNVERIFIED` |
| Separation-of-duties *enforcement* | Only declared-policy validation exists; an operator can trivially declare two fixture actors that are one person. | `SEPARATION_OF_DUTIES_NOT_ENFORCED` (annotation, always present in fixture mode) |
| Production approval authority | Fixture approvals ratify nothing outside the demo. | `FIXTURE_DECISION_ONLY` |
| Real regulatory sign-off | Nothing here is a regulatory act. | covered by `FIXTURE_DECISION_ONLY` |
| Global decision registry completeness | Derivation is local-set-only by design. | `DERIVED_FROM_LOCAL_SET` |

## Exact status tokens (closed)

- `FIXTURE_DECISION_ONLY` — package-level: every decision amendment produced
  in fixture mode carries this token inside the signed payload, so it cannot
  be stripped without breaking the signature.
- `DECISION_IDENTITY_DECLARED_NOT_VERIFIED` — per-actor.
- `DECISION_AUTHORITY_UNVERIFIED` — per-actor.
- `SEPARATION_OF_DUTIES_NOT_ENFORCED` — per-decision annotation whenever the
  declared policy is not backed by an enforcement mechanism (always, in
  fixture mode).
- `DERIVED_FROM_LOCAL_SET` — qualifier on every effective-decision statement.

## Boundary rules

1. Fixture tokens live **inside the signed bytes**. Honesty labels that can be
   dropped in display code are not honesty labels.
2. A fixture decision package must verify with the same verifier as a future
   production package — the difference is annotations, not format.
3. The path from fixture to production identity is additive: a future
   `identity_class: authenticated` value plus external authorization evidence
   reference. No fixture field is redefined; fixture packages remain forever
   valid and forever labeled.
4. Web must render fixture tokens verbatim (see DECISION_WEB_HANDOFF.md) and
   never summarize `DECLARED_NOT_VERIFIED` as a checkmark.
