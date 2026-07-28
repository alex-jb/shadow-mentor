# Shadow — skills.sh distribution

Free distribution of Shadow into every Claude for Work / Cursor / OpenCode user via the [skills.sh](https://skills.sh) marketplace pattern.

Skills here are self-contained folders with a `SKILL.md` file at the root. Install with `npx skills add alex-jb/shadow-mentor/skills/<skill-name>`.

## Available skills

Full-catalog matrix — one skill per Shadow persona plus one for the aggregate loan-council verdict:

### Persona skills (banking loan council)

| Skill | What it does | Confidence weight | Block authority |
|---|---|---|---|
| [`shadow-loan-council`](./shadow-loan-council/SKILL.md) | Full 5-to-6 voice pure-compute verdict layer. Ed25519 attestation. | — (aggregator) | — |
| [`shadow-compliance-officer`](./shadow-compliance-officer/SKILL.md) | CFPB / SR 26-2 / ECOA / Reg B / Fair Housing. Refuses to auto-approve without human review. | 1.20 | ✅ on fair_lending flag |
| [`shadow-aml-kyc-investigator`](./shadow-aml-kyc-investigator/SKILL.md) | BSA / OFAC / USA PATRIOT §326 / FinCEN CDD / FATF. **ACAMS 2026 procurement lane.** | 1.20 | ✅ on sanctions/CIP |
| [`shadow-risk-officer`](./shadow-risk-officer/SKILL.md) | Portfolio VaR / LTV / concentration / sector. Loredana's Addendum C thresholds. | 1.00 | ✅ on VaR > 2× ceiling |
| [`shadow-customer-advocate`](./shadow-customer-advocate/SKILL.md) | Adverse-action explanation quality per CFPB Circular 2026-03. | 0.85 | ❌ (escalate-only) |
| [`shadow-macro-contrarian`](./shadow-macro-contrarian/SKILL.md) | Mandatory dissent voice — CRE + late-cycle sector risk. | 0.85 | ❌ (escalate-only) |

### Cross-vertical + audit skills (v1.5.17+)

| Skill | Vertical | What it does |
|---|---|---|
| [`shadow-attestation-verify`](./shadow-attestation-verify/SKILL.md) | audit | Verify a Shadow attestation record (Ed25519 or HMAC) without leaving Claude Desktop. Cross-language, works with Python 3.9–3.13 shadow-verify library. |
| [`shadow-size-position`](./shadow-size-position/SKILL.md) | trading | FinPos-style position sizer. Direction is an input from an upstream Judge; sizer decides fund/skip + position_usd only. Never emits a direction. |
| [`shadow-ds-govern`](./shadow-ds-govern/SKILL.md) | data-science | 5-voice deterministic model-risk council. Fair-ML BLOCK on EEOC 80% rule violation is unconditional. Missing metadata is REWORK, never SHIP. |

**Credit Fundamentals** persona is intentionally NOT shipped as a standalone SKILL.md because its `FICO < 700 hard block` is Lora's non-negotiable policy floor (per her 2026-06-19 binding decision) — it should only run inside the full council alongside Compliance and Risk. Consumers who want a credit-only check should use `shadow-loan-council` directly.

## Why skills, not just an MCP server?

The MCP server (`bin/install.mjs --host <name>`) is the primary integration path — it exposes 11 tools Claude can invoke (see `product-facts.json` → `mcp_tools`). But installing an MCP server requires running a Node process on the user's machine.

Skills are lighter: they're just system-prompt-shaped documents users can install with one command. Perfect for:

- **Trying Shadow's persona voice** without running a Node server
- **Single-turn drafts** where a full council roundtrip is overkill
- **Discovery** — banks browsing skills.sh find Shadow's compliance persona without knowing MCP exists

Both paths point to the same underlying repo. Install the skill for lightweight discovery + install the MCP server when you're ready for the full council + attestation flow.

## Contributing a new persona skill

If you want to package another Shadow persona (Risk Officer / Customer Advocate / Macro Contrarian / AML/KYC Investigator) as a standalone skill, follow the pattern in `shadow-compliance-officer/SKILL.md`:

1. Create a new folder `skills/shadow-<persona-name>/`
2. Add a `SKILL.md` with YAML frontmatter matching Anthropic's Skills format
3. Cite the regulatory anchors baked into the persona's role
4. Reference the source of truth (`lib/persona-schema.json` L2 principles for your voice)
5. Point to the full repo for the MCP server integration path

## Refs

- Shadow full repo: https://github.com/alex-jb/shadow-mentor
- Shadow v1.4.0 release: https://github.com/alex-jb/shadow-mentor/releases/tag/v1.4.0
- Anthropic Skills format: https://docs.anthropic.com/skills
- skills.sh marketplace: https://skills.sh
- Persona L1/L2/L3 metadata: [`lib/persona-schema.json`](../lib/persona-schema.json)
