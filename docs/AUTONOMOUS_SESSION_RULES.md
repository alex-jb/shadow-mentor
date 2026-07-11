# Autonomous session rules

Rules an autonomous Claude Code session may not violate without an explicit human override in the same conversation. Codified 2026-07-10 after the v3 M1/M2.3/M4 shipping burst and Alex's post-hoc audit.

The rules are additive to `CLAUDE.md` and to the alex-brain feedback memories. If any of the below conflict with a specific user instruction in the current conversation, follow the user.

## Hard red lines (never, without explicit in-conversation override)

1. **Never send anything outbound.** No email, no npm publish, no Show HN, no PR body posted to a public issue tracker, no Devpost submission, no Slack message, no calendar event. Drafts only. Human hand on every trigger. This includes: `npm publish`, `gh pr create --draft` posts, `gh release create` with the `--notes` file already reviewed but not the message body newly composed in-session, any curl to a webhook.
2. **Never touch frozen schemas.** `spec/attestation.schema.json` is v2 frozen. `spec/evidence-bundle.schema.json` is v1 frozen. New signed fields require a `schema_version` bump and a migration test. Field-set changes are a breaking action requiring human sign-off.
3. **Never modify the Wednesday 2026-07-16 demo path.** _Sunsets 2026-07-16 EOD NY. After that date this rule is inactive without any commit; ignore it._ Until Wednesday EOD, do not edit:
    - `demo/xreal.html` and any assets it references at runtime
    - `docs/demo-2026-07-16-narration.md`
    - `docs/demo-2026-07-16-narration-tight.md`
    - `docs/wednesday-preflight-2026-07-16.md`
    - `docs/xreal-one-pro-test-protocol/**`
    - `bin/attestation-acceptance-demo.mjs`
    - `verify.html`
    Additive tests, new sibling documents, and fixtures under `verify-fixtures/` are allowed.
4. **Never remove back-compat shims.** `lib/attestation*.js` shims stay through at least v3.0.0. _Sunsets on the v3.0.0 git tag. Removal after that tag is still a breaking API change but is no longer categorically forbidden — treat as a deliberate deprecation with human sign-off._ Removing them is a breaking API change requiring human sign-off.
5. **Never bypass the forbidden-phrases lint.** Not in denial-by-quotation form. Not inside markdown escape sequences (`tamper-**proof**` counts). Not in commit messages. Not in CHANGELOG entries describing removals. Reword to describe what Shadow IS.

## Session-shape rules

6. **Additive-only by default.** New files, new tests, new documentation. Any change that would delete existing behavior or rewrite an existing prose block must stop and ask.
7. **Every commit must pass, before push:**
    - `node scripts/run-tests.mjs`
    - `node scripts/check-forbidden-phrases.mjs`
    - `node scripts/readme-stats.mjs --check`
    - `npm run demo:attestation` (all 6 acceptance steps green)
    If any of the four fails, do not push. Investigate root cause instead of retrying.
8. **Fabrication is a bug.** If a document is cited, verify it exists. If a deadline is claimed, verify against a canonical source. If a person's title or an organization's URL is stated, verify. If verification is not possible, say "I need to verify X" and stop. Prior known fabrication landmines are enumerated in the forbidden-phrases lint at `scripts/check-forbidden-phrases.mjs` — read the pattern list before citing regulatory sources. When in doubt, prefer the primary source (12 CFR, Federal Register) over a summary.
9. **Do not paper venues, author lists, or academic-collaboration framing.** Draft only; a human confirms. This includes: co-author order, corresponding-author selection, target venue swaps, deadline claims, and "PI vs co-PI" designations.
10. **Escalate on 3 consecutive `继续` in a row without new external signal.** The user's intent may have drifted or the user may be signaling exhaustion. Ask for a concrete target or a specific milestone name instead of picking from your own priority stack.

## Task-scope rules

11. **Tasks that require human-in-the-loop, not eligible for pure autonomy:**
    - **M2.1 Claude Code hooks adapter.** Requires the operator's local Claude Code CLI to validate hook wiring against a real session.
    - **XREAL / WebXR hardware-dependent changes.** Requires the operator to physically test.
    - **Real npm publish** (as distinct from publish prep). Requires the operator's NPM_TOKEN and a provenance-signed release.
    - **Anything touching credit-decision policy semantics.** Any change to `LOAN_DEFAULTS`, `run-loan-council.js` voice logic, or the signed reason-code dictionary requires Levitchi's confirmation.

12. **Pure-autonomous eligible tasks:**
    - M3 external anchoring (RFC 3161 TSA client + Sigstore Rekor adapter)
    - M6 STANDARDS_MAP documentation
    - Test coverage additions
    - Hygiene work (lint expansion, CI fixes, dependency updates that don't change API surface)
    - Spec extensions in `spec/` for fields that are already appended-only in code
    - README polish and internal cross-linking

## Failure modes this document codifies against

- **The 2026-07-10 IEEE VIS hallucination:** paper-skeleton.md was created with a fabricated venue and deadline. This is a fabrication-is-a-bug violation.
- **The 2026-07-10 CI email storm:** eighteen hours of red CI notifications went unnoticed because the session did not verify GitHub Actions status before pushing successive commits. Rule 7 addresses.
- **The 2026-07-10 Wed-path demo-URL risk:** the demo path was declared "not touched" but the fact that the demo is served from Vercel and depends on venue Wi-Fi was not flagged as a risk. Rule 3 addresses only the code path; a separate `docs/wednesday-preflight-2026-07-16.md` update captures the offline-package requirement.

## Meta

This file is the ratchet. Amendments require the operator's in-conversation confirmation and a matching commit.
