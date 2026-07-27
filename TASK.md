# TASK-001 — Kimi Builder Prompt

## Council snapshot

- **Council commit:** `7f725134500f7e7a3239be9c472db1a16a74e5cd`
- **TASK-001 Builder:** Kimi 3 Code
- **TASK-001 Reviewer:** Claude Code (read-only)
- **Write lock:** `kimi`
- **Kimi worktree:** `~/Desktop/AI-Projects/shadow-council-worktrees/TASK-001-kimi-builder`
- **Baseline:** `84561ebfc90699bd2bbb514d96f25004f5b41709`
- **Repository:** `https://github.com/alex-jb/shadow-mentor.git`
- **Branch:** `fix/shadow-lens-approved-default-on-device-gate-kimi`

## Scope

Fix the fail-open multi-reviewer aggregation defect discovered as FINDING-C1.

## FORMAL SCOPE CLARIFICATION — FINDING-C1 IS NOW A REQUIRED SEVENTH ACCEPTANCE ROW, NOT AN OPTIONAL FINDING

Multi-reviewer decisions must never be resolved by reading only `reviewers[0]`.

### Required aggregation behavior

1. `approved` is permitted only when every valid reviewer decision is `approved`;
2. if any valid reviewer decision is `rejected`, the derived result must not be `approved` and should derive `rejected` unless an existing committed contract requires an explicit `conflict` state;
3. if no reviewer rejected but at least one valid reviewer decision is `modified`, derive `modified`;
4. missing, malformed, unsupported, or irreconcilable reviewer decisions must fail closed;
5. if the existing committed schema already supports an explicit `conflict` state, use it and preserve every reviewer decision;
6. if no explicit `conflict` state exists, do not invent a new contract enum inside this bounded task—derive `pending` while retaining the complete conflict evidence;
7. reviewer order must never change the result.

### Required regression tests

Add tests proving at minimum:

- `[approved, approved]` → `approved`
- `[approved, rejected]` → never `approved`
- `[rejected, approved]` → same result as `[approved, rejected]`
- `[approved, modified]` → `modified` or existing explicit conflict semantics
- `[approved, missing]` → `pending` / explicit conflict, never `approved`
- `malformed + approved` → fail closed, never `approved`
- reversing reviewer order produces the same result

### Constraints

- Inspect the existing committed contracts and consumers before selecting `rejected`, `pending`, `modified`, or an existing conflict status.
- Do not invent a new public schema or enum without explicit authorization.
- Record this as the accepted disposition of FINDING-C1 in `TASK.md` and `builder-report.md`.
- This seventh row is **acceptance-blocking**.

## Known defect locations

Pre-inspection identified at least:

- `apps/shadow-lens/backend/lens-api.mjs:146` — `reviewer_interaction` is built from `reviewers[0]` only.
- `apps/shadow-lens/backend/build-session.mjs:44` — `approved: true` is recorded as soon as any reviewer exists.
- `apps/shadow-lens/backend/build-session.mjs:80` — `human_review` becomes `"approved"` as soon as `reviewers.length > 0`.

The fix must introduce a fail-closed aggregation helper and route all multi-reviewer decisions through it.

## Deliverables

1. Implementation of fail-closed reviewer aggregation.
2. Regression tests for the aggregation matrix above.
3. Full test suite green.
4. One commit on the current branch.
5. Push the branch to `origin`.
6. `builder-report.md` documenting what changed, why, and the test evidence.

## Final return

When ready for review, return exactly:

```text
KIMI_BUILDER_READY_FOR_REVIEW

Full commit SHA:
<40-character SHA>
```

Do not return this until the real pushed commit SHA is known.

## Freeze rules

Until `KIMI_BUILDER_READY_FOR_REVIEW` is returned with a real full SHA:

- Terminal 3 remains frozen.
- Claude Terminal 1 does not start review.
- Old Claude Builder worktree is not touched.
- Control Plane does not register the final Lens pin.
- `shadow-platform` is not created.
