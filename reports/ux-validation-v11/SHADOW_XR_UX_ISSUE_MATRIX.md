# Shadow Lens V11 — XR / UX / UI issue matrix

15 issues. Every row cites a source path, a capture, or a computed geometry input. Machine-readable:
`shadow-xr-ux-issue-matrix.json`.

Severity budget: **1 P0 · 5 P1 · 6 P2 · 3 P3.** UX-01, UX-05, UX-09, UX-02, UX-03, UX-04, UX-07 and now UX-14 are
`IMPLEMENTED_OFFLINE_AWAITING_PHYSICAL_VALIDATION`; the other seven — including UX-08 and UX-12 —
remain open. P0 is reserved for a defect that stops the accepted
scene from communicating its audit result.

---

## P0

### UX-01 — On the OST-bright profile every status colour falls below WCAG 3:1

> **STATUS — `IMPLEMENTED_OFFLINE_AWAITING_PHYSICAL_VALIDATION`.** Fixed on `fix/shadow-v11-profile-aware-status-contrast`; see `SHADOW_PROFILE_AWARE_STATUS_CONTRAST_IMPLEMENTATION.md`. Offline acceptance only — `OST_READABILITY_DEVICE_VALIDATED` remains **false**.


- **Scene / component:** Audit Workspace · `Workspace/ShadowStatusGlyph.cs` + `design/shadow-spatial-tokens.json`
- **Evidence:** `PROVEN_IN_CODE` + `PROVEN_IN_EDITOR_CAPTURE` (`first-failure__en__XrealOstBright.png`) + computed
- **Current behaviour:** `ShadowStatusGlyph.Resolve(string status)` takes **only the status** — there is no profile parameter, and the canonical token file gives each status a **single** `color`. `ShadowDesignTokens.Resolve(profile)` correctly varies `TextPrimary`/`TextSecondary`, so theme text inverts for bright while every status token keeps its dark-profile colour.
- **Computed** (WCAG 2.x ratio, harness background `#C7CCD4`):

  | token | ratio |
  |---|---|
  | `VERIFIED #4ade80` | **1.08** |
  | `NOT_CHECKED / SELF_SIGNED #fbbf24` | **1.03** |
  | `NOT_PRESENT / NOT_VERIFIED / downstream #8a92a0` | **1.94** |
  | `TAMPERED / FIRST_FAILURE #ef4444` | **2.33** |

  All four fail the 3:1 non-text/large-text floor; three fail catastrophically. On `DesktopDark` the same tokens score 5.10–11.50.
- **User impact:** status *is* the entire semantic payload of this product. On the profile intended for the glasses, the workspace renders its audit verdict in colours that are effectively invisible against a bright field. The scene still draws, but it cannot communicate its result.
- **Severity P0 · confidence high · Beam Pro required to validate the *fix*, not the defect** (the defect is arithmetic).
- **Proposed correction:** give `ShadowStatusGlyph` a profile-aware colour resolution, backed by per-profile status colours in `design/shadow-spatial-tokens.json` (the schema currently has no variant slot). Regenerate through `scripts/generate-tokens.mjs`.
- **Scope:** token schema + generator + glyph resolver + parity tests. **Disposition `SAFE_V11_UX_MAINTENANCE`** · regression risk medium (token schema change touches generated adapters) · localization impact none · performance impact none · protected boundaries none.

---

## P1

### UX-02 — Left, centre and right regions overlap; text is unreadable in the accepted state

> **STATUS — `IMPLEMENTED_OFFLINE_AWAITING_PHYSICAL_VALIDATION`.** Fixed on `fix/shadow-v11-layout-capacity`; see `SHADOW_LAYOUT_CAPACITY_IMPLEMENTATION.md`. Offline acceptance only — no physical spatial or optical claim is made.


