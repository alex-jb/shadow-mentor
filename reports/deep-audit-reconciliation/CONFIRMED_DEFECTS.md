# Confirmed current-tree defects (from the deep-audit) — status

## Resolved this pass (4)
1. **attest-core metadata version drift (P0)** — `session.js` stamped `2.0.0` into every bundle's
   `header.schema_versions.attest_core` while the package was `2.3.0`. Because that header is hashed into the
   chain seed, the *producing-software* field of every new evidence bundle was simply wrong. **Fixed**: the
   constant is now read from `package.json` (single source of truth) + a contract test asserts equality.
   Released fixtures are static and unaffected; the field is String metadata (schema has no enum), so no V1/V2
   signing *semantics* changed — only new bundles now record the correct version.
2. **Three.js per-frame allocation (P0)** — `scene.js` allocated `camPos.clone()` + a `new THREE.Vector3()`
   per card every frame (~48 objects/frame → GC churn). **Fixed**: two reusable module scratch vectors.
3. **Rendered hit proxies (P0)** — invisible (opacity-0) selection planes were still drawn (one draw call
   each, doubled in SBS). **Fixed**: `visible=false` — the renderer skips them; a test proves Raycaster
   selection is byte-identical (it ignores `.visible`) on the shipped three r160.
4. **Untrusted innerHTML (P1, security)** — `demo/xreal.html` injected LLM output from `/api/ambient-turn`
   (`display_name`, `rationale`, `verdict`, context `label`/`value`) via `innerHTML` → prompt-injection →
   script execution. **Fixed**: explicit DOM nodes + `textContent`; browser-verified that `<img onerror>` /
   `<script>` / `<svg onload>` / broken tags all render as literal text with zero execution (`pwned=0`).

## Confirmed-current, scheduled (not regressions, honestly open)
- CORS `*` on 10 API endpoints (documented; prod needs origin allowlist + no-credentials).
- Ambient Council layout defects (badge overlap / ellipsis / wide-screen) — §14.
- flat-mode framing + tiny sequence labels — §13F.
- SBS squeeze vs frame-packed — device-day (Beam Pro).
- CJK wrapping + guided-story bright-bg OST failure — open OST design item.

## Update — additional confirmed defects resolved after the first reconciliation
- **CORS wildcard (P1-3)** — invariant pinned (no wildcard+credentials; no credentialed CORS) + production
  origin-allowlist requirement documented (`docs/security/API_CORS_POSTURE.md`). Commit `9d054dd`.
- **Ambient Council layout (§14)** — badge no longer overlaps cards (0 overlap measured), multiline clamp,
  business-approval no longer reuses the cryptographic-VERIFIED green (blue + ✓ stamp), responsive spread.
  Commit `37ea94f`.
- **Guided-story OST consumption** — now renders dark-on-bright backplates under XREAL_OST_BRIGHT
  (EditMode 120/120). Commit `adb27c3`. (Additive sim under-represents opaque plates — documented.)
