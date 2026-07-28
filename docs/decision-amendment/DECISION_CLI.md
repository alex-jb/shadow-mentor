# Decision CLI — `shadow-audit-package decide`

Status: IMPLEMENTED (fixture mode). Source: `bin/shadow-audit-package.mjs`.
The existing `create`, `verify` and `verify-chain` commands are preserved
unchanged; `verify-chain` gains a decision-lifecycle report when 1.2 packages
are supplied (its JSON output for sets WITHOUT decision packages is
byte-compatible with the pre-1.2 shape).

## Command

```
node bin/shadow-audit-package.mjs decide \
  --predecessor <prior-package-directory> \
  --intent <decision-intent.json> \
  --output-dir <new-package-directory> \
  [--built-at <iso8601>] [--build-commit <sha>] [--force] [--json]
```

Exit codes: `0` ok · `2` usage · `3` input/I-O error (invalid intent, invalid
predecessor, unsupported transition, SoD violation) · `4` assembled package
failed self-verification (nothing is written).

## What one `decide` run does, in order

1. Validates the unsigned intent strictly (DECISION_INTENT_CONTRACT.md).
2. Verifies the predecessor package independently; refuses invalid or
   unsupported predecessors (`PREDECESSOR_INVALID`). The predecessor is
   read-only and never mutated — `--output-dir` may not equal
   `--predecessor`, not even with `--force`.
3. Checks the lifecycle transition against the predecessor's decision state
   (fail-closed; DECISION_LIFECYCLE_DERIVATION.md).
4. Derives the target: re-derives the council-decision extract from the
   predecessor's presentation member, or hashes the predecessor's decision
   member for `prior_decision` targets.
5. Applies the separation-of-duties structural check against the declared
   policy (DECISION_SECURITY_BOUNDARY.md — enforcement is never claimed).
6. Generates the signed decision member field-by-field, derives
   `decision_id`, self-validates it.
7. Assembles the 1.2 successor: analytical members carried byte-for-byte,
   new provenance/1.2 + decision members, signed manifest with marker
   `DECISION_AMENDMENT`.
8. Writes atomically (temp dir → rename), then independently re-verifies the
   finished package, the predecessor→successor chain link, AND the derived
   lifecycle. Any failure deletes the temp dir — no partial package survives.

Determinism: identical inputs (same predecessor bytes, intent, `--built-at`,
`--build-commit`) produce byte-identical packages. `--built-at` defaults to
the intent's `decided_at_utc` — never wall clock.

Offline: no network, no credentials, no env-var secrets. The fixture private
key is read from the committed fixture-key module and is never written,
printed, or packaged.

## Example fixture flow (see DECISION_FIXTURE_RUNBOOK.md for the full arc)

```
node bin/shadow-audit-package.mjs create --fixture banking --output-dir A
node bin/shadow-audit-package.mjs decide --predecessor A \
  --intent test/fixtures/decision/review-override-proposed.intent.json --output-dir B
node bin/shadow-audit-package.mjs verify --package B
node bin/shadow-audit-package.mjs verify-chain --package A --package B
```

`decide --json` reports: package identity, the `supersedes` binding, the
decision summary (id, type, actor, role, `identity_class`, target, status
tokens) and the derived lifecycle `{state, effective_disposition, qualifier:
"DERIVED_FROM_LOCAL_SET"}` on stdout only.
