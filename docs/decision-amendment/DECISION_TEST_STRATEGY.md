# Decision Test Strategy

Status: discovery only. Test design for the future implementation increment;
no tests are implemented here. Follows the existing Core patterns: closed
vocabularies asserted exhaustively, mutation matrices per binding, golden
fixtures with deterministic bytes, one wrapping acceptance test.

## 1. Contract tests (`shadow-decision-amendment/1`)

- Canonical amendment: golden fixture round-trips; byte-identical re-assembly
  from identical inputs (determinism pin, mirroring the existing package CLI
  determinism tests).
- Deterministic serialization: key order, NFC normalization, `-0`/number
  formatting caveats inherited from `shadow-canon/1` — pinned explicitly.
- Version compatibility: 1.0 and 1.1 packages remain byte-identical and
  verify unchanged (regression net); a 1.2 package without a decision member
  but with marker `DECISION_AMENDMENT` fails; a 1.2 decision member under
  marker `FIXTURE_SUCCESSOR` fails.
- Unknown fields: closed key sets — unknown key in decision member, target
  block, actor block, or policy block → `DECISION_AMENDMENT_MALFORMED`.
- Missing fields: each required field removed one at a time → deterministic
  single failure code.
- Size bounds: each bounded text field at bound, bound+1 byte (UTF-8
  multi-byte edge: a character straddling the byte bound) →
  `DECISION_SIZE_BOUND_EXCEEDED`.
- Unicode: NFD input normalized or rejected per contract; BOM rejected;
  control characters (other than \n, \t) → `DECISION_TEXT_UNSAFE`.
- Unsafe strings: `<script>`, RTL-override characters, null bytes — contract
  verdicts pinned (only control chars fail; markup is valid *text*).

## 2. Target binding tests (mutation matrix, mirrors chain-parity style)

Each row = one mutation of a golden valid amendment → expected failure:

| Mutation | Expected |
|---|---|
| Wrong predecessor package ID | `TARGET_PACKAGE_MISMATCH` |
| Whitespace-reformatted predecessor manifest | `TARGET_PACKAGE_MISMATCH` (strictest-binding pin carried over) |
| Wrong manifest hash, right ID | `TARGET_PACKAGE_MISMATCH` (distinguished detail) |
| Wrong case | `CASE_MISMATCH` |
| Wrong session | `SESSION_MISMATCH` |
| Wrong target object hash | `TARGET_OBJECT_MISMATCH` |
| Substituted Council result in predecessor copy | `TARGET_OBJECT_MISMATCH` |
| Same decision member spliced into another case's package | `CASE_MISMATCH` (and signature failure if manifest not re-signed) |
| Replay: identical bytes, different predecessor | different derived decision_id; binding checks fire |
| Duplicate decision ID, different bytes | `DUPLICATE_DECISION` |
| Duplicate decision ID, identical bytes | idempotent duplicate (no failure) |

## 3. Actor / authority tests

- Missing actor block → `ACTOR_MISSING`.
- Operator-declared fixture actor verifies, carries
  `DECISION_IDENTITY_DECLARED_NOT_VERIFIED` annotation in output.
- Role outside {reviewer, approver} → `ACTOR_ROLE_UNSUPPORTED`.
- Same `actor_id` on review and approval with declared
  `separation_of_duties: "enforced"` → `SEPARATION_OF_DUTIES_VIOLATION`
  (approval has no lifecycle effect; package integrity unaffected — assert
  both halves).
- Same actor with declared `not_enforced` → valid, annotation
  `SEPARATION_OF_DUTIES_NOT_ENFORCED` present.
- Authority always `DECISION_AUTHORITY_UNVERIFIED` in fixture mode — assert
  the annotation cannot be absent.
- Changed actor after signing (byte edit) → member hash mismatch →
  `DECISION_PACKAGE_TAMPERED`.

## 4. State machine tests (pure derivation function)

Valid paths: review-completed (both outcomes), no-change review, override
proposal, override with approval-not-required policy, approval of pending
override, direct approve-as-is, rejection of proposal, rejection after
approval (supersedes), superseding an approved decision with a new review.

Rejected paths: approval with no qualifying review under
`review_required: true` → `UNSUPPORTED_TRANSITION`; override without reason →
`REASON_MISSING`; unsupported reason code → `REASON_CODE_UNSUPPORTED`.

Conflict/fork: two amendments sharing one predecessor → `FORKED`, no
effective decision, both heads reported; conflicting approvals →
`CONFLICTING_DECISION`, no timestamp tiebreak (assert timestamps are ignored
by feeding contradictory `decided_at_utc` orderings).

Determinism: permutation test — every import order of N amendments yields
identical derived state (existing chain idempotence pattern).

## 5. Package chain tests

- Predecessor retained byte-identical after decision successor creation
  (existing immutability pin extended).
- Decision successor independently valid as a standalone package.
- Missing predecessor → `PREDECESSOR_NOT_SUPPLIED`; amendment excluded from
  lifecycle; displayed as orphan.
- Broken decision link / cycle → existing `CHAIN_BROKEN` / `CHAIN_CYCLE`
  reused; decision lifecycle derives nothing across broken links.
- Decision fork → `CHAIN_FORK` + lifecycle `FORKED`.
- Local effective-decision derivation qualified `DERIVED_FROM_LOCAL_SET`;
  assert no output string claims global latest (grep-style assertion over
  emitted text, mirroring the existing boundary-statement pins).

## 6. Security tests

- Tampered reason / actor / target (single-byte member mutations) →
  `DECISION_PACKAGE_TAMPERED` (via member hash), never a partially-applied
  decision.
- Wrong key → `MANIFEST_SIGNATURE_FAILED` (existing code reused).
- Private key absent → creation fails with input error; verification
  unaffected (public key only).
- No network / no credentials: tests run hermetically; assert no env-var
  secrets are read (existing fixture-key pattern).
- Unsafe HTML rendered as text: Web-side XSS canary extended with a decision
  member containing `<img onerror>` in reason_text (existing canary pattern).

## 7. Web handoff tests (future Web increment, designed now)

- Unsigned draft never displayed as approved: draft store and lifecycle chips
  are disjoint components; test asserts draft objects cannot reach the
  timeline reducer.
- Signed decision package displayed distinctly from drafts and from
  non-decision successors.
- Actor identity status chip always rendered verbatim; snapshot pins the
  absence of checkmark iconography for `DECLARED_NOT_VERIFIED`.
- Authority-unknown chip visible in default and high-contrast profiles (a11y
  contrast floors reused).
- Conflicting branches: both rendered; no auto-selection; e2e mirrors the
  existing fork spec.

## 8. Acceptance net

One wrapping demo test (pattern: existing attestation acceptance demo) that
creates package → decision successor → verifies chain → derives lifecycle →
asserts the full expected state and every honesty token, failing with the
exact step number on any regression.
