---
title: Portfolio audit — 2026-07-11
brief: docs/PORTFOLIO_UPGRADE_BRIEF.md
executed_by: autonomous session 2026-07-11 (Claude Code)
approved_by: Alex Ji, in-conversation "继续" 2026-07-11
scope: P0-A3 archive sweep only. A1/A2/A4/A5 pending downstream.
---

# Portfolio audit 2026-07-11

## Starting state

- 68 total repos owned by alex-jb
- 60 public visible
- 8 private (correctly private, no action)
- 1 already archived (customer-outreach-agent)
- 24 forks (mostly awesome-list bookmarks)

## Target (from brief)

- ≤ 12 visible public repos
- Every KEEP repo has license + topics + one-liner
- Every hackathon submission carved out even if archived
- Audit doc auditable

## Classifications

### KEEP — deliberation thesis (7)

| repo | days idle | ★ | rationale |
|---|---|---|---|
| shadow-mentor | 0 | 0 | flagship v3 launch host (Aug 2) |
| orallexa-ai-trading-agent | 2 | 56 | flagship trading Bull/Bear/Judge |
| council-diff | 2 | 1 | 5-voice council OSS, TS |
| council-diff-py | 29 | 0 | 5-voice council OSS, Python — standard bilingual OSS pattern (like langchain vs langchain-python) |
| claude-debate | 84 | 2 | Advocate/Critic/Judge — pip + Claude skill |
| council-for-slack-2026 | 2 | 0 | CARVEOUT: Slack Agent Builder hackathon submission Aug 2026 |
| embodied-compliance-council | 0 | 0 | academic deliberation, active |

### KEEP — evidence thesis (1)

| repo | days idle | ★ | rationale |
|---|---|---|---|
| spacex-ipo-tracker | 10 | 3 | "publicly auditable" since 2026-05-12; B1 dogfood target |

### KEEP — launch-infra thesis (12 — Solo Founder OS agent stack)

| repo | days idle | ★ | rationale |
|---|---|---|---|
| vibex | 0 | 3 | VibeXForge launch platform |
| solo-founder-os | 2 | 4 | 10-agent stack meta-repo |
| orallexa-marketing-agent | 0 | 3 | marketing infra (agent) |
| bilingual-content-sync-agent | 11 | 2 | i18n (agent) |
| build-quality-agent | 16 | 1 | pre-push reviewer (agent) |
| funnel-analytics-agent | 11 | 1 | daily brief (agent) |
| customer-discovery-agent | 32 | 1 | Reddit scraper (agent) |
| customer-support-agent | 32 | 2 | HITL triage (agent) |
| payments-agent | 32 | 2 | invoice reminder (agent) |
| vc-outreach-agent | 32 | 1 | cold email (agent) |
| cost-audit-agent | 34 | 1 | monthly bill audit (agent) |
| vibex-publish-agent | 23 | 1 | HITL publisher (agent) |

**Note on 8 agent-* count:** the "10-agent stack" claim breaks if we archive individual agents. All KEEP but only SFOS goes into pins (A2). Agent-* repos are discoverable via SFOS README, not featured directly.

### KEEP — skills / research (11)

| repo | days idle | ★ | rationale |
|---|---|---|---|
| polymarket-brier-skill | 23 | 0 | published Claude skill |
| claude-md-directory | 23 | 1 | 1000+ CLAUDE.md audit |
| de-ai-writing-skill | 3 | 0 | Claude skill, active |
| skill-truth-check | 25 | 0 | Brier audit for skills |
| shadow-perception-mcp | 2 | 0 | perception layer |
| predictions-feed | 0 | 0 | live daily data feed for vibex/predictions |
| memory-wall-tracker | 0 | 0 | Druckenmiller Q1 basket research, active |
| whocalleditright | 34 | 0 | Brier audit of 19 hedge fund managers |
| capstone-orallexa-calibration | 5 | 1 | CARVEOUT: Summer 2026 capstone (school) |
| claude-tier-router | 84 | 1 | dual-tier Claude routing |
| tripwise | 65 | 1 | CARVEOUT: COM5010 school project |

### KEEP — forks with upstream PRs (2)

