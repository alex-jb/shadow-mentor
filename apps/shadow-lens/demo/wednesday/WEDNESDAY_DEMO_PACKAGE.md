# Shadow Lens — Wednesday demo package (index)

One place for everything needed on stage. Build artifacts (APKs) are produced by the operator's
Unity and frozen with SHA-256 — they are NOT committed to git (large binaries).

## Contents
| Item | Where | Status |
|---|---|---|
| Stable Mock APK | `frozen/mock-stable-<commit>.apk` (+ `mock-stable.frozen.json`) | build + freeze on the Unity machine |
| XREAL candidate APK | `frozen/xreal-candidate-<commit>.apk` | **XREAL SDK COMPILED / DEVICE VALIDATION PENDING** |
| Install script | `install-apk.sh` | ready |
| Log collection | `collect-logs.sh` → `logs/` | ready |
| Freeze (immutable + SHA-256) | `freeze-apk.sh` | ready |
| Stage runbook | `STAGE_RUNBOOK.md` | ready |
| Device acceptance checklist | `../../docs/DEVICE_ACCEPTANCE_CHECKLIST.md` | ready |
| Desktop backup recording | `DESKTOP_BACKUP_RECORDING.md` | ready |

## Build commit + hashes (fill after building — do not hand-edit the frozen records)
- Build commit: `git rev-parse --short HEAD` on the branch you build from.
- APK SHA-256s: recorded automatically in `frozen/*.frozen.json` by `freeze-apk.sh`.

## The two APKs
- **Mock (stable):** builds WITHOUT the XREAL SDK (`SHADOW_XREAL_SDK` unset). This is the
  guaranteed stage artifact — freeze it and do not rebuild it Wednesday.
- **XREAL candidate:** builds WITH `SHADOW_XREAL_SDK` after the licensed SDK is imported. Label it
  COMPILED / DEVICE VALIDATION PENDING. Eye / 6DoF / RGB capture are NOT claimed until the Beam Pro
  produces real device evidence.

## Honest status categories (kept separate)
REAL AND TESTED (Node) · COMPILED (Unity C# + Android AARs) · ANDROID BUILD (once the APK exists) ·
XREAL SDK COMPILED (candidate) · DEVICE-VALIDATED (nothing yet) · FIXTURE-ONLY (the stage content).
