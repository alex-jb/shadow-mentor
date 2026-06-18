# Security Policy

> Shadow is in pre-production. The Vercel demo is intentionally non-production: it routes regulated questions through cloud Anthropic / GLM APIs for the council pattern demonstration. **Do not paste real client PII into the public demo.**

## Supported versions

Only `main` (HEAD) is supported. Pre-1.0 tags are demo snapshots, not maintained branches.

## Disclosure

For any security finding — including but not limited to:

- Authentication / authorization bypass on `/api/*` endpoints
- Prompt injection that leaks the Anthropic / GLM API key or system prompt
- Cross-session memory contamination (one analyst's recall surfacing another's questions)
- Hash chain forgery in `/api/recall` outputs
- Supply-chain compromise of `@anthropic-ai/sdk`, `vercel`, or any other declared dep
- Leakage of `ANTHROPIC_API_KEY` / `GLM_API_KEY` via response headers, error messages, or logs

**Email**: open a private security advisory at https://github.com/alex-jb/shadow-mentor/security/advisories — DO NOT open a public issue.

## What is in scope

- All code under `/api/`, `/lib/`, `/src/`, `/benchmark/`, `/test/`
- Vercel deployment configuration (`vercel.json`)
- GitHub Actions workflows (`.github/workflows/*.yml`)
- The persona prompts in `lib/prompts.js` (prompt injection / jailbreak resistance)

## What is out of scope

- The public marketing demo URL acting as a non-production target. The demo has Vercel Deployment Protection in front of it by default and is rate-limited at the platform level.
- Third-party services: Anthropic, Zhipu GLM, Vercel platform. Report to their respective security teams.
- DOS / volumetric attacks against the public demo — Vercel platform handles this.

## Response SLA

- Acknowledgement: within 72 hours
- Triage decision: within 7 days
- Fix-or-mitigate for HIGH severity: within 14 days (this is a solo-founder repo, sliding window)

## Bug bounty

There is no formal bug bounty at this time. We'll credit reporters in `CHANGELOG.md` and the eventual security disclosure summary.

## Production banking deployment

The on-premises Shadow deployment for a real bank goes through a separate SOC 2 / SR 11-7 / EU AI Act Article 14 review pipeline — not via this public repo's security process. Bank security teams: contact the Shadow founder directly.
