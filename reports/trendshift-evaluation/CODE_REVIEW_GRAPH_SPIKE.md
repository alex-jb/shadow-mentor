# Spike A — Code Review Graph (tirth8205/code-review-graph)

Research-only. The tool was **NOT installed** (its install/hooks were not run, per the constraints).
Instead this spike evaluates the IDEA against a clean Shadow checkout by computing blast-radius manually
with the same signal a code-graph tool would use (references + tests), so we can judge fit without
adding a dependency. 2026-07-22.

## Shadow codebase shape (what a graph tool must actually handle)
| Language | Files | Notes |
|---|---|---|
| C# (Unity) | 121 | assemblies: ShadowLens, ShadowLens.Xreal (gated), InputV5.Runtime, AndroidBridge, Editor, Tests |
| JS/MJS | 402 (tracked) | lib/, tools/, test/, fixtures/, demos/, verify/, prototypes/ |
| TypeScript | 14 | spatial-agent client |
| Python | 3 | minor tooling |

A graph tool that covers **C# + TS + JS + Python** would span the whole repo — that is the right
coverage claim to verify before adopting.

## Blast-radius demo 1 — a Unity/XREAL change
Target: `ShadowXrealTrackingMapper` (maps the SDK TrackingType → `Core.TrackingMode`).

- **Direct references (2):** `Xreal/ShadowXrealTrackingAdapter.cs`, `Tests/DeviceReady/ShadowXrealMappingEditTests.cs`.
- **Indirect via `TrackingMode` (10 files, 4 assemblies):** Core (`IProviders`, `MockTrackingProvider`),
  Device (`ShadowUnityDeviceProbe`, `ShadowDeviceCapabilityDetector`, the mapper itself), Xreal
  (`TrackingAdapter`, `DiagnosticsAdapter`), Providers (`XrealProviders`), + 2 tests
  (`ShadowXrealMappingEditTests`, `ShadowDeviceReadyEditTests`).
- **Verdict:** a change here should re-run the DeviceReady EditMode suite and re-check the capability
  detector's 6DoF-honesty path. A graph tool would surface exactly this set automatically. ✅ genuine value.

## Blast-radius demo 2 — the case a code CALL graph MISSES (Shadow-specific)
Target: `lib/shadow-semantic-vocabulary.mjs` (the JS source of truth for statuses/dimensions).

- **9 JS importers** (planner, compiler, adapters).
- **9 C# "mirror" files** that must stay in lockstep (`ShadowGuidedStoryStatus.cs`, `ShadowVoiceContract.cs`, …)
  — but these are NOT connected by any code call/import edge. The coupling is **semantic**, enforced by
  **7 parity tests** (`test/*parity*.js`), not by a call graph.
- **Verdict:** a Tree-sitter call/inheritance graph would NOT link the JS vocabulary to its C# mirror.
  This is the load-bearing risk in Shadow, and the graph tool would give a **false sense of coverage**
  here. The parity tests remain the real guard. ⚠️ known blind spot.

## Fit against the two proposed uses
1. **Dev-tool layer (Claude edits Unity/XREAL/Voice):** genuine value — cheaper, more reliable affected-
   assembly/test discovery than manual grep, especially inside the 121-file C# tree. BUT it must run
   **local-first with NO auto-hooks / NO MCP config change** (constraint honored: nothing was wired).
2. **Product evidence layer (→ coding-agent-v1):** the graph's {changed file, affected symbol, dependent
   test, commit, build result} maps cleanly onto the existing `coding-agent-v1` guided-story entities
   (issue/tool_call/diff/test/commit). This is an ADAPT-IDEAS opportunity: the *shape* is reusable; the
   tool's **risk scores are NOT evidence** — the project's own docs disclaim ranking/flow/precision
   limits, and Shadow's rule is integrity≠correctness, so a risk score can never become an audited claim.

## Constraints observed
No install script run · no hooks enabled · no `.mcp.json`/CLAUDE.md/global-config touched · nothing
merged. Risk scores treated as non-authoritative.

## Verdict
**ADAPT IDEAS ONLY** (dev-tool trial gated on a second authorization). The blast-radius idea is valuable
for the C# tree and its output shape fits coding-agent-v1 evidence; but it structurally misses Shadow's
JS↔C# semantic mirror (covered by parity tests), and its risk scores must never be treated as
correctness. If trialed later: local-only, read-only, no MCP/hooks wiring, scores excluded from any
evidence bundle.
