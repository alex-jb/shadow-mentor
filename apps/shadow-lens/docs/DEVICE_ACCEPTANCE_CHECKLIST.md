# Device acceptance checklist

Mark DEVICE-VALIDATED only for the exact phone / firmware / SDK tested — never generalize.

- [ ] Capability screen reports 6DoF + Eye honestly (no overclaim)
- [ ] Eye RGB preview is a real live image (mean luminance + variance non-trivial; not black)
- [ ] Touchpad freezes exactly one frame; frozen-frame equality holds
- [ ] Capture bytes obtained; SHA-256 computed + shown; capture path recorded (gpu/still)
- [ ] Body leans/steps → viewer pose TRANSLATES (real 6DoF, not 3DoF); panel stays in room ~30s
- [ ] Rectify runs; ML Kit returns boxes; source_map validates against the contract
- [ ] Analysis findings all cite existing source_ids (0 rejected in the UI)
- [ ] Server seals a real bundle; verify.html verifies it
- [ ] Presenter tamper → exact failed_seq red + downstream dim; pristine NOT overwritten
- [ ] Reset restores pristine verified state
- [ ] Voice: push-to-talk; on-device path when available; closed-command routing; no audio retained
- [ ] Full flow runs twice without crash

---

## Wednesday stage acceptance (2026-07-22)

**Guaranteed (deterministic, offline) — must pass before stage:**
- [ ] Stable Mock APK installs + launches on the Beam Pro (`install-apk.sh`).
- [ ] Opens in Banking · READY; FIXTURE MODEL + REAL SIGNED labels visible; one status row.
- [ ] Banking grounded query highlights the B0L1 source; `LAST ACTION: … — EXECUTED`.
- [ ] Verify → SEALED · VERIFIED; Tamper → TAMPERED; Reset works.
- [ ] Profile switch to Data Science (no loan/DTI) and Coding (no banking/model) rebuilds the artifact.
- [ ] Presenter ⟲ Reset Demo returns to Banking READY.
- [ ] Works in airplane mode (no network, no live LLM).
- [ ] Desktop backup recording captured (`DESKTOP_BACKUP_RECORDING.md`).

**DEVICE VALIDATION PENDING — do NOT claim on stage until the Beam Pro produces real evidence:**
- [ ] XREAL SDK version identified in the capability report (candidate APK).
- [ ] Eye RGB preview / still capture producing a non-black frame with a changing timestamp.
- [ ] 6DoF positional translation observed.
- [ ] On-device OCR source_map from a real captured frame.
- [ ] On-device voice recognition (push-to-talk) routing a command.

The XREAL candidate APK is labeled **XREAL SDK COMPILED / DEVICE VALIDATION PENDING** — Eye, 6DoF,
and RGB capture stay unclaimed until the above are checked on hardware.
