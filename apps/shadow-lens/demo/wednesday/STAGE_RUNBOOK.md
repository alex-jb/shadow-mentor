# Shadow Lens — Wednesday stage runbook

Deterministic, offline stage demo. **No live LLM, no required network.** All content is a
**FIXTURE MODEL** over real fixture sessions; the label is shown on screen at all times.

## Pre-stage (the night before)
1. Build + freeze the stable Mock APK: `Shadow Lens → Build Mock Android APK`, then
   `bash freeze-apk.sh Build/Android/shadow-lens-mock.apk mock-stable`.
2. (If the XREAL SDK is imported) build the candidate: same build with `SHADOW_XREAL_SDK` set →
   `bash freeze-apk.sh Build/Android/shadow-lens-xreal.apk xreal-candidate`. Label it
   **XREAL SDK COMPILED / DEVICE VALIDATION PENDING** — do NOT claim Eye/6DoF/RGB.
3. Install on the Beam Pro: `bash install-apk.sh frozen/mock-stable-<commit>.apk`.
4. Record the 60–90 s desktop backup (see `DESKTOP_BACKUP_RECORDING.md`).
5. Airplane mode OK — the demo needs no network.

## On stage (the flow, ~2 min)
1. Launch → it opens in **Banking · READY** (Fixture Model label visible, one status row).
2. **Banking**: type "show the source supporting the highest-risk finding" → grounded answer +
   citation chip + the B0L1 source overlay highlights. `LAST ACTION: highlight_source — EXECUTED`.
3. **Verify** → SEALED · VERIFIED. **Tamper** → TAMPERED (chain breaks) → **Reset**.
4. Switch profile → **Data Science**: "why was this model selected?" → GBM + AUC focus; no loan/DTI.
5. Switch profile → **Coding Agent**: "which change fixed the duplicate EventSystem?" → diff/test focus.
6. **Presenter reset** (⟲ Reset Demo button / F-key) → back to Banking READY for the next run.

## If anything wobbles
- Play the desktop backup recording (already cued).
- The device path (Eye capture / voice / 6DoF) is **not** part of the guaranteed script — it stays
  DEVICE VALIDATION PENDING; do not demo it live unless the Beam Pro has produced real evidence.

## Honesty guardrails (say these, not more)
- "This is a Fixture Model — deterministic, offline." (never call it a live model)
- "The cryptographic verification is real Ed25519 — the reproducible evidence package proves it"
  (that's the Node acceptance package; the on-device verify is the visual of that flow).
- Do NOT claim Eye, 6DoF, or RGB capture.
