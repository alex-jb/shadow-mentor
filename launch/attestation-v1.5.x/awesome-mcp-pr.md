# awesome-mcp-servers PR update draft

## Context

Shadow's MCP server entry already exists in `awesome-mcp-servers` (originally added via PR #6229 per brain memory). Update the entry to reflect the 7th tool + full 3-surface verifier story.

## Repo

https://github.com/punkpeye/awesome-mcp-servers

## Existing entry (find + update)

Search for `shadow-mentor` or `alex-jb/shadow-mentor` in the README.

## PR title

`chore(shadow-mentor): update to v1.5.5 — 7 tools, attestation verifier, one-command demo`

## PR body

Updating the Shadow entry to reflect v1.5.0 → v1.5.5 shipped 2026-07-03/04.

New MCP tool count: **7** (was 6). Adds `shadow_verify_attestation` for auditors to verify Ed25519 attestations inline from Claude Desktop / Cursor / OpenCode without shelling to the CLI.

Full attestation dispatch triangle now shipped:
- CLI: `bin/verify-attestation.mjs`
- MCP: `shadow_verify_attestation`
- HTTP: `POST /api/verify-attestation`

Plus a one-command procurement acceptance demo: `npm run demo:attestation` runs the whole chain from a fresh clone in ~250ms.

MIT-licensed. 543 tests green.

## New line for the README table

```markdown
- [alex-jb/shadow-mentor](https://github.com/alex-jb/shadow-mentor) 🐍 🏠 - On-device 5-voice AI council for regulated banking. 7 MCP tools (loan council, risk primitives, calibration, traceability, attestation verifier). Ed25519 attestations bank auditors can verify from CLI, chat, or curl. `npm run demo:attestation` for one-command acceptance test.
```

Icons per awesome-mcp-servers convention:
- 🐍 not applicable (Node, not Python)
- 🏠 = local/self-hosted (Shadow runs in the deploying bank's VPC)

Actual icons to use — check the repo's contribution guide. Most likely:
- 🟢 for stable
- 🏠 for local/self-hosted
- 📇 or 🏦 for banking / financial (whichever the repo uses)

## Timing

After the Show HN and X thread land — awesome-list PRs get more attention when the repo has fresh distribution signal.

## Do not

- Do not open the PR the same day as the HN post (looks spammy)
- Do not include the emoji ✓ in the PR body
- Do not link back to launched HN thread in the PR (unless the maintainer asks)
