# Shadow — Launch Plan (go-live)
*Owner: Claude (drives prep + drafts + repo) · gates require Alex · 2026-07-30*

## What "launch" means here
Not a big-bang PR splash — Shadow is pre-1.0 and the 2026 play is **design partners + OSS adoption**, not bookings. "Launch" = making the product **findable, credible, and self-servable** so the right compliance officer / developer can discover it, verify it themselves, and reach a human. Sequence below; nothing public ships without Alex's go.

## Phase 0 — Prereqs (must be true before any public post)
| Item | Owner | State |
|---|---|---|
| Security fixes committed (C1/C2/C3 + honesty scrub) | Claude | ✅ done (`bcdb749`) |
| Repositioned copy (README + llms.txt + JSON-LD) | Claude | ✅ done |
| Security & architecture brief (PDF, forwardable) | Claude | ✅ `Downloads/Shadow-Security-Brief-2026-07-30.pdf` |
| **Website rebuilt** (hero, de-slop, OSS surface, conversion) | **Kimi** (via work order) | ⏳ hand the work order to Kimi |
| **A real contact email / "book a review" form** on the site | Alex | ⏳ blocker for the conversion CTA |
| `verify.html` reachable + a "verify a bundle" hero widget | Kimi | ⏳ |
| `npx @shadow/verify` (or the CLI) install one-liner works | Claude/Alex | verify the published name |
| Not pushing a broken build — `npm test` green on committed code | Claude | ✅ my batch green (2 XR fails are dropped glasses work) |

## Phase 1 — OSS surface ready (developer trust)
- README leads with independence + banking reason-code moat ✅ ; add a top "Verify a bundle in 30s" block + install line.
- GitHub repo public, MIT, CONTRIBUTING/SECURITY present ✅ (confirm).
- Auto-publish skills + MCP tools to registries on tagged release (skills.sh ✅ ; add mcp.so / Smithery / Glama / punkpeye/awesome-mcp-servers).
- One inline worked example (denial → bundle → first-failure → reason code → ✔ verified).

## Phase 2 — Distribution (the day Alex says go)
Draft-ready, fire in this order (space them out, don't spam same-day):
1. **Show HN** — draft: `docs/launch/show-hn.md`. Lead with independence + the problem, honest pre-1.0, "verify it yourself" hook. Tue–Thu 8–10am ET.
2. **skills.sh** — already live; refresh the listing to the new positioning.
3. **MCP registries** — mcp.so, Smithery, Glama, PR to punkpeye/awesome-mcp-servers (already have #8878 — refresh to the independent-verifier framing).
4. **awesome-lists** — awesome-claude / awesome-llm-apps / awesome-mcp-servers (independent-verifier + banking angle).
5. **LinkedIn** (compliance-officer audience) — honest, EU-first, "independent verifier" — a few days after HN, not same day.
6. **A short technical post** targeting the exact query ("adverse action reasons AI model ECOA independent verification") for GEO.

## Phase 3 — Convert discovery → design partners (the real goal)
Run the GTM Discovery Kit (`docs/GTM_DISCOVERY_KIT_2026-07-30.md`): 10–20 EU fintech lenders + 3 consultancies → 3–5 conversations → 1 concierge pilot ($2K, by hand) with a written paid-conversion date. **This is where the money is; the launch just fills the top of this funnel.**

## Gates (do NOT skip)
- **No public post until the website rebuild lands** (posting to the current research-demo site wastes the launch — all three audits agree it reads as a hobbyist project).
- **No "SOC 2" / "certified" / production claims** — pre-1.0, honest roadmap only.
- **A human CTA must exist** before driving traffic (else convinced buyers bounce).
- **Do not headline XR** anywhere in the launch.

## What Claude does next (independent, no gate)
1. ✅ Security brief PDF.
2. Draft Show HN + the awesome/MCP-registry PR refresh (below in `docs/launch/`).
3. Verify the OSS install path + the verify-a-bundle flow work end-to-end.
4. Prep the MCP-registry auto-publish list.
5. Hold all public posts for Alex's go + the website rebuild.
