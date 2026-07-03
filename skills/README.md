# Shadow — skills.sh distribution

Free distribution of Shadow into every Claude for Work / Cursor / OpenCode user via the [skills.sh](https://skills.sh) marketplace pattern.

Skills here are self-contained folders with a `SKILL.md` file at the root. Install with `npx skills add alex-jb/shadow-mentor/skills/<skill-name>`.

## Available skills

| Skill | What it does |
|---|---|
| [`shadow-compliance-officer`](./shadow-compliance-officer/SKILL.md) | Bank-grade compliance-officer persona (CFPB / SR 26-2 / ECOA / Reg B / BSA / OFAC / FinCEN CDD). Refuses to auto-approve without human review. |
| [`shadow-loan-council`](./shadow-loan-council/SKILL.md) | 5-to-6 voice loan verdict layer. Pure-compute, Ed25519-signed attestation, milliseconds. |

## Why skills, not just an MCP server?

The MCP server (`bin/install.mjs --host <name>`) is the primary integration path — it exposes 6 tools Claude can invoke. But installing an MCP server requires running a Node process on the user's machine.

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