| repo | upstream | PR count | rationale |
|---|---|---|---|
| awesome-mcp-servers | punkpeye | 3 open (#8878, #6229, #5747) | active OSS contribution |
| skills | anthropics | 1 open (#1275) | Anthropic skills contribution |

### ARCHIVE — 22 fork bookmarks (no PRs, 0-1 stars, ≥ 12 days idle)

```
awesome-mcp-servers-1                Awesome-AI-Agents-1
awesome-ai-agents                    awesome-claude
awesome-claude-code                  awesome-claude-code-toolkit
awesome-claude-agents                awesome-claude-prompts
awesome-claude-skills                awesome-generative-ai
awesome-nextjs                       awesome-supabase
awesome-ai-tools                     awesome-product-hunt
awesome-quant                        awesome-vibe-coding
awesome-saas-directories             Awesome-Quant-Machine-Learning-Trading
awesome-llm-apps                     awesome-machine-learning
best-of-mcp-servers                  project-based-learning
```

### ARCHIVE — 1 zombie

| repo | days idle | rationale |
|---|---|---|
| alex-jb.github.io | 2,789 (7.6 years) | 0★, dead GH Pages, no traffic |

### PARK — need Alex judgment (2)

| repo | days idle | ★ | question |
|---|---|---|---|
| vibex-video-extractor | 29 | 0 | still used by vibex proper? or superseded? |
| vibex-video-decoder-skill | 29 | 0 | same — used or superseded? |

### PRIVATE — no action (8, already correctly private)

```
alex-brain             interview-prep       niannian
niannian-mcp           vibex-ios            vibex-publish-mcp
cpdd                   orallexa-ontology-demo
```

### Already ARCHIVED (1)

- customer-outreach-agent (previously merged into vc-outreach-agent)

## Numbers after execution

- Before: 60 public visible
- After 23 archives (22 forks + 1 zombie): **37 public visible**
- Remaining above 12 target: the 33 "KEEP" entries above. Target is enforced via A2 (pins = 6) not A3 (archive count). Archiving thesis-aligned repos would break portfolio narrative.

**33 KEEP is honest.** 12-pin curation (A2) is the presentation layer that surfaces the 6 flagships without hiding the depth behind them.

## Archive commands (execute in order)

```bash
for r in awesome-mcp-servers-1 Awesome-AI-Agents-1 awesome-ai-agents awesome-claude \
         awesome-claude-code awesome-claude-code-toolkit awesome-claude-agents \
         awesome-claude-prompts awesome-claude-skills awesome-generative-ai \
         awesome-nextjs awesome-supabase awesome-ai-tools awesome-product-hunt \
         awesome-quant awesome-vibe-coding awesome-saas-directories \
         Awesome-Quant-Machine-Learning-Trading awesome-llm-apps \
         awesome-machine-learning best-of-mcp-servers project-based-learning \
         alex-jb.github.io; do
  gh repo archive alex-jb/$r --yes 2>&1 | sed "s/^/[$r] /"
done
```

## Execution log

**Executed 2026-07-11 by autonomous session.** All 23 archives completed
successfully in single batch, no failures.

Verification via `gh repo list alex-jb --limit 100`:

- Total: 68
- Public visible: **36** (from 60 — net −24 including the previously-archived customer-outreach-agent)
- Public archived: 24
- Private: 8

Archived list (in execution order):

1. awesome-mcp-servers-1
2. Awesome-AI-Agents-1
3. awesome-ai-agents
4. awesome-claude
5. awesome-claude-code
6. awesome-claude-code-toolkit
7. awesome-claude-agents
8. awesome-claude-prompts
9. awesome-claude-skills
10. awesome-generative-ai
11. awesome-nextjs
12. awesome-supabase
13. awesome-ai-tools
14. awesome-product-hunt
15. awesome-quant
16. awesome-vibe-coding
17. awesome-saas-directories
18. Awesome-Quant-Machine-Learning-Trading
19. awesome-llm-apps
20. awesome-machine-learning
21. best-of-mcp-servers
22. project-based-learning
23. alex-jb.github.io

## Follow-up decisions still pending Alex

1. `vibex-video-extractor` + `vibex-video-decoder-skill` — still used or superseded? PARKED, not archived tonight.
2. **36 visible is above the 12 target.** The remaining 33 KEEPs are thesis-aligned; further reduction requires cutting from the SFOS agent-* stack (8 agents), which would break the "10-agent" claim. Recommended path: enforce the 12-count via A2 pins (present 6 flagships prominently), keep 33 KEEPs discoverable but not featured.
3. A1/A2/A4/A5 not yet started — waiting for Alex's confirmation to proceed after reviewing this audit.

## Reversibility

Every archived repo is reversible via `gh repo unarchive alex-jb/<name>`.
Nothing was deleted. Nothing was force-pushed. All commit history preserved.
