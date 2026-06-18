# Pull Request

## What this changes

<!-- One paragraph. What's different after this lands. Not "added support for X" — "X now does Y instead of Z." -->

## Why

<!-- Link the issue or describe the constraint. If this is a fix, name the bug. If this is a feature, name the user need. -->

## Scope check

- [ ] This change is in scope for Shadow (read `CONTRIBUTING.md` if unsure)
- [ ] I did NOT widen the benchmark rubric to make scores look better
- [ ] I did NOT introduce service-role secrets in client code
- [ ] If I touched `lib/prompts.js`, both `api/deliberate.js` and `benchmark/runner.js` were re-validated

## Tests

- [ ] `npm test` is green (37+/37+)
- [ ] If I touched `lib/prompts.js` or `api/deliberate.js`, `npm run benchmark` does NOT regress below 88/100

## Procurement defensibility

<!-- Will a bank security reviewer or examiner accept this change? If unsure, say why. -->

## Screenshots / output (if UI / endpoint change)

<!-- Drop the curl output or screenshot here. -->
