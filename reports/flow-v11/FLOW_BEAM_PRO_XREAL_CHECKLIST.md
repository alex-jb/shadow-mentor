# Shadow → Flow Beam Pro / XREAL Device Validation Checklist

**Status:** NOT YET EXECUTED. This is the remaining physical-device work after the desktop browser import succeeded on 2026-07-27.

## Goal

Verify whether the same Flow that opened in the desktop browser can be opened and read on Beam Pro + XREAL One Pro. This checklist is evidence-only: do not promote any flag until the observation is recorded.

## Preconditions

- [ ] Flow is saved in the operator's Flow account (save/reopen already validated on desktop).
- [ ] Beam Pro is powered on and paired with XREAL One Pro.
- [ ] Beam Pro browser can reach `a.flow.gl`.
- [ ] Operator is signed in to the same Flow account used for the desktop import.

## Entry path

```text
Beam Pro browser -> a.flow.gl -> Flow Lister -> select the Shadow Flow
```

## Checks

| # | Check | Pass criterion | Status |
|---|---|---|---|
| 1 | Flow Lister shows the saved Shadow Flow | visible in the list | NOT_TESTED |
| 2 | Flow opens on Beam Pro browser | scene starts loading | NOT_TESTED |
| 3 | Scene displays in XREAL glasses | image visible in glasses | NOT_TESTED |
| 4 | Labels are readable at normal viewing distance | operator can read `HASH CHAIN: FAILED`, `REVIEW`, etc. | NOT_TESTED |
| 5 | First-failure node is visually emphasized | center node or highlight visible | NOT_TESTED |
| 6 | Council ring is distinguishable from lineage path | spatial grouping matches desktop scene | NOT_TESTED |
| 7 | Downstream nodes are distinguishable | 3 affected nodes visible | NOT_TESTED |
| 8 | Disclaimer is visible | `Flow visualization of a Shadow fixture; no physical Shadow Lens capability is claimed.` | NOT_TESTED |
| 9 | Beam Pro controller can navigate / select | no interaction blockers | NOT_TESTED |
| 10 | Save/reopen persists on device | reopening the Flow shows the same scene | NOT_TESTED |

## Honest recording rules

- If any check fails, record the exact symptom and the check number.
- Do not edit `shadow-flow-vendor-graph.csv` or the transformer to make the scene prettier on device.
- Do not claim `flow_beam_pro_browser_validated` or `flow_xreal_display_validated` until the corresponding check passes.
- Do not promote any native Shadow Lens physical flag.

## Flags that remain false until observed

From `reports/device-validation-v11/v11-pre-device-state.json`:

- `SHADOW_MR_PACKAGE_HANDOFF_PASSED`
- `SHADOW_XREAL_LOADER_DEVICE_PASSED`
- `AUDIT_WORKSPACE_RENDERED_IN_GLASSES`
- `XREAL_3DOF_DEVICE_VALIDATED`
- `BEAM_PRO_CONTROLLER_VALIDATED`
- `OST_READABILITY_DEVICE_VALIDATED`
- `PROFILE_AWARE_STATUS_CONTRAST_DEVICE_PASSED`
- `SHADOW_LAYOUT_CAPACITY_DEVICE_PASSED`
- `SHADOW_TRACKING_BANNER_DEVICE_PASSED`
- `SHADOW_FIRST_FAILURE_HIERARCHY_DEVICE_PASSED`
- `SHADOW_EVIDENCE_GUIDE_DEVICE_PASSED`
- `PRODUCTION_READY`

## Next action

1. Re-open the saved Flow on the desktop to confirm save/reopen.
2. Open the Flow on Beam Pro + XREAL One Pro.
3. Record the outcome of each check above.
4. Update `FLOW_BROWSER_IMPORT_EVIDENCE_2026-07-27.md` and `SHADOW_FLOW_SPIKE_FINAL.md` only with observed facts.
