# Shadow — external project evaluation (research only)

Branch `research/shadow-trendshift-evaluation` (from `ada7de2`). **Research only — nothing integrated,
nothing merged, no dependency added.** No auto-install script was run; `.mcp.json` / CLAUDE.md / hooks /
global config were not touched; nothing was installed into the active Unity environment. Verified repo
facts (SHA / release / license / deps / network) are in `SHADOW_EXTERNAL_PROJECT_MATRIX.csv`; the three
bounded spikes + SkillOpt/img2threejs evaluations are in `reports/trendshift-evaluation/`. Accessed
2026-07-22.

## Capability honesty (what could actually be run in-session)
- **No NVIDIA GPU/CUDA** (Apple M5 / Metal) → Unlimited-OCR could NOT be run; it is research-only by force.
- **No auto-install / no desktop stacks** (Bun/Rust/Tauri) → Voicebox and code-review-graph were NOT
  installed; evaluated by inspecting the real repos + reasoning against Shadow's structure.
- **What WAS run for real:** a manual blast-radius on Shadow's own code (Spike A), and identical spoken
  contracts through the existing planner + macOS-say fixture baseline (Spike C).

## The three bounded spikes
- **A — Code Review Graph** (`CODE_REVIEW_GRAPH_SPIKE.md`): blast-radius demo on a real XREAL change
  (touches 10 files / 4 assemblies / 2 tests) — genuine value for the 121-file C# tree. **Key finding:**
  a code call/inheritance graph does NOT capture Shadow's **JS↔C# semantic mirror** (9 JS + 9 C# files
  kept in sync by 7 parity tests), so it gives false coverage there; and its risk scores are NOT
  correctness (the tool's own docs disclaim recall/precision). Its output shape ({changed file, affected
  symbol, dependent test, commit, build}) does map onto `coding-agent-v1` evidence.
- **B — OCR Benchmark** (`UNLIMITED_OCR_BENCHMARK.md`): NOT run (no GPU). Unlimited-OCR is CUDA-only,
  `trust_remote_code=True`, and does not document bounding boxes / source coordinates — the exact thing
  Shadow's `SourceEntry {X,Y,W,H}` evidence chain requires. Sanitized banking fixtures are ready as a
  benchmark corpus for a contained GPU host later; no private data anywhere.
- **C — Voice Provider Bake-Off** (`VOICE_PROVIDER_BAKEOFF.md`): planner unchanged; identical spoken
  contracts confirmed provider-independent; macOS-say fixture baseline measured (en 40.3→10.5s,
  zh 55.2→12.9s). Voicebox is desktop-only + cloning-centric → research-only; on device the baseline
  stays offline Android system TTS. Candidate cloning-free local engines noted: Kokoro (MIT), LuxTTS.

## Targeted evaluations
- **SkillOpt** (`SKILLOPT_SAFETY_EVALUATION.md`): held-out-validation-gate is a clean discipline for
  offline tuning of a **non-safety** engineering skill only; the safety invariants (integrity≠correctness,
  device-built≠device-validated, voice≠authorization, majority≠correctness) must be frozen OUT of the
  editable surface, with mandatory human approval of `best_skill.md`. Issue #154 (Goodhart) is why.
- **img2threejs** (`IMG2THREEJS_ASSET_SPIKE.md`): MIT, mobile-safe static Three.js `THREE.Group` output
  with sockets/colliders; produces exactly Shadow's hard-surface icon set and structurally cannot change
  canonical story semantics. Three experimental props specced (signed-seal / evidence-bundle /
  camera-frame); generation gated on a second authorization + explicit poly/draw-call budgets + pinned
  Three.js version + per-asset provenance.

## Verdicts

| Project | Verdict | One-line reason |
|---|---|---|
| **hoainho/img2threejs** | **ADAPT / ADOPT (authoring tool, gated)** | MIT, mobile-safe static Three.js icons w/ sockets, exactly Shadow's hard-surface set, cannot touch canonical semantics — best fit of the seven |
| **tirth8205/code-review-graph** | **ADAPT IDEAS ONLY** | local-first tree-sitter blast-radius + MCP is real value for the C# tree, but Python sidecar + circular metrics + $HOME-hygiene bugs; misses the JS↔C# mirror; risk≠correctness |
| **microsoft/SkillOpt** | **ADAPT IDEAS ONLY** | adopt the strict held-out-gate for non-safety skill tuning; freeze the safety invariants out, human-approve best_skill.md (issue #154 Goodhart) |
| **jamiepine/voicebox** | **ADAPT IDEAS ONLY** | desktop-only (no ARM64) + cloning-centric (unwanted); mine the multi-engine adapter pattern + Kokoro/LuxTTS shortlist |
| **harness-engineering (OpenAI)** | **ADAPT IDEAS ONLY** | a blog/methodology, not a repo; validates Shadow's invariant/quality-gate discipline; nothing to install |
| **baidu/Unlimited-OCR** | **RESEARCH ONLY** | CUDA-only + trust_remote_code=True + no documented coordinates → cannot serve the on-device, coordinate-anchored, offline evidence chain |
| **bojieli/ai-agent-book** | **RESEARCH ONLY** | Apache-2.0 textbook; networked LLM examples clash with Shadow's offline stance; value is learning/academic writing |
| **koala73/worldmonitor** | **REJECT (code) / RESEARCH ONLY (IA)** | AGPL-3.0 + commercial dual-license = network copyleft → forbids source/component/asset reuse in a bank-procurement product; study the spatial-dashboard IA only, copy nothing |

## Next-step gate
**No dependency will be integrated without a second explicit authorization.** The single item worth a
gated pilot is **img2threejs** (generate the three props under the documented budget/provenance gates).
code-review-graph and SkillOpt are worth a later, isolated, read-only/frozen-invariant trial if desired.
Everything else stays research/reference only. Nothing here changes production, the stable APK, or any
canonical contract.
