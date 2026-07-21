# Live demo runbook — Shadow

A deterministic demo plan with graceful fallbacks. **Do not make the presentation depend on Beam Pro or any device.** Paths are relative to the repository root (`~/Desktop/AI-Projects/shadow-mentor`). Rehearse the full sequence once before presenting; reset state at the end.

## Preferred live sequence (~2 minutes, inside Slide 7)

1. **Open the Shadow verifier** (browser) or the Unity mock.
2. **Load pristine evidence** — show the clean bundle; point out the independent statuses.
3. **Show the independent statuses** — integrity, signature, and *correctness* are separate rows.
4. **Tamper with one event** — change a single earlier field.
5. **Show the exact first failed sequence** — the verifier names the sequence number.
6. **Show downstream impact** — everything after the break is flagged invalidated.
7. **Open Verify the Verifier** — assets-match-signed-manifest, and the honest "independent comparison not performed."
8. **Switch English / 简体中文** — values (hashes, IDs, quotes, sequence numbers) do not change.
9. **Show Unity / Three.js spatial replay** — the audit arc; note it's a prototype, device validation pending.
10. **Reset** — return to pristine.

## Fallback levels (pick the highest that works on the day)

- **A. Live application** — serve the verifier locally (commands below). Best.
- **B. Browser package** — open the frozen browser package directly.
- **C. Recorded demo video** — `media/wednesday/browser/shadow-verify-full-demo.mp4` (also `-short-demo.mp4` / `.webm`).
- **D. Screenshots inside the slides** — Figures 5–8 already embedded in the report; keep them one keystroke away.

**Decision rule:** if A doesn't come up cleanly in 20 seconds, drop to C (the recorded video) and keep talking. Do not debug live.

## Exact commands

```bash
cd ~/Desktop/AI-Projects/shadow-mentor

# --- Serve the browser verifier package (Level A) ---
# The verifier is a static, offline, CSP-locked page. Serve the acceptance package:
python3 -m http.server 8000 --directory verify-acceptance/wednesday-package
#   then open  http://localhost:8000/   (or open verify.html directly if present at root)

# --- Locate the recorded demo videos (Level C fallback) ---
ls -la media/wednesday/browser/*.mp4 media/wednesday/browser/*.webm

# --- Locate the pre-rendered screenshots (Level D fallback) ---
ls verify-acceptance/screenshots/         # en/zh valid, tampered, verifier-valid, mismatch
ls media/wednesday/browser/screenshots/   # numbered 01–09 incl. limitations

# --- Open the Unity scene (only if presenting live Unity; optional) ---
open apps/shadow-lens/unity        # open the project in Unity 6000.0.23f1

# --- Confirm the FROZEN APK is unchanged (do NOT rebuild it) ---
shasum -a 256 apps/shadow-lens/demo/wednesday/frozen/mock-stable-5168b07.apk
#   expect: 93f2a81aa5f965aec540526abe621b152c7507c03c0fea51d381094bd548d0b8

# --- Reset demo state ---
#   The verifier is stateless per page load — reset = reload the page / reopen the pristine bundle.
#   No files are modified by the demo; nothing to clean up.
```

## What NOT to do on stage

- Do not rebuild or re-sign the APK. It is frozen; its hash is a reported fact.
- Do not claim device validation, eye tracking, 6DoF, or production signing.
- Do not try to connect Beam Pro live unless it has already been tested that morning and a fallback is ready.
- Do not debug a failing live app in front of the room — switch to the recorded video (Level C) and narrate.
