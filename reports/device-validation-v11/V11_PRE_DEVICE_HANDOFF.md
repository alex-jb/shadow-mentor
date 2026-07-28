# V11 pre-device handoff

```
V11_OFFLINE_READY_FOR_DEVICE_AB
```

Everything the physical session needs, in one place. Frozen at `aae8bea`.

## The state you are handing to the device

- **Six implemented UX increments**, each on its own pushed branch, each
  `IMPLEMENTED_OFFLINE_AWAITING_PHYSICAL_VALIDATION` (UX-06 is `IMPLEMENTED_OFFLINE` — it was a test
  baseline, not a visual): d664873 → d7feb01 → 01864b4 → 3c5e9ba → 9958432 → aae8bea.
- **Full PlayMode genuinely green**: 101 / 99 / 0 / 2, twice, fresh processes.
- **Six issues deliberately open**, none blocking the A/B (`V11_REMAINING_ISSUE_DISPOSITION.md`).
- **candidate-04 frozen** (`832c875a…`, installed on the Beam Pro) and the **official HelloMR control**
  built (`0d629d75bd03ffce…`, operator-local, never installed). Their manifests are byte-identical on
  all 16 MR-critical fields — so the A/B isolates the *runtime/route*, not configuration.
- **The open device question is unchanged since candidate-04**: does launching from the MyGlasses MR
  grid set `mrPkgName` and make `isEntryApp` behave, or does Nebula reclaim the glasses? The A/B
  answers it with a control that cannot be misconfigured relative to Shadow.

## The session, in three lines

1. `bash scripts/beampro-device-test.sh --package com.shadowlens.xrealvoice --expected-version 0.11-beampro-candidate.4 --mode myglasses-grid` → launch **Shadow Lens from the MyGlasses MR grid** when prompted → save evidence copy.
2. Same command with `--package com.shadowlens.xrealcontrol --expected-version 3.1.0-control --apk <OPERATOR_CONTROL_DIR>/xreal-sdk31-hello-mr-control.apk` → launch **XREAL HelloMR Control from the grid** → save evidence copy.
3. Apply `BEAM_PRO_AB_INTERPRETATION_MATRIX.md` to the two classifications. Promote **no** flags; build **no** candidate-05.

Checklist to hold in hand: `BEAM_PRO_ONE_PAGE_CHECKLIST.md`.
Full detail: `BEAM_PRO_SHADOW_VS_CONTROL_AB_RUNBOOK.md`.
Machine-readable state: `v11-pre-device-state.json`.
