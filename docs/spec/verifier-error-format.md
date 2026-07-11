---
title: Verifier structured-error format
status: DRAFT — design frozen 2026-07-11, implementation scheduled 2026-07-17 (Thu, day after Wed demo)
depends_on: v3 M3 complete
enables: v3 M5 replay demo (X5 caption pipeline)
authors: Alex Ji + autonomous session 2026-07-11
---

# Verifier structured-error format

Every verification failure emitted by `shadow-attest-core`, the `shadow-verify`
CLI, and `verify.html` MUST be a structured object with the exact shape:

```typescript
type VerifierError = {
  seq: number | null;      // event index at which the failure was detected, or null if pre-event
  reason: string;          // machine-readable code (snake_case, stable across versions)
  impact: string;          // human sentence, safe for auditor consumption
};
```

The XR replay demo (`SHADOW_XR_DEMO_BRIEF.md` §X5) reads this shape verbatim
for floating captions. `verify.html` renders all three fields in its report.
The CLI prints all three fields.

Drift between surfaces is caught by `test/verifier-error-format.test.js`
(to be added during implementation).

---

## Why now, why Thursday

Alex's execution ordering (2026-07-11):

1. This spec is designed and committed BEFORE Wed 2026-07-16 so the shape is
   locked and everyone builds against it.
2. Implementation is scheduled for Thu 2026-07-17 — after the Wed demo path
   unfreezes (rule 3 sunset). Doing it before Wed violates rule 3 because
   `verify.html` is on the freeze list and this refactor touches its error
   rendering.
3. M5 replay demo work starts the following weekend consuming this format;
   doing M5 first would force a rewrite when the format lands.

M5 depends on this. Do NOT start M5 without this in place.

---

## The three fields

### `seq`

- The 0-based event index at which the failure was detected.
- `null` when the failure predates the event chain (e.g. bad signature on
  the batch root, bad header hash, malformed bundle envelope).
- `null` is not "unknown" — it means the failure is at the bundle level,
  not an event level.

### `reason`

Stable machine-readable code. New codes may be added; existing codes may
NOT change meaning. Enum, `snake_case`. Consumers should treat unknown
codes as generic-fail without crashing.

The port from the current ad-hoc strings should produce the following
initial code set. This list is the source of truth for
`test/verifier-error-format.test.js`:

| Code | Where thrown | seq semantics |
|---|---|---|
| `bundle_missing` | `verifyBundle` when `bundle` is not an object | null |
| `bundle_unsupported_version` | `bundle_version` != 2 | null |
| `events_not_array` | `bundle.events` not an array | null |
| `signatures_missing` | no `signatures[]` | null |
| `signatures_unsupported_algorithm` | `signatures[0].algorithm` != "ed25519" | null |
| `signature_verification_failed` | Ed25519 verify returned false | null |
| `header_hash_mismatch` | seed hash of header does not match `events[0].prev_hash` | 0 |
| `seq_gap` | `events[i].seq !== i` | i |
| `prev_hash_mismatch` | event chain break | i |
| `event_hash_mismatch` | recomputed event hash doesn't match | i |
| `payload_hash_mismatch` | referenced payload doesn't hash to declared value | i |
| `batch_root_mismatch` | Merkle root of event hashes doesn't match `bundle.batch_root` | null |
| `public_key_missing` | verifier called without a public key | null |
| `anchor_kind_unsupported` | unknown `external_anchors[i].kind` | null (or i in the anchors array — see note) |
| `anchor_message_imprint_mismatch` | RFC 3161 anchor messageImprint mismatch | null |
| `anchor_cms_verification_failed` | RFC 3161 CMS signature failed | null |
| `anchor_ca_chain_failed` | CA trust store passed but chain doesn't terminate | null |
| `anchor_rekor_payload_mismatch` | Rekor body payload hash != batch_root | null |
| `anchor_rekor_inclusion_failed` | Rekor Merkle inclusion proof failed | null |
| `anchor_rekor_set_failed` | Rekor SET signature failed | null |