- **Scene / component:** Audit Workspace · `ShadowAuditWorkspace.cs` region positions
- **Evidence:** `PROVEN_IN_EDITOR_CAPTURE` (`first-failure__en__DesktopDark.png`) + `DERIVED_GEOMETRIC_ESTIMATE`
- **Current behaviour:** `left` sits at x −3.30 and `center` at x −0.90 — a 2.40-unit (458 px) gap, while `SOURCE NOT PRESENT` alone measures 438 px. `loc: LOCATION NOT AVAILAB…` is drawn through by `Verification: FIRST FAILURE`. `center`'s longest line (`▶ OPEN 2D AUDIT — inspect the first failure`, 693 px) overruns the 601 px gap to `right` and prints over the Trust Strip.
- **User impact:** in the *first-failure* state — the single most important state — three separate claims are rendered on top of each other. An auditor cannot read the source resolution or the trust posture.
- **Severity P1 · confidence high · Beam Pro not required.**
- **Correction:** widen the column gaps to the measured worst-case content width, or reduce `ShadowLabelMetrics` truncation budgets per column so measured width ≤ gap. **`SAFE_V11_UX_MAINTENANCE`** · low regression risk · zh-CN must be re-measured (CJK is wider per em).

### UX-03 — Row step is smaller than the line box, so every multi-row region self-overlaps

> **STATUS — `IMPLEMENTED_OFFLINE_AWAITING_PHYSICAL_VALIDATION`.** Fixed on `fix/shadow-v11-layout-capacity`; see `SHADOW_LAYOUT_CAPACITY_IMPLEMENTATION.md`. Offline acceptance only — no physical spatial or optical claim is made.


- **Evidence:** `PROVEN_IN_EDITOR_CAPTURE` + `DERIVED_GEOMETRIC_ESTIMATE`
- **Current behaviour:** body rows step −0.12 (22.9 px) and Trust-Strip label→value steps −0.10 (19.1 px), while a `T_BODY 0.026` / `fontSize 64` line box renders ≈ 30 px. `role: decision` is overprinted by `Verification:`; all four Trust Strip label/value pairs collide (`Integrity`/`FIRST FAILURE`, `Provenance`/`SELF-SIGNED`, `Decision Support`/`NOT EVALUATED`, `Human / Policy`/`APPROVAL ABSENT`).
- **User impact:** the Trust Strip — the component that states trust posture — is the least legible element on screen.
- **Severity P1 · confidence high.** **`SAFE_V11_UX_MAINTENANCE`** · low risk · worse in zh-CN, so both languages must be checked.

### UX-04 — The degraded-tracking banner is clipped mid-sentence

> **STATUS — `IMPLEMENTED_OFFLINE_AWAITING_PHYSICAL_VALIDATION`.** Fixed on `fix/shadow-v11-tracking-banner`; see `SHADOW_TRACKING_BANNER_IMPLEMENTATION.md`. Offline acceptance only — no physical tracking or optical claim is made.


- **Evidence:** `PROVEN_IN_EDITOR_CAPTURE` (`tracking-lost__en__AccessibilityHighContrast.png`)
- **Current behaviour:** the banner is placed at `top` + x 2.90 → world x −0.40 with `UpperLeft` anchoring and no truncation. `TRACKING LOST — switched to session-relative layout;` runs past the right frame edge.
- **User impact:** the message that explains a degraded spatial mode is cut off exactly when the user most needs it.
- **Severity P1 · confidence high.** **`SAFE_V11_UX_MAINTENANCE`** · trivial fix (route through `ShadowLabelMetrics.TruncateWithAffordance`, or right-anchor it) · both languages.

### UX-05 — The `SIMULATED — NOT DEVICE VALIDATED` disclaimer is the least readable text in the dark profiles

> **STATUS — `IMPLEMENTED_OFFLINE_AWAITING_PHYSICAL_VALIDATION`.** Fixed on `fix/shadow-v11-profile-aware-status-contrast`; see `SHADOW_PROFILE_AWARE_STATUS_CONTRAST_IMPLEMENTATION.md`. Offline acceptance only — `OST_READABILITY_DEVICE_VALIDATED` remains **false**.


- **Evidence:** `PROVEN_IN_CODE` (`Hex("#961418")` hardcoded in `RebuildHeader`) + computed
- **Computed:** `#961418` scores **2.20** on `DesktopDark` and **2.41** on `AccessibilityHighContrast` — both below 3:1. It scores 5.40 on the bright profile, i.e. the colour is tuned for the *opposite* profile and ignores the active one.
- **User impact:** this is the honesty guarantee that stops an Editor screenshot being mistaken for device evidence. It is currently the hardest thing on screen to read, in the two profiles used for most captures.
- **Severity P1 · confidence high.** **`SAFE_V11_UX_MAINTENANCE`** · trivial · same root cause family as UX-01 (a colour that bypasses the profile).

### UX-06 — Eight PlayMode tests fail at the audited baseline

