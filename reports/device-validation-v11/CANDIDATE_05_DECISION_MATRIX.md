# candidate-05 decision matrix

One harness run decides this. Run it, read the classification, then use exactly one row.

```
bash scripts/beampro-device-test.sh \
  --package com.shadowlens.xrealvoice \
  --expected-version 0.11-beampro-candidate.4 \
  --mode myglasses-grid
```

Optional but recommended second run — the **official control** as an A/B (same command, different
package), which separates "Shadow is broken" from "this device/route never works":

```
# install once: adb install -r <control apk from the disposable project>
bash scripts/beampro-device-test.sh \
  --package com.shadowlens.xrealcontrol \
  --expected-version 3.1.0-control \
  --mode myglasses-grid
```

## Standing gate

candidate-05 is permitted **only** when the run yields a concrete classification **and** names a
configuration or routing difference that the offline diff has not already ruled out. The offline diff
found **zero** MR-critical manifest differences, so *manifest-registration* fixes are off the table
unless a run produces evidence that contradicts the diff.

## Matrix

| Harness classification | What the offline evidence already says | Permitted candidate-05 fix |
|---|---|---|
| `MR_GRID_DISCOVERY_FAILED` | Shadow's discovery meta-data is byte-identical to the official control. If the **control also fails** to appear → device/MyGlasses issue, **no candidate-05**. If the **control appears and Shadow does not** → a difference exists outside the manifest; find it before building. | Only a difference proven by that A/B run. Never a speculative `com.xreal.entry`. |
| `MR_PACKAGE_HANDOFF_MISSING` | `mrPkgName` is device-side only; no SDK symbol writes it. | Only a proven handoff fix. If the same run shows the control handing off correctly, the delta is in Shadow's runtime, not its manifest. |
| `NEBULA_FALLBACK_LAUNCHER` | Observed in candidate-04 after a **direct** launch. | Only a proven MyGlasses routing difference. If the grid launch removes it, **no candidate-05** — the fix was the launch route. |
| `SHADOW_XR_LOADER_NOT_STARTED` | candidate-04 already fixed the embedded-settings defect (candidate-03). A recurrence means a *different* loader/config/startup cause. | Loader/config/startup fix, root-caused from the new log — not a re-application of the candidate-03 fix. |
| `SHADOW_XR_DISPLAY_NOT_RUNNING` | Only reachable **after** Shadow's own loader passes. | Now — and only now — the rig is in scope: XR Origin / TrackedPoseDriver / camera / `XREALSessionManager`, i.e. Finding A2 in `SHADOW_VS_XREAL_CONTROL_DIFF.md`. |
| `SHADOW_RUNNING_NO_VISIBLE_WORKSPACE` | Process alive, XR display running, nothing seen. | Camera clear flags, near/far clipping, layers, world-space placement/scale of the workspace. |
| `PHYSICAL_PASS` | — | **No candidate-05.** Record the flags the run actually earned; leave the rest false. |
| `INSUFFICIENT_EVIDENCE` | — | **No candidate-05.** Re-run with a longer `--seconds` and the control A/B. |

## Two questions the next physical run must answer

1. Does the **MyGlasses-grid launch** set `mrPkgName = com.shadowlens.xrealvoice` and log
   `isEntryApp` / `multiResumeMode` differently from the direct launch? (The harness captures the
   full `NRXRApp onCreate:` line, which also carries `debugClose=` and `mainActivity=`, plus the
   per-display `displayId:<n>, isNrealDisplay:<bool>` lines that show whether the app could see the
   glasses display at all.)
2. Does `XREALXRLoader Init/Start End` appear **under Shadow's own PID** — not Nebula's? The harness
   enforces this attribution; `nebula_xr_loader` is reported as a separate signal so the candidate-04
   mis-read cannot recur.

## Flags that stay false until a run earns them

`SHADOW_MR_PACKAGE_HANDOFF_PASSED` · `SHADOW_XREAL_LOADER_DEVICE_PASSED` ·
`AUDIT_WORKSPACE_RENDERED_IN_GLASSES` · `XREAL_3DOF_DEVICE_VALIDATED` ·
`BEAM_PRO_CONTROLLER_VALIDATED` · `OST_READABILITY_DEVICE_VALIDATED` · `PRODUCTION_READY`
