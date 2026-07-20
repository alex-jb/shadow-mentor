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
