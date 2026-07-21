# explainer-integration — browser acceptance

Real renders via Playwright/Chromium **149.0.7827.55**, isolated context (not Alex's Chrome), served
same-origin from the repo root at 127.0.0.1:8905. Surfaces: `demos/shadow-explainer-landing.html`,
`demos/guided-shadow-demo.html`, `verify-explainers.html` (non-frozen companion embedding the real
`verify.html`).

## Interaction walkthrough — all PASS
1. Open landing → 3 explainer cards with real poster previews (no autoplay).
2. Open **Audit Chain** → run **Tamper** inside the sandboxed iframe → propagation shown.
3–4. Close → open **Reason Code** → run **Dictionary Modified** → **first failed check = Dictionary hash**
   (WebCrypto recompute ran live inside the sandboxed opaque-origin iframe).
5. Close → open **Persona** → **Majority But Weak Evidence**.
6. Switch to 简体中文 (parent copy updates; embedded explainer keeps its own toggle).
7. **iframe unloads on Close** (`#fw iframe` count = 0 → the demo stops running).
8–9. Guided demo: INTRO → audit-chain → reason-code → persona → Verify CTA → Spatial replay CTA → final
   honest statement; explicit Next only (no auto-advance).
10–11. Verify companion: **Verify evidence** tab embeds the real verifier read-only; **How Shadow works**
   tab shows 3 compact cards; EN↔中文; tabs switch cleanly.

## Acceptance
- **0 console errors · 0 external requests · 0 CSP violations.**
- **0 horizontal overflow** at 1280×720, 1440×900, 390×844.
- iframes sandboxed `allow-scripts` (no top-nav/popups/forms/same-origin), titled, lazy, same-origin only.
- Reduced-motion honored; keyboard (Esc close, arrows, focus return) works; network transparency stated.
- No overclaim (no PRODUCTION/COMPLIANT/DEVICE-VALIDATED/AI-CORRECTNESS). Frozen verifier package unmodified.

## Media
`shadow-guided-demo.{webm,mp4}` (~29.5s) + screenshots: landing-en, landing-zh-CN, guided-step-1/2/3,
verify-how-shadow-works-en/zh-CN, mobile-landing, reduced-motion.

## Status ladder
DOCS-DEMO-INTEGRATED ✅ · GUIDED-DEMO-BROWSER-RENDERED ✅ · GUIDED-DEMO-BROWSER-RECORDED ✅ ·
VERIFY-EXPLAINER-SURFACE-RENDERED ✅ · IFRAME-SECURITY-HOST-TESTED ✅ · BILINGUAL-PARITY-TESTED ✅ ·
OFFLINE-VALIDATED ✅ · **FROZEN-VERIFY-PACKAGE-MODIFIED ❌ · PRODUCTION-VERIFY-INTEGRATED ❌ · UNITY-INTEGRATED ❌ · DEVICE-VALIDATED ❌**.
Verify: `shasum -a 256 -c SHA256SUMS.txt`.
