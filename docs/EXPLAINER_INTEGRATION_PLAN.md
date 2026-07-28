# Shadow explainer integration plan

Three self-contained, license-clean explainer animations are complete, and the **docs/demo integration
surfaces are now built + browser-accepted** (this slice). No frozen verifier or production Unity scene is
modified — the surfaces reference `verify.html` read-only via a sandboxed iframe.

## Built this slice (docs/demo integration — DONE)
- `demos/shadow-explainer-landing.html` — landing: 3 explainer cards (poster previews, proves / does-not-prove),
  click-to-open sandboxed iframes, one at a time, no autoplay, prev/next/restart/close, bilingual, network transparency.
- `demos/guided-shadow-demo.html` — 3–5 min guided flow: INTRO → 3 explainers → Verify CTA → Spatial replay CTA →
  final honest statement; explicit Next only.
- `verify-explainers.html` — non-frozen companion: **Verify evidence** (embeds the real `verify.html` read-only) +
  **How Shadow works** (3 compact cards). The frozen Wednesday package is untouched.
- `demos/shadow-embed-protocol.mjs` — `shadow-explainer-embed-v1` postMessage validator (origin/id/type/payload
  allowlisted). See `EXPLAINER_EMBEDDING_SECURITY.md`. Runbook: `SHADOW_GUIDED_DEMO_RUNBOOK.md`.
- Tests: `test/explainer-integration.test.js`. Media: `media/explainer-integration/` (Chromium 149, 0 external/CSP/error).

## The three explainers
1. **audit-chain** — `apps/shadow-lens/explainers/audit-chain.html` (hash-chained provenance + tamper propagation).
2. **reason-code-attestation** — `demos/animations/reason-code-attestation.html` (live SHA-256 dictionary
   hash → attestation binding; 5 tamper scenarios).
3. **persona-deliberation** — `demos/animations/persona-deliberation.html` (analytical perspectives →
   evidence-grounded synthesis; majority ≠ correctness; 6 scenarios).

## Suggested embed locations (later, not this slice)
| surface | how | why |
|---|---|---|
| docs / demo landing page | `<iframe>` or inline each HTML | one-click, no install, offline |
| `verify.html` "How Shadow Works" | link/embed audit-chain + reason-code | teaches the two integrity mechanisms the verifier checks |
| Capstone presentation | play the `.mp4`s (or open the HTML) | narratable, deterministic, no live model |
| Three.js guided replay (`demos/replay/3d`) | reuse the story scene contract | same semantics in 3D |
| Unity help/tutorial panel | reuse the story scene contract | same semantics on device |

Do **not** modify the frozen `verify-acceptance/wednesday-package/` or the production Unity scene when
integrating — embed by reference / iframe, keep the originals immutable.

## Unified story contract — IMPLEMENTED (`shadow-guided-story-v1`)
The unified contract is now built. See `SHADOW_SHARED_STORY_ARCHITECTURE.md`. A decision is authored
once as a guided story, compiled to a target-independent semantic block, and rendered by all three
engines:
```
fixtures/guided-stories/*.guided-story.json  (references shadow-3d-scene-v1 + evidence bundles)
   ├─ HTML/SVG adapter   demos/animations/src/shadow-guided-story-html-adapter.mjs  → the 3 explainers
   ├─ Three.js adapter   prototypes/shadow-3d-v2/src/*.mjs                           → story-player.html
   └─ Unity adapter      apps/shadow-lens/unity/Assets/ShadowLens/GuidedStory/*.cs   → Guided Story Demo
        → same entity/step IDs · same 13-status / 15-dimension vocabulary · positions may differ
```
Parity is enforced by a SHA-256 semantic hash: `test/shadow-guided-story-parity.test.js` proves
html/threejs/unity/snapshot share one hash, and the Unity C# vocabulary + status→shape mapping match
the Node vocabulary. Verified: Three.js browser-rendered (Chromium 149); Unity EditMode 11/11 +
PlayMode 3/3 (Unity 6000.0.23f1). See `SHADOW_CROSS_ENGINE_PARITY.md`,
`SHADOW_THREEJS_GUIDED_STORY_ADAPTER.md`, `SHADOW_UNITY_GUIDED_STORY_ADAPTER.md`.
