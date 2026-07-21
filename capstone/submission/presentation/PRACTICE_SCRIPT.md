# Cue-card script — Shadow (concise)

One line per slide. Glance, don't read. Full script is in `SPEAKER_NOTES.md`.

1. **Title** — "Shadow: take an AI decision, produce evidence someone else can verify. It grew out of a multi-agent system."
2. **Problem** — "An AI answer isn't evidence. You need: sources, actions, tamper-detection, independent check. Logs are mutable; explanations are just text."
3. **Evolution** — "Started as Orallexa — voices debating. Lesson: more opinions ≠ more trust. Shadow moves trust down to the evidence layer."
4. **What it records** — "Source → action → event → hash chain → signature → verify. Hash chain = change an early event, everything after breaks. Offline."
5. **Architecture** — "Core / profiles / interfaces. Interfaces are NOT equally mature — I'll say which."
6. **Profiles** — "Banking, data science, coding agent — same verification grammar underneath."
7. **TAMPER DEMO** — "Clean record → change one field → it names the exact failed sequence → everything after invalidated. Never claims the answer was right." *(run demo)*
8. **Verify the Verifier** — "A page hashing itself isn't trust. Needs out-of-band manifest + key fingerprint. Signing is fixture, not production."
9. **Spatial** — "Unity + Three.js, audit arc. Head-directed hover — NOT eye tracking, no 6DoF on mock. APK built, not device-validated."
10. **Evaluation** — "1,824/1,827 host tests. Browser verified in Chromium, EN+中文, 0 external requests. APK builds. No user study yet."
11. **Where it stands** — "Two columns: implemented now vs Capstone II. Fixture-signed, device-pending, no correctness claim."
12. **Contribution** — "Doesn't ask you to trust the answer — gives you evidence you can verify. Integrity, not correctness. Thanks."

**If long:** compress 5 & 6, protect 7. **If a live app fails:** switch to the recorded video, keep talking.
