# Voice UX V2 comparison — browser acceptance

Rendered on Chromium 149 (isolated profile, never the user's Chrome). Page:
`demos/voice/voice-ux-v2-comparison.html`. 2026-07-21.

| Check | Result |
|---|---|
| chromium | 149.0.7827.55 |
| external requests | 0 |
| CSP violations | 0 |
| console errors | 0 |
| audio elements | 8 |
| autoplay | none (preload=none, no autoplay attribute) |
| rows | 8 |
| horizontal overflow (1280 / 390) | 0 / 0 |

Measured duration deltas (macOS `say` desktop fixture, NOT Beam Pro):

- **en-current 40.3s → en-v2 10.5s (−74% shorter)**
- **zh-current 55.2s → zh-v2 12.9s (−77% shorter)**

## What this shows (and does not)

V2 is not a pitch/voice change: the "current" baseline reads the raw status/IDs/underscores flat and
all at once (40–55 s); V2 restructures WHAT is said (evidence-first, one idea per sentence, no
Markdown/ID reading) into a 10–13 s answer. This is **measured engineering evidence** (shorter,
semantic-preserving, deterministic prosody). It is **not** a naturalness claim — perceived naturalness
requires a listener study (`voice/evaluation/`). All audio is desktop `say`, clearly labelled, never
Beam Pro.

Media: `en-current.wav` · `en-v2.wav` · `zh-current.wav` · `zh-v2.wav` ·
`verification-failure-v2.wav` · `persona-disagreement-v2.wav` · `abstention-v2.wav` ·
`tracking-lost-v2.wav` · `comparison-demo.webm` / `.mp4` · `comparison-en.png` / `comparison-zh.png` ·
`SHA256SUMS.txt` · `manifest.json`.
