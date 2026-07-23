# Unity MCP candidate discovery — Phase 0 STOPPED

## Decision

```
UNITY_MCP_CANDIDATE_UNRESOLVED
```

No exhaustive search of this repository, the sibling worktrees, the OSS Radar outputs, the shared
project notes, or the local machine identifies an **exact** Unity MCP implementation. Per the Phase-0
boundary ("do not select a Unity MCP implementation by popularity or guesswork"; "do not download or
clone an arbitrary Unity MCP before identifying the exact implementation"), nothing was cloned,
downloaded, installed, or configured, no isolated worktree was created, and no package manifest was
touched.

The three other Phase-0 reports (`UNITY_MCP_SECURITY_SURFACE.md`, `UNITY_MCP_READONLY_PROFILE.md`,
`UNITY_MCP_INSTALLATION_DECISION.md`) are **deliberately not written**: every one of them requires a
named implementation whose source and schemas can be read. Writing them from a guessed candidate
would be the exact failure mode the task forbids.

## Correction to the task premise

The task refers to "the Unity MCP implementation previously recommended by the OSS Radar work."
The OSS Radar work in this repository is dated **2026-07-20** and covers **document parsing and
sandboxing**, not Unity tooling:

| OSS Radar artifact | Subject |
|---|---|
| `experiments/cubesandbox-attestation/README.md` | CubeSandbox — security-research spike |
| `experiments/document-parser-benchmark/README.md` | PDF/Office parser benchmark |
| `experiments/office-evidence-spike/README.md` | OfficeCLI evidence spike |
| `spec/document-source-map-v1.json` | parser-agnostic source-map binding (OpenDataLoader / MarkItDown / OfficeCLI as swappable backends) |

**No OSS Radar output recommends a Unity MCP.** The Unity MCP idea entered this project through a
working-session message, not through the radar.

## What WAS found (and why it is not sufficient)

| Evidence | Source | What it establishes | Why it is not an identification |
|---|---|---|---|
| "Unity 官方 MCP Server is valuable … 安装 `com.unity.ai.assistant` 会修改 `Packages/manifest.json`、`packages-lock.json`" | working-session note (operator message) | The operator named the Unity package **`com.unity.ai.assistant`** and described it as Unity's official MCP server path. | `com.unity.ai.assistant` is Unity's **AI Assistant** package. Whether Unity's MCP server ships *inside* that package, as a *separate* package, or as an external server is not established by any artifact here. No version, no commit, no server command, no repository URL. |
| Deferred-work note: "evaluate Unity MCP in an isolated worktree `chore/unity-ai-mcp-evaluation` (read-only first)" | working-session note | The **sequencing and safety posture** were agreed. | Names a branch, not an implementation. |
| Third-party Unity MCP servers exist in the wild (community projects) | general knowledge, **not** a project artifact | — | Selecting one would be popularity/guesswork — explicitly forbidden. |

## What was searched

Portable sources only. Excluded: `.git`, `node_modules`, `Library`, `Temp`, `Logs`, `obj`, build
outputs, APKs, binaries.

| Scope | Query | Result |
|---|---|---|
| this repo (`*.md/json/mjs/js/txt/yml/yaml`) | `unity[ _-]?mcp`, `mcp[ _-]?unity`, `model context protocol` | 0 hits after excluding Shadow's own attestation MCP server |
| this repo | files containing both `unity` and `mcp` | 9 files, all inspected — every `mcp` hit is Shadow's own MCP tool surface, `chrome-devtools` MCP, or an unrelated citation |
| 4 sibling worktrees (`shadow-mentor`, `-capstone`, `-explainers`, `-spatial-ux-v2`) | `unity mcp`, `mcp unity`, `com.unity.ai.assistant`, plus three community-project owner names | 0 hits |
| `alex-brain` shared notes | same | 0 hits |
| `~/.claude/projects/*/memory/` | same | 0 hits |
| OSS Radar outputs (4 artifacts) | `unity` | 0 hits |
| configured MCP servers on this machine | server names | `chrome-devtools`, `obsidian`, `scrapling`, `supabase`, `council` — **no Unity MCP configured** |
| local Unity package cache + `/Applications/Unity` | `*mcp*`, `*ai.assistant*` | not present locally |

## Exact information still required to unblock Phase 0

One of the following must be supplied before any clone, install, or worktree is created:

1. **Repository URL** of the intended server (e.g. `https://github.com/<owner>/<repo>`), **or**
2. **Unity package name + version** (e.g. `com.unity.<name>@<version>`) if it is a UPM package, **or**
3. **The MCP client entry** for it — server command + args as it would appear in an MCP config.

Plus, for the audit to be meaningful:

- the intended **version or commit** to evaluate (a moving `main` cannot be audited),
- confirmation that the server component is **source-available** (a binary-only server fails the
  Phase-0 gate on its own),
- the **license** under which it is being evaluated.

## Why guessing is the wrong move here

The Phase-0 audit's whole value is proving, from source and schemas, which tools mutate a Unity
project and whether read-only is *server-enforced* rather than prompt-enforced. That answer differs
per implementation — a first-party Unity package and a community server have different capability
sets, different network behaviour, and different disable mechanisms. An audit of the wrong server
would produce a safety conclusion that does not apply to the server actually installed, which is
worse than no audit.

## State preserved

Nothing was installed, cloned, or configured. No worktree was created. The V11 worktree,
`Packages/manifest.json`, and `packages-lock.json` are untouched; the tree remains SDK-free and all
physical validation flags remain false.
