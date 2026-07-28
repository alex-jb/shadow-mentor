# Decision Amendment Limitations

Status: honest inventory of what this increment does NOT do.

## Fixture-mode limits (permanent until the named future work exists)

1. **No authenticated identity.** Actors are `fixture:<slug>` operator
   declarations. `identity_class` has exactly one legal value
   (`operator_declared`); `authenticated` is documented but unreachable.
2. **No authority verification.** `authorization.status` is pinned to
   `DECISION_AUTHORITY_UNVERIFIED`; `authorization_ref` is reserved (`null`).
3. **No organizational separation-of-duties enforcement.** Only a structural
   same-actor check against the declared signed policy.
4. **Fixture keys only.** Repo-committed key; anyone can sign; internal-
   consistency proof only. No production keys, rotation, revocation,
   transparency logs.
5. **No regulatory or business-correctness claim of any kind.**

## Scope limits of this increment

6. **`prior_decision` targets reach only the immediate predecessor's
   decision.** Deeper targets need chain context at decide time — a future
   increment.
7. **No re-linearization of forks.** Forks and conflicts are reported and
   displayed; no signed re-linearization amendment exists yet, so a forked
   case stays forked.
8. **No escalation resolution wiring.** `run-loan-council.js`'s `escalate`
   verdict remains a terminal council output; connecting it to decision
   amendments is future work.
9. **No evidence-event decision types.** `shadow-evidence/v1` is untouched;
   the `human_approval` event remains what it was. Decisions are packages,
   not events.
10. **No countersignatures / maker-checker signing.** One package signature;
    a countersigned decision member would be `shadow-decision-amendment/2`.
11. **No Web surface.** Shadow Web cannot draft, display, or import decision
    packages yet (DECISION_WEB_INTEGRATION_HANDOFF.md defines the path; no
    Web change ships here).
12. **Synthetic reason codes.** The closed fixture vocabulary is not a
    production taxonomy; production codes + redaction workflow are policy
    decisions.
13. **Decision successors duplicate unchanged analytical members** (by
    design, byte-for-byte). Member-reference optimization was explicitly
    deferred by the discovery.
14. **`REVIEW_REQUESTED` is unreachable** — the CLI records completed
    reviews only; review-request amendments are future vocabulary.
15. **Known pre-existing defect, out of scope:** Shadow Lens
    (`apps/shadow-lens/backend/build-session.mjs`) hardcodes
    `approved: true` / `human_review: "approved"` regardless of the actual
    reviewer decision. Documented in the discovery inventory; not fixed
    here (Lens is out of bounds for this increment).

## Rollback

The increment is additive. Full rollback = revert to `8fae7e7`:
1.0/1.1 packages, all existing CLI commands, and every existing test are
untouched, so reverting removes only the 1.2 contract, the `decide` command,
the decision libs/tests/docs. Already-generated 1.2 packages simply fail
version support on a rolled-back verifier (`UNSUPPORTED`) — they do not decay
into misleading partial successes.

## Remaining production requirements (unchanged from the discovery)

Production identity + authentication, external authorization records,
enforceable SoD, production key management (rotation / revocation /
transparency), production reason-code governance, redaction workflow,
backend/registry decisions, and regulatory review — all explicitly outside
Core fixture scope.
