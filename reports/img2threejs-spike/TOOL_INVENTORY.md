# img2threejs — tool inventory (isolated inspection)

Cloned into `experiments/img2threejs/tool/` for READ-ONLY inspection. NOT installed as a Claude
skill (no `~/.claude/skills` install), NOT run, no scripts executed, no global tools/hooks touched.
2026-07-22.

| Field | Value |
|---|---|
| repository | github.com/hoainho/img2threejs |
| commit | `e8ff28a6ae0cb534c7b2ebc15cb3f06709262d5b` ("Merge: v1.2.0 CHANGELOG + Trendshift badge") |
| version | 1.2.0 (SKILL.md frontmatter) |
| license | **MIT** (LICENSE: "Copyright (c) 2026 hoainho") |
| type | an **agent skill** (SKILL.md) — agent-agnostic (Claude Code / Codex / OpenCode) |
| language | Python 3.10+ (forge/ pipeline) → emits TypeScript Three.js factories |
| deps | **stdlib only** (forge/requirements.txt: "NO third-party dependencies… json/argparse/struct/zlib/pathlib/math/subprocess") — no Pillow/numpy/Playwright |
| structure | `forge/` (staged Python: intake→spec→build→review), `grimoire/` (markdown guidance), `assets/` (8 demo gif/svg), `docs/` |
| generation mechanism | "scripts enforce, the model judges" — deterministic Python enforces structure; the **host agent's vision** drives a self-correction loop (no bundled LLM/model) |
| bundled models/meshes | none (procedural code-only; assets are demo gifs, not runtime) |

## How generation actually works (why this spike authors props directly)
The tool has NO bundled LLM and NO network client — its vision/judging loop is delegated to the host
agent (per SKILL.md: "use whatever the host provides — native image reading, a browser MCP…"). Running
it as a skill would require installing it into `~/.claude/skills` (a global install — forbidden here).
So this spike inspects the tool, then produces the three props **as repository-owned procedural
`THREE.Group` factories in the tool's documented output style** (procedural, socketed, no runtime deps).
This is exactly the shape the tool emits, and it keeps provenance 100% Shadow-authored + MIT-clean.