> **STATUS — `IMPLEMENTED_OFFLINE`.** Restored on `fix/shadow-v11-playmode-baseline`; see `SHADOW_PLAYMODE_BASELINE_RESTORATION.md`. Full PlayMode 101/99/**0**/2 twice — 2 production fixes + 4 stale expectations realigned to documented contracts.


- **Scene / component:** `Tests/PlayMode/ShadowLensPlayModeTests.cs` (4), `ShadowSpatialAgentPanelPlayModeTests.cs` (4)
- **Evidence:** `PROVEN_IN_PLAYMODE` — full PlayMode run at `e14e264`: 70 total, 60 passed, **8 failed**, 2 skipped. Failures persist when the class is run in isolation, so they are not whole-suite ordering artefacts.
- **Failures:** `AnalyzeCausesVisibleStateChange` (NullReference) · `DecisionPanelPopulatesInView` (expected not-null, was null) · `Reset_ReturnsToReadyAndUnsigned` (NullReference) · `ShowSource_CreatesVisibleOverlay` (got `ANALYZE`, expected `SHOW_SOURCE`) · `BankingThenDataScience_NoStaleCrossProfileState`, `DataScienceThenCoding_SwitchesCleanly`, `PresenterReset_FromAnyProfile_ReturnsToBankingReady` (all *expected 0, was 1*) · `Coding_DiffFocusVisible` (got `HIGHLIGHT: cmd_test`).
- **User impact:** the presenter / spatial-agent-panel surface does not clear state between profiles. This is **not** the Audit Workspace — the Workspace lifecycle and capture tests pass — but it means "V11 is green" was only ever true for the subsets previously run.
- **Severity P1 · confidence high · Beam Pro not required.** **Disposition `DEFER_TO_POST_V11`** for the fix; recorded here because the audit found it and it must not stay invisible.

---

## P2

### UX-07 — First failure is not the visual focus

> **STATUS — `IMPLEMENTED_OFFLINE_AWAITING_PHYSICAL_VALIDATION`.** Fixed on `fix/shadow-v11-first-failure-hierarchy`; see `SHADOW_FIRST_FAILURE_HIERARCHY_IMPLEMENTATION.md`. Offline acceptance only. UX-12 is not resolved — only the Audit Workspace changed.


- **Evidence:** `PROVEN_IN_EDITOR_CAPTURE` (`first-failure__en__DesktopDark.png`) + `PROVEN_IN_CODE`
- **Behaviour:** the two largest elements are `Banking Audit` (`T_TITLE`) and the focused entity title `Council Decision` (`T_TITLE`). The first-failure marker is `T_LABEL 0.030` — smaller than both — and the word "FIRST FAILURE" appears four times at four sizes in three regions. Red is used for the failure, for the disclaimer and for the rail marker.
- **Impact:** the eye lands on the story title, not on the failure. Repetition without hierarchy dilutes the signal it is meant to carry. **P2 · `SAFE_V11_UX_MAINTENANCE`.**

### UX-08 — 29 % of the frame is empty while the top band is crowded

- **Evidence:** `DERIVED_GEOMETRIC_ESTIMATE` — centre content ends at world y 0.08, the rail begins at y −1.44: a 1.52-unit gap out of 5.24 visible units, with all three columns compressed into the top 40 %.
- **Impact:** the crowding in UX-02/UX-03 is self-inflicted — the composition has room it does not use. **P2 · `SAFE_V11_UX_MAINTENANCE`.**

### UX-09 — `AccessibilityHighContrast` is visually indistinguishable from `DesktopDark`

> **STATUS — `IMPLEMENTED_OFFLINE_AWAITING_PHYSICAL_VALIDATION`.** Fixed on `fix/shadow-v11-profile-aware-status-contrast`; see `SHADOW_PROFILE_AWARE_STATUS_CONTRAST_IMPLEMENTATION.md`. Offline acceptance only — `OST_READABILITY_DEVICE_VALIDATED` remains **false**.


- **Evidence:** `PROVEN_IN_EDITOR_CAPTURE` (compare `tracking-lost__en__AccessibilityHighContrast.png` with `…__DesktopDark.png`) + computed (status ratios 5.58–12.58 vs 5.10–11.50 — a difference driven only by the black background, not by any token).
- **Behaviour:** the profile changes `TextPrimary`/`TextSecondary` and the background; every status colour is identical. Since most semantic content is status-coloured, the "high contrast" profile delivers almost no additional contrast where it matters. **P2 · same root cause as UX-01 · `SAFE_V11_UX_MAINTENANCE`.**

