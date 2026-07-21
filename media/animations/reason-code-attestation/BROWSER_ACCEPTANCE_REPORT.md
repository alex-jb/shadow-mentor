# reason-code-attestation — browser acceptance

Real renders of `demos/animations/reason-code-attestation.html` via Playwright/Chromium **149.0.7827.55**,
isolated context (not Alex's Chrome), served same-origin at 127.0.0.1:8903 (localhost = secure context, so
WebCrypto SHA-256 runs live).

## Acceptance — all PASS
- **0 console errors · 0 external requests · 0 CSP violations.**
- **0 horizontal overflow** at 1280×720, 1440×900, 390×844.
- Independent statuses correct per scenario (read from the rendered matrix, WebCrypto recomputed live):
  - pristine → no failure.
  - dictionary text modified → **Dictionary hash FIRST FAILED**; signature stays VERIFIED (independent);
    reason binding stays VERIFIED; record integrity = DOWNSTREAM.
  - reason code replaced (RC-017→RC-009) → **Reason code exists FIRST FAILED**; not a silent label pass.
  - evidence reference removed → **Evidence references FIRST FAILED**; dictionary hash stays VERIFIED.
- Bilingual EN + 简体中文 (evidence values / hashes / IDs unchanged by language); reduced-motion works;
  keyboard (Space/←/→/R/1–4/Esc) works; drawers open dictionary/attestation/verification details.
- Honesty: Policy adequacy / Analytical correctness / Legal-fairness review = **NOT EVALUATED**; never a
  generic TRUSTED/COMPLIANT.

## Media
`reason-code-attestation-demo.{webm,mp4}` (~18.6s, 1280×720) + screenshots: en-pristine, en-dictionary-modified,
en-reason-replaced, en-evidence-removed, zh-CN-pristine, zh-CN-tampered, reduced-motion, mobile.

## Status ladder
FIXTURE-AUTHORED ✅ · DICTIONARY-CANONICALIZED ✅ · ATTESTATION-BINDING-HOST-TESTED ✅ (9 Node tests) ·
BROWSER-RENDERED ✅ · BROWSER-RECORDED ✅ · OFFLINE-VALIDATED ✅ (WebCrypto + inlined fixture, no network) ·
**BANKING-PROFILE-INTEGRATED ❌ · PRODUCTION-DICTIONARY-SIGNED ❌ · DEVICE-VALIDATED ❌** (not claimed).
Verify: `shasum -a 256 -c SHA256SUMS.txt`.
