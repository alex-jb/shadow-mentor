# verify.html — browser acceptance report

Real rendered validation of the two-mode bilingual verifier in an isolated Chromium (Playwright),
served over a local HTTP origin. **Alex's personal Chrome profile was not used or modified.**

## Environment

| | |
|---|---|
| Commit | `feat/shadow-lens-product-integrity` @ this slice |
| Verifier version | 2.2.0 (build stamped `6c3104e` in the page) |
| Build / serve | `node verify/build-acceptance.mjs` → `python3 -m http.server 8899 --bind 127.0.0.1` (repo root) |
| Local origin | `http://127.0.0.1:8899/verify.html` |
| Browser | Chromium 149.0.7827.55 (Playwright 1.61.1), headless |
| Isolated profile | `/tmp/shadow-verify-acceptance-profile` (dedicated, ephemeral) |
| Viewports | 1440×900, **1280×720 (Wednesday priority)**, 390×844 |
| Locales | English + 简体中文 |
| Release key fingerprint (fixture) | `727d29d3204231f7` |
| Signed assets | verify.html `c478b46f…` · verify/locales/en.json `44a42af0…` · verify/locales/zh-CN.json `305a0206…` |

## Interactive flows — PASS (EN + 简体中文)

| Flow | EN | zh-CN | Evidence |
|---|---|---|---|
| **A valid evidence** | ✅ | ✅ | Record Integrity / Signature / Hash Chain / Profile = VERIFIED; External Anchor = NOT PRESENT; "Analytical correctness: not judged"; JSON report exports |
| **B tampered evidence** | ✅ | ✅ | FAILED; failed sequence = **2** (seq-1 mutation surfaces downstream); reason `prev_hash_mismatch`; unrelated statuses did **not** turn green |
| **C verifier assets valid** | ✅ | ✅ | Manifest Ed25519 signature VERIFIED in-browser; fingerprint shown; **ASSETS MATCH SIGNED MANIFEST**; **INDEPENDENT COMPARISON NOT PERFORMED** shown; FIXTURE RELEASE KEY labeled |
| **D verifier asset mismatch** | ✅ | ✅ | Validly-signed manifest with a wrong verify.html hash → **ASSET MISMATCH**, path `verify.html`, expected `0000…` / actual `c478b46f…`; no generic TRUSTED badge |

Screenshots (real renders) in `verify-acceptance/screenshots/`:
`en-valid-evidence.png` · `en-tampered-evidence.png` · `en-verifier-valid.png` · `en-verifier-mismatch.png` ·
`zh-CN-valid-evidence.png` · `zh-CN-tampered-evidence.png` · `zh-CN-verifier-valid.png` · `zh-CN-verifier-mismatch.png` ·
`en-responsive-1280x720.png`.

## Bilingual — PASS
No untranslated keys visible; Chinese wraps without clipping; status meanings identical across languages;
`<html lang>` updates to `en` / `zh-CN`; evidence values (hashes, IDs, quotes, sequence numbers) unchanged by locale.

## Security in the real browser — PASS
- `<script>` in an evidence value → inert (no new `<script>` element injected, rendered as text).
- Prototype-pollution key (`__proto__`) → bundle rejected **MALFORMED**.
- Fake `"status":"VERIFIED"` embedded in JSON → real verification still returns **FAILED**.
- Malformed signature (`garbage!!`) → clean **FAILED** (no uncaught `atob` error after the fix).

## CSP / network — PASS
- **0** external-origin requests · **0** analytics/telemetry · **0** CSP violations · **0** uncaught JS errors.
- CSP `default-src 'none'; connect-src 'self'`; the only fetches are same-origin asset reads for the manifest check.

## Offline — OFFLINE AFTER INITIAL ASSET LOAD
With the browser set offline after load: **evidence verification works fully offline** (valid verifies,
tampered fails), language toggle works, reports export. The verifier's **asset-hash comparison requires
same-origin fetch**, so it honestly reports `INDEPENDENT COMPARISON NOT PERFORMED` when offline rather
than a false green. Not claimed as installable PWA / cold-load-offline.

## Responsive / accessibility — PASS
No horizontal overflow at 1440×900, 1280×720, or 390×844 (overflow = 0px). Tabs are `role=tab`; language
control always visible; visible focus rings; status conveyed by text (not color alone); `prefers-reduced-motion`
honored. Keyboard/paste flow drives verification.

## Status ladder (honest)

| State | |
|---|---|
| **HOST-TESTED** | ✅ verifier mirror, manifest sign/verify, safe-parse, locale parity, acceptance (1824 Node pass / 3 skip) |
| **BROWSER-RENDERED** | ✅ Chromium 149, EN + zh-CN, 8 flows + security + CSP + responsive, screenshots captured |
| **FIXTURE-SIGNED** | ✅ manifest + bundles signed with the FIXTURE RELEASE KEY |
| **PRODUCTION-SIGNED** | ❌ not performed (no production release key) |
| **OFFLINE-VALIDATED** | ⚠️ evidence verification offline-validated; full page = OFFLINE AFTER INITIAL ASSET LOAD |
| **DEVICE-VALIDATED** | ❌ not applicable to this slice |

## Known limitations
- Manifest asset-hash comparison needs a live same-origin fetch (works on a static host / after asset load; not offline).
- The manifest fingerprint cross-check against GitHub Release / npm is a **human** step the page cannot perform — it always shows `INDEPENDENT COMPARISON NOT PERFORMED`.
- Signing is FIXTURE only; production signing is a separate, gated step.