### UX-10 — `role:` value is not localized

- **Evidence:** `PROVEN_IN_EDITOR_CAPTURE` (`first-failure__zh-CN__DesktopDark.png` shows `角色: decision`) + `PROVEN_IN_CODE` (`Label(r, LL("role") + ": " + focus.Role, …)` — the key is localized, the value is passed through raw).
- **Impact:** English leaks into the Chinese view on a semantic field. **P2 · `SAFE_V11_UX_MAINTENANCE`.**

### UX-11 — Absence is encoded three different ways

- **Evidence:** `PROVEN_IN_EDITOR_CAPTURE` + `PROVEN_IN_CODE`
- **Behaviour:** in one frame, missing evidence appears as bright white `SOURCE NOT PRESENT`, grey `resolution: NOT PRESENT`, grey `OCR: NOT EVALUATED` and grey `Approval: APPROVAL ABSENT` — and the same grey `#8a92a0` also means *downstream-affected*. "Not present", "not evaluated" and "affected downstream" are three different epistemic states sharing one colour.
- **Impact:** the brief's own requirement — absent evidence must be distinct from unknown evidence — is not met. **P2 · `SAFE_V11_UX_MAINTENANCE`.**

### UX-12 — The Workspace and the Audit Room contradict each other on what "verified" looks like

- **Evidence:** `PROVEN_IN_CODE` — `demos/replay/3d/constants.js` defines `intact #E8E8E8` as a **neutral** resting surface with verification carried by deviation (red tamper, transient green heal), pinned by `test/threejs-profile-override.test.js`; the Unity workspace paints `VERIFIED #4ade80` green as a resting state.
- **Impact:** the same user sees two incompatible colour grammars for the same concept across the two surfaces. The Flat rule is the documented and tested one. **P2 · `DEFER_TO_POST_V11`** (resolving it means choosing one grammar for both surfaces).

---

## P3

### UX-13 — No focus / selected / hover / disabled model exists

`PROVEN_IN_CODE` — no `EventSystem`, no raycaster, no `Selectable`; focus is a rebuild of the centre region with no persistent visual state. Prev/Next/Select map to `FocusOn` only. Rail items encode `IsCurrent` as a quad scale (0.15 vs 0.09) and a slightly larger `#n`. There is no hit target, so accidental-activation risk is nil, and equally there is no controller affordance. **P3 · `REQUIRES_DEVICE_VALIDATION`** before designing one.

### UX-14 — Rail label collides with the rail index

> **STATUS — `IMPLEMENTED_OFFLINE_AWAITING_PHYSICAL_VALIDATION`.** Fixed on `fix/shadow-v11-evidence-guide-layout`; see `SHADOW_EVIDENCE_GUIDE_IMPLEMENTATION.md`. Offline acceptance only.


`PROVEN_IN_EDITOR_CAPTURE` — `FIRST` (y +0.16) sits over `#3` (y −0.16) at the same x, and the action row at y −0.36 runs under the `#n` row. **P3 · `SAFE_V11_UX_MAINTENANCE`.**

### UX-15 — The capture harness pollutes the shared PlayMode session

`PROVEN_IN_PLAYMODE` — with `SHADOW_CAPTURE=1` the run fails 10 tests; without it, 8. The extra two are `ExactlyOneActiveMainCamera` and `RepeatedUpdates_DoNotLeakOrDuplicate`. The harness destroys every `ShadowStageController` and `ShadowLensRuntimeBootstrap` root and creates a second `MainCamera`-tagged `CaptureCam` that it never removes. **P3 · audit-tooling only, zero production impact · `SAFE_V11_UX_MAINTENANCE`.**

---

## Requires Beam Pro before any claim

| Item | Why |
|---|---|
| whether the OST-bright palette fix actually reads through the optics | simulated background ≠ real world light |
| head-movement burden, neck strain, comfort | no pose path exists in-scene; cannot be simulated |
| controller affordance and target sizes | no input model exists yet |
| whether the missing XR Origin / TrackedPoseDriver matters in practice | only reachable after the MR package handoff passes |
| real angular occupation of the panels | the capture rig FOV is not the headset FOV, and no headset FOV is asserted anywhere |
