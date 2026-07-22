# SkillOpt safety evaluation (microsoft/SkillOpt)

Research-only. SkillOpt was **NOT run** and **NOT installed**. This report evaluates the safety envelope
required IF it were ever used to optimize a non-safety engineering skill. 2026-07-22.

## Verified facts (real, via GitHub API)
- `github.com/microsoft/SkillOpt`, commit `6173e39` (2026-07-21), release **v0.2.0** (2026-07-02),
  **MIT**, Python 84%, **14,341 stars**. **No torch/transformers/GPU** — pure LLM-API orchestration.
- It optimizes a **prompt/skill artifact** (a single `best_skill.md`, 300–2,000 tokens), NOT model
  weights. The target model stays frozen. Deployment adds **zero** inference-time optimizer calls.
- **Held-out validation gate: YES** — "a candidate edit is accepted only when it strictly improves a
  held-out validation score." Bounded add/delete/replace edits + rejected-edit buffer.
- Harnesses: Claude Code CLI + Codex CLI + direct chat. Network: calls the configured LLM API only
  during training; no telemetry, no weight download.
- **Open issue #154:** "Mining is limited to programmatic success checks — intent-level improvements get
  dropped or **Goodharted into shallow proxy rules**." This is a documented reward-hacking failure mode.

## Why this is exactly the mechanism Shadow's invariants exist to resist
SkillOpt is an automated **text-space optimizer that rewrites prompt/skill files toward a proxy score**.
Shadow's safety invariants are precisely the things that must NEVER be optimized away:
- `integrity ≠ correctness` · `device-built ≠ device-validated` · `voice ≠ authorization` ·
  `majority ≠ correctness` · `ANALYTICAL_CORRECTNESS` is always `NOT_EVALUATED`.
Issue #154 confirms the tool will Goodhart toward shallow proxies — so it must be firewalled from those.

## Permitted use envelope (only with a second explicit authorization)
1. **Non-safety engineering skill ONLY.** Candidates: Unity import-drift triage, XREAL build-failure
   diagnosis, manifest permission audit, device-day bug triage, completion-report honesty classification.
   NEVER a persona/verdict/status-invariant skill.
2. **Freeze the safety surface.** The safety-invariant text (the four `≠` rules, the status ladder
   semantics, the verdict guardrails) is placed OUTSIDE the editable surface — SkillOpt may not read or
   write those files. This is the hard boundary; the constraint said "prohibit edits to Shadow
   truth/status guardrails."
3. **Held-out validation set** built from Shadow's own deterministic fixtures (never leak private data),
   used as the strict-improvement gate.
4. **Manual approval of `best_skill.md`** is REQUIRED before any use — a human reads the diff, confirms
   no invariant was weakened, and only then adopts it. No auto-adoption.
5. **Isolated experiment branch**, no merge, no CI wiring, no `.mcp.json`/hooks/global-config change.

## Constraints observed (this spike)
Not installed · not run · no skill optimized · no guardrail touched · nothing merged. No `best_skill.md`
was generated (that step requires the second authorization + a frozen-invariant setup).

## Verdict
**ADAPT IDEAS ONLY.** Adopt the **strict held-out-validation-gate** discipline (accept an edit only on a
strictly-improving held-out score) for disciplined offline tuning of a **non-safety** engineering skill.
If the tool itself is ever used: freeze all safety-invariant text out of the editable surface, keep a
mandatory human approval of `best_skill.md`, run on an isolated branch, and never let it touch the
integrity/status/verdict guardrails. Issue #154's Goodhart warning is the reason the firewall is
non-negotiable.
