# Fallback recording

`shadow-desktop-demo.mp4` — ~68 s, built from REAL captured frames of the offline verifier workflow
(banking record → VERIFIED → tamper → FAILED · first failure seq 2 · downstream seq 2…4 → Unity/XREAL
status). Every frame carries the banner **DESKTOP SOFTWARE DEMONSTRATION · NOT BEAM PRO DEVICE VALIDATION**.

This is a desktop software demonstration. It is **not** device evidence and claims no Beam Pro / XREAL
device result. Use it only if the live demo can't run (see `../FALLBACK_RUNBOOK.md`).

Rebuild: `python3 demo/today-class/scripts/build-recording.py` (recaptures frames are not required — the
script reuses the committed fallback screenshots + Unity capture if the temp frames are absent... regenerate
temp frames via the browser harness if you want fresh captures).
