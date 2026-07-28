# Device validation — remaining gaps

1. **XREAL SDK not imported** → candidate APK not built (hard blocker; Alex imports SDK).
2. **No device attached to the build machine** → install/logcat/soak/physical tests cannot run here.
3. All 3DoF / controller / Recenter / tracking-fallback / OST-readability / soak results are physical
   and pending Alex on the Beam Pro (templates ready, all NOT_TESTED).
4. XREAL Eye 6DoF is optional + only after core PASS; not started.
5. Camera/OCR intentionally OFF in the first candidate.
6. No production signing; no production readiness.

None of these are claimed done. The candidate infrastructure + report scaffolding are ready; the
physical validation is Alex's on real hardware.
