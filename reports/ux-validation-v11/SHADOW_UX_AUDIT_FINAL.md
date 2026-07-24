# Shadow Lens V11 — offline XR / UX / UI audit, final

```
SHADOW_OFFLINE_UX_AUDIT_COMPLETED
```

Performed entirely from repository source, committed Editor captures, and the normal Unity CLI test
workflow. **No Unity MCP, no Unity Assistant, no package installation, no device.**

## Baseline

`e14e264` · branch `feat/shadow-spatial-ux-asset-audit-v11` · clean tree · harness 34/34 ·
Node 2044 pass / 0 fail / 3 skipped · tokens `--check` clean · all 8 protected artifacts matched.
The audit ran in an isolated worktree on `chore/shadow-v11-offline-xr-ux-audit`; the main V11 worktree
was never opened in Unity.

## What the evidence says

The Audit Workspace is **structurally sound and metrically broken**.

Structurally: one camera, five reused regions, no duplicate systems, no `DontDestroyOnLoad`, shared
materials from a hex-keyed cache, and a 32-cycle lifecycle test that pins region count, material count
and orphan count. Zero Canvases and zero TextMeshPro components means the entire standard Unity-UI
performance risk list — canvas rebuild pressure, nested layout groups, `ContentSizeFitter` thrash —
simply does not apply. EditMode is 136/136.

Metrically: the layout constants do not match the text they have to hold. The column gap is 458 px and
the content is 438 px; the centre column's longest line is 693 px in a 601 px gap; body rows step
22.9 px through a ~30 px line box; the Trust Strip steps 19.1 px between a label and its value. The
result is visible in the committed captures — in the *first-failure* state, the state that matters
most, `loc: LOCATION NOT AVAILAB…` is printed through by `Verification: FIRST FAILURE`, and all four
Trust Strip label/value pairs overlap. Meanwhile 29 % of the frame sits empty.

And one defect outranks all of them. **On the OST-bright profile every status colour falls below the
3:1 contrast floor** — `#4ade80` at 1.08, `#fbbf24` at 1.03, `#8a92a0` at 1.94, `#ef4444` at 2.33 —
because `ShadowStatusGlyph.Resolve` takes only a status and the canonical token file gives each status
exactly one colour. Theme text inverts correctly for bright; the semantic layer never does. The same
root cause explains why `AccessibilityHighContrast` is visually indistinguishable from `DesktopDark`,
and a sibling of it explains why the `SIMULATED — NOT DEVICE VALIDATED` disclaimer — the guarantee
that keeps Editor screenshots from being mistaken for device evidence — scores 2.20 in the dark
profiles.

## Findings the audit surfaced that were not being looked for

- **Eight PlayMode tests fail at the audited baseline** (presenter / spatial-agent-panel surfaces),
  and they fail in isolation, so they are not a whole-suite ordering artefact. Previous "green"
  statements covered the subsets that were run, not the platform. The Audit Workspace's own tests pass.
- **The capture harness pollutes the shared PlayMode session** — it destroys the stage and bootstrap
  roots and leaves a second `MainCamera`-tagged camera, taking the failure count from 8 to 10.
- **The capture harness is not byte-deterministic** — all 39 PNGs regenerate with different bytes at
  the same commit. It is a capture tool, not a regression gate.
- **The two surfaces contradict each other**: the Audit Room Flat treats `intact` as a *neutral*
  surface with verification carried by deviation (documented and test-pinned), while the Workspace
  paints VERIFIED green as a resting state.

## Severity distribution

1 × P0 · 5 × P1 · 6 × P2 · 3 × P3. Full detail with source paths, capture references, computed inputs
and dispositions in `SHADOW_XR_UX_ISSUE_MATRIX.md` / `shadow-xr-ux-issue-matrix.json`.

## Recommended first increment

**Make status colours profile-aware** (UX-01 P0, folding in UX-09 and UX-05). It is the only P0, the
defect is arithmetic rather than aesthetic, and fixing layout first would produce a well-spaced view
that is still unreadable on the profile intended for the glasses. Full acceptance criteria in
`SHADOW_FIRST_UX_INCREMENT_PROPOSAL.md`. **Not implemented in the audit** — subsequently implemented on
`fix/shadow-v11-profile-aware-status-contrast` and marked
`IMPLEMENTED_OFFLINE_AWAITING_PHYSICAL_VALIDATION`.

## Honesty boundaries held

Every visual artifact referenced is labelled `EDITOR_SIMULATION_ONLY` / `NOT_BEAM_PRO_EVIDENCE` /
`NOT_OST_EVIDENCE` / `NOT_PHYSICAL_XR_VALIDATION`. No comfort, tracking, controller or optical
readability claim is made anywhere. The capture-rig geometry is labelled `EDITOR_GEOMETRY_ESTIMATE`
and **no headset field-of-view value is asserted** — the repository supplies none.

The missing XR Origin / TrackedPoseDriver is recorded as a **future loader/display-stage risk and
runtime architecture concern**, explicitly **not** as the MR package-handoff root cause: candidate-04
fails before that stage is reached.

Six states requested by the brief could not be produced from existing fixtures and are recorded as
`NOT_CAPTURED_WITH_EXISTING_FIXTURES` rather than fabricated.

```
SHADOW_MR_PACKAGE_HANDOFF_PASSED      false
SHADOW_XREAL_LOADER_DEVICE_PASSED     false
AUDIT_WORKSPACE_RENDERED_IN_GLASSES   false
XREAL_3DOF_DEVICE_VALIDATED           false
BEAM_PRO_CONTROLLER_VALIDATED         false
OST_READABILITY_DEVICE_VALIDATED      false
PRODUCTION_READY                      false
```

candidate-05 not built · Time Mode not started · V12 not started · nothing merged.

Subsequently implemented offline, each in its own isolated branch: UX-01/UX-05/UX-09 (profile-aware
status colour, `d664873`) UX-02/UX-03 (layout capacity + vertical rhythm,
`fix/shadow-v11-layout-capacity`) and UX-04 (tracking-banner viewport safety,
`fix/shadow-v11-tracking-banner`) UX-07 (first-failure information hierarchy,
`fix/shadow-v11-first-failure-hierarchy`) and UX-14 (evidence-guide internal layout,
`fix/shadow-v11-evidence-guide-layout`). All are `IMPLEMENTED_OFFLINE_AWAITING_PHYSICAL_VALIDATION`.
