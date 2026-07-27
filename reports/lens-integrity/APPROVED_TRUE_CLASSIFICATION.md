# `approved: true` classification and fix

## The one runtime defect — FIXED

`apps/shadow-lens/backend/build-session.mjs` — the integration keystone that "assembles a full
ShadowLensSession AND seals a REAL attest-core evidence bundle … the real thing every renderer
consumes." It synthesised approval whenever reviewers existed, ignoring the actual decision:

```js
if (reviewers && reviewers.length) {
  appendEvent(s, { event_type: "human_approval", payload: { approved: true, ... } });   // hardcoded
}
...
human_review: reviewers && reviewers.length ? "approved" : "pending",                   // hardcoded
```

**Reachable at runtime.** `apps/shadow-lens/backend/lens-api.mjs` review endpoint accepts
`rejected` / `modified` decisions (with the CAAT override-rationale rule), fills `reviewers` and
`decision.outcome`, then calls `buildShadowLensSession`. A **rejected** review therefore rendered and
sealed as an **approval** — the exact "missing approval must never be synthesized" violation.

### Fix

The approval is derived from the real reviewer decision — `reviewer_interaction.decision`, else the
lens-api `decision.outcome`, else a reviewer's own `decision` — and `verification.human_review`
(the field the renderer reads to display Approval) reflects it:

| reviewer decision | sealed `approved` | rendered `human_review` |
|---|---|---|
| `approved` | true | `approved` |
| `modified` | false | `modified` |
| `rejected` | false | `rejected` |
| none (reviewers present, no decision evidence) | false | `pending` |

A `human_approval` event is still recorded when a review happened (audit completeness), but its flag
is the real decision, never a hardcoded true. Five regression tests pin this in
`test/shadow-lens-build-session.test.js`; the existing test (decision `approved`) still passes.

## Constrained, non-runtime occurrences — NOT changed (with proof)

None of these can cause the UI to display Approval without signed decision evidence: they are static
demo/test/reference *inputs*, not the runtime session builder that renderers consume.

| location | kind | proof it is not a runtime approval path |
|---|---|---|
| `apps/shadow-lens/fixtures/profile-fixtures.mjs:34,81` | fixture data | not imported by any backend module (`grep profile-fixtures apps/shadow-lens/backend lib` → none); consumed only by tests/demos |
| `demos/spatial-finance/index.html:221` | static demo | a self-contained HTML demo that hand-builds an example bundle; not the Lens backend |
| `scripts/build-reference-bundle.mjs:44,50` | CLI generator | a developer script that emits a fixed *reference* bundle sample; not invoked by lens-api |
| `test/banking-profile*.test.js`, `test/evidence-packet.test.js`, `test/mcp-server.test.js`, `test/reviewer-interaction.test.js` | test data | construct approved bundles to exercise downstream profile checkers; `test/reviewer-interaction.test.js:66` also builds an `approved:false + decision:rejected` case, proving the checker layer already distinguishes them |
| `lib/reviewer-interaction.js:1` | code comment | the string `"approved: true"` appears only in a descriptive comment, not in logic |

## Verification

`test/shadow-lens-build-session.test.js` 7/7. Full Node suite **2065 tests · 2062 pass · 0 fail ·
3 skip** (the 3 skips are env-gated live-LLM smoke tests with no API key — identical to baseline).
No physical flag promoted; no device claim made.
