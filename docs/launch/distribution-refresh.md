# Distribution refresh — reposition every listing to "independent verifier"
*Space these out; don't fire same-day. Alex's go per public action.*

## The one-line every listing should now use
> **Shadow — the independent, open-source verifier for AI decisions in regulated workflows.** Signed, tamper-evident, reason-code-mapped (Reg B / GDPR Art. 22) evidence bundles a bank can verify offline. Verifies third-party agents — not just its own.

## Targets
| Surface | Action |
|---|---|
| **skills.sh** | Refresh the repo's skill descriptions to the independent-verifier framing; `npx skills add alex-jb/shadow-mentor` stays the install. |
| **punkpeye/awesome-mcp-servers** | PR #8878 already open — refresh the body to: 11 MCP tools, independent verifier, Reg B/GDPR Art 22 reason-codes, offline verifier. (Use `gh api PATCH` on the PR body; `gh pr edit` can silently no-op on the Projects-classic warning.) |
| **mcp.so / Smithery / Glama** | Submit the Shadow MCP server (11 tools) with the new one-liner. |
| **awesome-claude / awesome-llm-apps** | PR adding Shadow under an "audit / governance / compliance" heading with the independent-verifier + banking angle. |
| **README badges** | Keep the real numbers (tests, tools) — the repo under-claims (~1,679 real tests). |

## What NOT to do
- No "SR 11-7 / Tier 3", no "certified", no "production-ready".
- Don't lead any listing with cryptography or XR.
- Don't inflate stars/claims — this audience punishes it.

## Auto-publish (make it CI, not manual)
On a tagged release, publish/refresh the MCP-registry + skills listings via CI so distribution isn't a manual chore. (Draft the workflow when the website rebuild lands.)
