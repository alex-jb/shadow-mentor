# Beam Pro A/B interpretation matrix

Apply after both phases of `BEAM_PRO_SHADOW_VS_CONTROL_AB_RUNBOOK.md`. "Pass" below means the
harness classified the run at or beyond the handoff stage the row names — read the exact
classification, not the vibe.

## Outcome pairs

### A — Shadow fails, control fails
The failure is **route-level**, not Shadow-level: device/MyGlasses routing, launch procedure, OS
compatibility, MR-grid discovery, or display availability. A control built verbatim from the SDK's
own sample failing the same way exonerates candidate-04's configuration (its manifest is already
proven byte-identical on all 16 MR-critical fields).
**`CANDIDATE_05_JUSTIFIED=false`.** Next: investigate the device-side route with the saved evidence;
rerun after any device-side change.

### B — Shadow fails, control passes
A **Shadow-specific** runtime/config/startup difference exists. Inspect only the **first proven
divergence** in the PID-attributed logs (`important-lines.txt`, `device-run-summary.json` signals:
`mr_pkg_name`, `is_entry_app`, `shadow_xr_loader`, `shadow_xr_display_running`) — do not fix
downstream symptoms.
**`CANDIDATE_05_PLANNING_ELIGIBLE`** — only if the harness evidence names a specific fixable
difference. Candidate-05 is still **not built automatically**; planning is a separate task.

### C — Shadow passes, control passes
The package-handoff route works. **No candidate-05 needed for handoff.** Next: Shadow
loader/display/workspace validation on-device (the post-handoff stages), then the physical UX
observations (including UX-13's controller evidence).

### D — Shadow passes, control fails
Package handoff is Shadow-proven, but the comparison is inconclusive — investigate the control's
installation/build/runtime **independently**. Do **not** treat this as evidence that all Shadow XR
capabilities pass; only the stages the harness actually classified for Shadow are proven.

### E — Grid discovery fails before launch (either app)
`MR_GRID_DISCOVERY_FAILED`. Inspect MyGlasses/device-side discovery. No candidate-05 unless a proven
Shadow-only discovery difference exists — and the manifest diff says none does.

### F — Evidence incomplete (either phase)
`INSUFFICIENT_EVIDENCE`. No candidate-05. Rerun the affected phase with corrected collection
(longer `--seconds`, confirm the grid launch actually happened).

## Classification reference (verbatim harness values)

| classification | required evidence | proves | does NOT prove | next permitted action | candidate-05 planning? | rerun needed? |
|---|---|---|---|---|---|---|
| `MR_GRID_DISCOVERY_FAILED` | operator answered "grid visible?" = no | the app is not listed in the MyGlasses MR grid | anything about the loader or UI | device-side discovery investigation | only with a proven Shadow-only difference | yes, after change |
| `MR_PACKAGE_HANDOFF_MISSING` | `mrPkgName is empty` / `component not found` without a fallback | MyGlasses never registered the package | that the app is misconfigured (control comparison decides) | apply matrix rows A/B | per rows A/B | yes |
| `NEBULA_FALLBACK_LAUNCHER` | `mrPkgName is empty` + `go launcher`, or `LaunchSpaceAcrivity` without `isEntryApp=true` | Nebula reclaimed the glasses | which side caused it (A/B decides) | apply matrix rows A/B | per rows A/B | yes |
| `SHADOW_XR_LOADER_NOT_STARTED` | handoff signals present but no `XREALXRLoader Init/Start End` **under the app's own PID**, or `Failed to get XREAL Settings` | the app's XR plugin did not start | display/UI state | loader/config root-cause from the new log | eligible if a specific difference is named | yes |
| `SHADOW_XR_DISPLAY_NOT_RUNNING` | loader started, `disp=N/0` in `SHADOW_DEVICE_DIAG` | plugin up, display subsystem not running | workspace content issues | XR display/camera investigation (post-loader stage) | eligible if specific | yes |
| `SHADOW_RUNNING_NO_VISIBLE_WORKSPACE` | loader + display running, operator saw no workspace | render pipeline up, content not visible | comfort/readability | camera clear/clipping/layers/placement investigation | eligible if specific | yes |
| `PHYSICAL_PASS` | handoff + loader + display running **and** operator observations | the classified stages, on this run, on this device | comfort, OST readability, controller UX, long-session stability | proceed to post-handoff validation; flag promotion in a separate offline task | no — not needed | no (for this stage) |
| `INSUFFICIENT_EVIDENCE` | none of the above patterns matched | nothing | anything | rerun with corrected collection | no | yes |

The machine-readable summary (`device-run-summary.json`) carries `physical_device_validated`, which is
`true` only on `PHYSICAL_PASS` — every repository-level flag still stays false until a follow-up
offline task reviews the saved evidence.
