# media/wednesday

Wednesday demo media. **Browser: MEDIA GENERATED. Unity: CAPTURE HARNESS READY** (video needs the
Unity Recorder package + Alex's one click; screenshots via the Editor menu).

- `browser/shadow-verify-full-demo.{webm,mp4}` — ~113s, 1280x720, EN+中文, Chromium 149, FIXTURE-signed.
- `browser/shadow-verify-short-demo.{webm,mp4}` — ~64s fast fallback.
- `browser/screenshots/` — 01–09 (EN+中文 valid/tampered/verifier-valid/verifier-mismatch + limitations) + a 1440x900 doc image. (10-claim-graph / 11-ingest-audit are NOT in verify.html — those are Unity/artifact features, intentionally not captured here.)
- `unity/` — run `Shadow Lens → Capture Wednesday Demo Media` in the Unity editor (screenshots via built-in ScreenCapture; add `com.unity.recorder` for video).
- `narration/` — EN + 中文 scripts + SRT. Silent clean video + narration script is acceptable; no synthetic voice generated.

Regenerate this package: `node media/wednesday/build-media-package.mjs`. Verify: `shasum -a 256 -c SHA256SUMS.txt` (from media/wednesday).
All videos are BROWSER-RENDERED / FIXTURE-signed — NOT device-validated, NOT production-signed.
