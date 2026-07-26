# Decision Contract Recommendation

Status: discovery only. Machine-readable form:
`decision-contract-decision.json`.

## Architecture decision

**NEW_DECISION_MEMBER_IN_PACKAGE_VERSION_RECOMMENDED** (Option B).

A decision amendment is an immutable successor package on a new additive
package version `shadow-portable-audit-package/1.2` that:

1. carries a new signed member `decision/decision-amendment.json` with role
   `decision` and its own contract `shadow-decision-amendment/1`
   (content per DECISION_TARGET_AND_AMENDMENT_CONTENT.md);
2. reuses the existing `shadow-package-supersession/1` relation and predecessor
   binding unchanged, adding exactly one new marker value,
   `DECISION_AMENDMENT` — the marker stays a neutral chain-layer label; all
   decision semantics live in the member;
3. binds the member through the existing signed manifest `assets[]` hash
   mechanism — no new signing system, no second envelope;
4. carries the fixture honesty tokens (`FIXTURE_DECISION_ONLY`, identity/
   authority annotations) inside the signed member bytes;
5. must declare the existing mandatory capability tokens plus
   `SUPERSESSION_IS_NOT_GLOBAL_LATEST` (1.1 rule carried forward to 1.2).

## Why this and not the alternatives

- The Core supersession ADR already reserved exactly this slot ("a
  review/approval package is just a future successor with a new relation
  value in the same signed slot") — Option B honors the reservation while
  keeping the marker semantics-free, avoiding marker↔member drift by having
  only one place (the member) where decision type exists.
- Manifest stays pure integrity (rejects Option A); the package boundary stays
  the portability boundary (rejects Option C); required fields — actor,
  reason, target hash — need a payload, which markers cannot carry (rejects
  Option D); sealed bundles and the frozen event enum cannot host post-hoc
  decisions (rejects Option E).
- Web consumption is the smallest possible delta on the existing member-and-
  timeline model, and the four-vocabulary discipline gains a fifth disjoint
  vocabulary rather than mutating any existing one.

## Contract boundaries created

| Contract | Owner | Change in this architecture |
|---|---|---|
| `shadow-portable-audit-package/1.2` | Core | New additive version: permits the `decision` member role; requires it when `supersedes.marker == "DECISION_AMENDMENT"`; 1.0/1.1 untouched. |
| `shadow-package-supersession/1` | Core | **Unchanged structure.** Marker enum gains `DECISION_AMENDMENT` (the deliberately pinned rejection test for non-neutral markers is superseded in the same increment, with the pin retargeted to still reject `"APPROVED"` etc.). |
| `shadow-decision-amendment/1` | Core (new) | The decision member schema: target, decision payload, actor, policy flags, status tokens, closed reason codes. |
| `shadow-evidence/v1` | Core | **Unchanged** (hard boundary of this task and of the recommendation). |
| Control-plane registry | control plane | Future: new row for `shadow-decision-amendment/1` + registry row update for the package 1.2 version + a new ADR, per registry rules 2–3. Registration only — not part of the Core increment. |

## Consequences accepted

- Two schemas evolve independently (package version vs decision schema); the
  registry's one-row-per-version discipline covers both.
- A decision successor duplicates predecessor members it does not change
  (presentation/evidence re-carried per current successor behavior). Accepted
  for the first increment; member-reference optimization is explicitly out of
  scope and would be its own discovery.
- The chain layer remains unaware of decision semantics; lifecycle derivation
  is a new pure function over (chain result + decision members), placed beside
  — not inside — `verifyPackageChain`.