Open question for implementation: anchor failures currently return
`ok: true` with a diagnostic (fallback pattern). Should these emit
structured errors in the same `{seq, reason, impact}` shape, or stay
diagnostic-only? Answer at Thu implementation time; a proposal at that
point: **keep the ok-true fallback as today, but surface the fallback
reason as a `warnings: VerifierError[]` array on the result object using
the same shape**. That way M5 X5 can render a green ✓ with a subtitle
"warning: CMS chain not verified" without conflating warning with fail.

### `impact`

A single sentence, auditor-safe. Examples:

- `"payload_hash mismatch at seq 23 (file_write); chain broken for 24 downstream events"`
- `"Ed25519 signature does not match batch root; bundle is not authentic under the provided key"`
- `"Rekor inclusion proof did not reproduce the tree root; either the anchor or the log is corrupted"`

Rules for `impact`:
1. Written in complete sentences with terminal punctuation.
2. Names the concrete field or block that failed.
3. States the downstream consequence (what an auditor should conclude).
4. Never uses forbidden-phrases lint patterns.
5. Never uses jargon that requires reading the spec to understand.

M5 X5 renders this text as a floating 3D caption; it must be legible at
~3m distance in a 40-character-wide line, so keep to ≤ 100 chars per line
and wrap to two lines maximum.

---

## Wire the shape everywhere

Three consumer surfaces + `verify.html` need updating. All three today
return / print / throw ad-hoc strings.

### `packages/attest-core/session.js`

Current: `verifyBundle` returns `{ok: false, reason: <string>, failedSeq?: number}`.

Target: `verifyBundle` returns `{ok: false, error: VerifierError}` where
`error.seq` is the sole seq field. Keep `ok: true` shape unchanged.
Deprecate `failedSeq` at the top-level; keep it as a getter that reads
`error?.seq ?? null` for 1 release cycle for back-compat, delete on v3.1.

### `bin/shadow-verify.mjs`

Current: prints `✗ Verification failed (event N)` header + `reason : <string>` line.

Target:
```
✗ Verification failed
  seq    : 23
  reason : payload_hash_mismatch
  impact : payload_hash mismatch at seq 23 (file_write); chain broken for 24 downstream events
```

JSON mode already emits a JSON payload — extend it with the three fields.

### `verify.html`

Current: `report.ok === false` renders the reason string in a red box.

Target: render seq/reason/impact as three labeled fields. If `seq === null`
show "—" not "null".

### Adding the drift test

`test/verifier-error-format.test.js` (new):

1. For each pre-known failure trigger (constructable from synthetic bundles),
   assert that (a) `verifyBundle` returns the correct `reason` code,
   (b) the CLI printout contains all three fields, (c) `verify.html` (via
   its extracted algorithm module) produces the same reason code.
2. Assert the enum is a subset of the source-of-truth list in this document.
   Any new reason code requires updating both the code and this doc.

---

## Non-goals (do NOT do at implementation time)

- Do not change the on-disk bundle format. This is a purely output-side
  change.
- Do not change verifier semantics — the same bundles that pass today must
  pass after; the same bundles that fail today must fail after with an
  equivalent reason.
- Do not introduce localization/i18n for `impact` in this release. Ship
  English; add i18n later if needed.
- Do not change the CLI exit codes. Exit code stays 1 on verify failure.

---

## Handoff notes for the Thursday implementation

- Start by grep-ing `verifyBundle` return sites in `session.js` and
  cataloguing every current `reason:` string. Cross-check against the
  table above; add any missing codes to this doc BEFORE writing code.
- Add `test/verifier-error-format.test.js` first (test-first). The test
  builds a synthetic tampered bundle for each reason code and asserts the
  triple.
- Port `verifyBundle` return type second.
- Port CLI + verify.html third.
- Rule 7 pre-commit gates: run `npm test`, `check-forbidden-phrases`,
  `readme-stats --check`, `npm run demo:attestation`. Do NOT push if any
  fails.
- End-of-session debrief must include start and end `ℹ tests / pass /
  fail / skipped` blocks pasted verbatim.
