# Impeccable audit — 2026-07-13

**Ran**: `npx impeccable detect verify.html demos/replay/index.html demos/replay/styles.css README.md`

**Version**: impeccable@3.2.1

**Result**: 5 warnings across 4 files. Zero errors.

Impeccable is Peter Bakaus's anti-slop design skill for AI coding
agents. The `detect` CLI runs 46 deterministic rules with NO LLM and
NO API key. This audit is captured now so it can be applied AFTER
Wednesday's Lora demo per the "周三前 nothing else" discipline.

## Findings — ranked by whether to apply

### 🟡 apply post-Wed — real signal

**1. `flat-type-hierarchy` — verify.html**
- Rule: font sizes too close together, no clear hierarchy
- Snippet: sizes 12 / 13 / 14 / 15 / 16 / 22 px used (ratio 1.8:1
  between step and top, but many mid-steps are ≤1.1×)
- Fix: collapse to 3 tiers — body 14 px, subhead 17 px, hero 22 px.
  Ratio 1.25:1 between each. Impeccable target achieved with less
  cognitive tax on the reader.
- Effort: ~15 min after Wed

**2. `em-dash-overuse` — demos/replay/index.html body copy**
- Rule: more than 2 em-dashes in body reads as AI cadence
- Snippet: 7 em-dashes in body text
- Fix: rewrite drop-zone text + hint copy to use commas / periods /
  colons instead. Preserve section headings that use dashes as
  section markers.
- Effort: ~10 min after Wed

**3. Repeat the audit on `packages/adapter-claude-code/README.md`** —
  not scanned this pass because it's an internal doc, but 8/2 launch
  push should include it. Add to `scripts/pre-launch-lint.sh` if we
  build one.

### ⚪ false positive / intentional — do NOT apply

**4. `side-tab` — demos/replay/styles.css lines 195-196**
- Rule flags `border-left: 3px solid` as the classic AI-slop
  "side-tab accent border" tell
- Reality: these two borders are the M5 replay's SELECTED-row and
  TAMPERED-row indicators. Removing them means the auditor can't
  tell which event is highlighted or which one broke the chain.
  Functional, not decorative.
- Action: add to Impeccable's `.impeccable/config.json` ignore list
  post-adoption. `npx impeccable ignores add-file "demos/replay/styles.css"`
  or `add-value side-tab border-left --reason "M5 row selection/tamper indicator"`.

**5. `overused-font` — demos/replay/index.html**
- Rule flags Roboto as an overused AI-generated font
- Reality: Roboto appears only as a FALLBACK in the system-font stack
  (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, ...`) —
  never actually rendered on macOS/iOS/Windows/Chrome-Linux. It's
  the Android fallback. Detector's regex isn't stack-aware.
- Action: no fix; document as known false positive.

## Adoption plan (post-Wed, before 2026-08-02 launch)

1. Fix findings 1 + 2 in a single commit (~25 min).
2. Install Impeccable properly: `git submodule add https://github.com/pbakaus/impeccable .vendor/impeccable` (per research advice — pin, don't `npx install` global, avoid solo-maintainer single-point-of-failure).
3. Add `.impeccable/config.json` with the false-positive ignores documented above.
4. Add `npx impeccable detect --json .` to `.github/workflows/test.yml` as a warning-only check. Impeccable failures shouldn't block CI (they're taste, not correctness) but they should surface in PR reviews.
5. Re-audit `packages/adapter-claude-code/README.md` and any docs/dogfood-evidence/*.md.

## What NOT to do

- Do NOT run `npx impeccable install` in shadow-mentor before Wed.
  The installer writes to `.claude/settings.local.json` which would
  interfere with the M2.1 adapter hooks Alex has configured for
  dogfood.
- Do NOT apply findings before Wed. The demo runs the current
  verify.html + M5 replay verbatim; changing them tonight risks
  breaking the Wednesday-morning smoke test.
- Do NOT install the Impeccable hook (`hook.mjs`) — same reason as
  above, hooks can conflict with our shadow-record hooks.

## References

- Impeccable README: https://github.com/pbakaus/impeccable
- Impeccable homepage: https://impeccable.style
- Peter Bakaus (author, ex-Google Chrome DevTools PM): https://bakaus.com
- Deep research summary: alex-brain memory `reference_impeccable_taste_skill_audit_2026_07_13`
- Related but simpler alternative: Taste Skill (already installed in
  vibex `.claude/skills/taste-skill/`) — better for VibeXForge CJK
  audience, less ceremony
