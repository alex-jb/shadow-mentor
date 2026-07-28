# Next Decision Implementation Increment

Status: discovery output. This is the exact, bounded next increment — NOT
started here. It requires its own explicit human approval before any work
begins (control-plane rule 10; gate precedent G7/G8).

## Increment name

**Core-owned signed decision-amendment successor packages (fixture mode, CLI
only) — `shadow-decision-amendment/1` + `shadow-portable-audit-package/1.2`.**

## In scope

1. `lib/decision-amendment.mjs` (new): schema constants, closed vocabularies
   (4 decision types, roles, reason codes, status tokens, failure tokens per
   `decision-failure-vocabulary.json`), canonical member
   assembly/validation, decision_id derivation.
2. `shadow-portable-audit-package/1.2` in `lib/portable-audit-package.mjs`:
   additive version gate; `decision` member role; rule "marker
   `DECISION_AMENDMENT` ⇔ decision member present"; mandatory capability
   tokens carried forward; 1.0/1.1 byte-paths untouched.
3. `shadow-package-supersession/1` marker enum: add `DECISION_AMENDMENT`;
   retarget (do not delete) the existing pinned test so `"APPROVED"` and all
   other non-neutral markers still fail to parse.
4. CLI: `bin/shadow-audit-package.mjs decide --supersedes <dir> --intent
   <decision-intent.json> --output-dir <dir>` (workflow Option A), template
   emitter `decide --template`, deterministic fixture identities and
   timestamps from intent input.
5. Lifecycle derivation: new pure function (beside, not inside,
   `verifyPackageChain`) implementing `decision-state-machine.json`,
   exposed via `verify-chain` output as a clearly-labeled derived view with
   the `DERIVED_FROM_LOCAL_SET` qualifier.
6. Tests per DECISION_TEST_STRATEGY.md sections 1–6 + acceptance net (section
   8). Golden fixtures added under the existing fixture tree.
7. Docs: contract, limitations, security-boundary, CLI, test-strategy, Web
   handoff — the same document set shape the supersession increment shipped.

## Out of scope (explicitly)

- Any Shadow Web change (drafting UI is the increment after, workflow
  Option B).
- Evidence contract changes (`shadow-evidence/v1` untouched; no new event
  types).
- Non-fixture signing, authentication, authorization backends, networking.
- Escalation-resolution wiring into `run-loan-council.js`.
- Countersignatures / multi-signature.
- Control-plane registration (happens at delivery time per registry rules,
  as a separate registration step with its own ADR).
- Fixing the known Lens `approved: true` hardcode (separate defect, separate
  increment; noted in EXISTING_DECISION_INVENTORY.md A1).

## Entry preconditions

- Human approval of this increment specifically.
- Base commit: `8fae7e7` (or its then-current descendant on
  `feat/shadow-portable-package-supersession`).

## Exit criteria

- All new tests green; entire existing suite green; 1.0/1.1 golden fixtures
  byte-identical.
- `decide` → `verify` → `verify-chain` round-trip reproducible offline with
  fixture keys only.
- No output string anywhere claims verified identity, verified authority,
  enforcement of separation of duties, production approval, regulatory
  status, or global latest.
- Diff contains no changes to `shadow-evidence/v1`, Web, Lens, Flow, or the
  control plane.

## Remaining unknowns (carried forward, do not resolve silently)

1. Whether `council_decision` target hashing uses the presentation member
   bytes, the evidence-carried result, or a canonical extract — must be
   pinned against real predecessor fixtures at implementation start.
2. Re-linearization amendment shape for fork recovery (multiple predecessor
   references) — deferred; first increment may ship with forks representable
   but not resolvable.
3. Production reason-code sets and redaction workflow (policy decisions).
4. Whether the provenance member's `member_contracts` map needs a 1.2 bump or
   stays additive — decide during implementation, additive preferred.
