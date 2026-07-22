# Cue card — Shadow V2 (glance, don't read)

One line per slide. Full script in `..._V2_NOTES.md`.

1. **Title** — "Shadow: take an AI decision, produce evidence someone else can verify. Grew out of a multi-agent system. That's a real render."
2. **Trust gap** — "An AI answer isn't evidence. You need: sources, actions, tamper-detection, independent check. Logs mutable; explanations are just text."
3. **Evolution** — "Started as Orallexa — voices debating. Lesson: more opinions ≠ more trust. Shadow moves trust down to the evidence layer."
4. **How it records** — "Source → action → event → hash chain → signature → verify. Change an early event, everything after breaks. Offline."
5. **Architecture** — "Core / profiles / interfaces. Interfaces NOT equally mature — I label which."
6. **Profiles** — "Banking, data science, coding agent — same verification grammar underneath."
7. **TAMPER (hero)** — "Clean record → change one field, seq 3 → names the exact failed seq → 4/5/6 invalidated. Panel says 'Analytical correctness: NOT EVALUATED.'" *(run demo here)*
8. **Verify the Verifier** — "A page hashing itself isn't trust. Needs out-of-band manifest + key fingerprint. Signing is fixture, not production."
9. **Spatial** — "Unity + Three.js, two real layouts. Head-directed hover — NOT eye tracking, no 6DoF on mock. APK built, not device-validated. 2D fallback always."
10. **Evaluation** — "1,858/1,861 host tests, 0 failed, 3 env-gated skips. (Updated from a stale 1,824/1,827.) Chromium EN+中文, 0 external requests. No user study yet."
11. **Current state** — "Now vs Capstone II. Ingest: structural host-tested, semantic production-pending — not device-pending. Fixture-signed, device-pending, no correctness claim."
12. **Contribution** — "Doesn't ask you to trust the answer — gives you evidence you can verify. Integrity, not correctness. Thanks."

**If long:** compress 5 & 6, protect 7. **If live app fails:** switch to recorded video, keep talking. **Backups 13–16:** status matrix / trust boundary / limitations / demo fallback — Q&A only.
