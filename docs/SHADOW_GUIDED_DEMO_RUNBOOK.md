# Shadow guided demo runbook

A 3–5 minute guided walkthrough for a professor, bank, or capstone audience. Everything is a deterministic
FIXTURE; no live model; offline.

## Serve
```bash
cd <repo-root>
python3 -m http.server 8905 --bind 127.0.0.1
# open:
#   Landing:        http://127.0.0.1:8905/demos/shadow-explainer-landing.html
#   Guided demo:    http://127.0.0.1:8905/demos/guided-shadow-demo.html
#   Verify + How:   http://127.0.0.1:8905/verify-explainers.html
```
Same-origin serving is required so the iframes + posters resolve. WebCrypto (reason-code) needs a secure
context — `127.0.0.1` qualifies.

## Guided flow (explicit Next only — no auto-advance)
INTRO → 1 Audit chain (run **Tamper**) → 2 Reason-code binding (run **Dictionary Modified**) → 3 Persona
deliberation (run **Majority But Weak Evidence**) → **Verify** CTA → **Spatial replay** CTA → final honest
statement. Each stage shows one key takeaway **and** one limitation — do not skip the limitation.

## Talking points (per stage)
- **Audit chain** — integrity, not correctness: a green chain proves the record wasn't altered.
- **Reason-code** — the reason is bound to a hashed, versioned dictionary; changing the text after signing
  breaks the hash. Valid binding ≠ adequate/fair/legal/correct.
- **Persona** — perspectives are configured lenses, not experts; majority is descriptive, not correctness;
  dissent/unsupported/abstention are preserved.
- **Close**: Shadow verifies evidence integrity + provenance; it does **not** automatically prove source
  truth, analytical correctness, legal compliance, or human approval.

## What NOT to say
No "production banking system", "fully compliant", "device validated", "AI correctness verified". The
Android app is a desktop mock; XR is unvalidated; signing is FIXTURE.

## Fallback
If a browser blocks a demo, play `media/explainer-integration/shadow-guided-demo.mp4` (or the per-explainer
videos under `media/animations/`). All are BROWSER-RENDERED FIXTURE captures — never a device/Unity claim.
