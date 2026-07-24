# Shadow Lens V11 — recommended first implementation increment

**Not implemented in this task.** This is the proposal only.

## The increment

> **Make status colours profile-aware — resolve UX-01 (P0) and UX-09 (P2), and fold in the hardcoded
> `SIMULATED` disclaimer colour (UX-05, P1).**

## Why this one

It is the only P0. Every other finding degrades readability; this one removes the product's ability to
communicate its result on the profile intended for the glasses. Four status colours currently score
**1.03 – 2.33** against the OST-bright background, all below the 3:1 floor, and status is the entire
semantic payload of an audit workspace. Fixing layout first (direction A) would produce a beautifully
spaced view that is still unreadable on the profile that matters.

It also has the best evidence quality in the matrix: the defect is arithmetic, not aesthetic. It is
provable in code (`ShadowStatusGlyph.Resolve(string status)` has no profile parameter;
`design/shadow-spatial-tokens.json` has one `color` per status), visible in a committed capture, and
independently confirmed by a contrast calculation whose formula and inputs are recorded.

## Boundary compliance

| Requirement | Status |
|---|---|
| does not touch MR package handoff | ✔ token/colour layer only |
| does not touch candidate-01…04 | ✔ no APK is built |
| does not touch the stable APK | ✔ |
| does not touch the frozen verifier | ✔ |
| no Time Mode, no V12 | ✔ |
| reversible | ✔ one token-schema field + one resolver signature; revert restores byte-identical output |
| implementable without Beam Pro | ✔ the fix is arithmetic; the *claim* about optics still needs the device |
| preserves English and Chinese | ✔ colour resolution is language-independent; both languages must be re-captured |

## Scope

1. Add a per-profile colour variant to the status entries in `design/shadow-spatial-tokens.json`
   (schema currently has no slot for one).
2. Regenerate the adapters through `scripts/generate-tokens.mjs`; `--check` must stay clean.
3. Give `ShadowStatusGlyph.Resolve` a profile argument (default = `DesktopDark` so existing callers
   keep working), and pass `Profile` from `ShadowAuditWorkspace`.
4. Route the `#961418` disclaimer through the same profile resolution.
5. Do **not** change any layout constant — that is direction A, a separate increment.

## Acceptance criteria

**Screenshot** — re-run the existing harness (`SHADOW_CAPTURE=1`) and confirm on
`first-failure__en__XrealOstBright.png` and `…__zh-CN__…` that every status token is legible against
the bright field, and on `tracking-lost__en__AccessibilityHighContrast.png` that the profile now looks
materially different from `DesktopDark`. Because the harness is **not byte-deterministic** (all 39 PNGs
regenerate with different bytes at the same commit), acceptance is a contrast computation plus visual
review, not an image diff.

**Computed** — a new test asserts every status colour scores ≥ 3.0 against its profile background:

| profile | background | required |
|---|---|---|
| DesktopDark | `#0B0F16` | ≥ 3.0 for all status tokens **and** the disclaimer |
| XrealOstBright | `#C7CCD4` | ≥ 3.0 for all status tokens **and** the disclaimer |
| AccessibilityHighContrast | `#000000` | ≥ 4.5 (the profile's stated purpose) |

Current failures this must clear: `#4ade80` 1.08, `#fbbf24` 1.03, `#8a92a0` 1.94, `#ef4444` 2.33 on
bright; `#961418` 2.20 / 2.41 on the dark profiles.

**EditMode** — 136/136 must stay green, including the token-parity tests, which will need updating in
the same commit (they currently pin one colour per status).

**PlayMode** — `ShadowAuditWorkspaceLifecycleTests` must stay green with the unique-material count
unchanged in shape: the shared `_matCache` is keyed by colour hex, so adding per-profile colours
increases the cache only when profiles are actually switched at runtime. The 8 pre-existing
presenter/spatial-agent-panel failures (UX-06) are **out of scope** and must neither be fixed nor made
worse.

## Stop point

Stop after the contrast test passes and the captures are regenerated and reviewed. **Do not** claim
OST readability — that requires the Beam Pro, and `OST_READABILITY_DEVICE_VALIDATED` stays false.

## Explicitly not in this increment

Layout metrics (UX-02, UX-03, UX-04, UX-08, UX-14) · hierarchy rework (UX-07) · absence encoding
(UX-11) · cross-surface colour grammar (UX-12) · interaction model (UX-13) · the presenter PlayMode
failures (UX-06) · the capture-harness session pollution (UX-15).
