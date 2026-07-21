# Shadow explainer integration plan

Three self-contained, license-clean explainer animations are complete. This is the **integration plan
only** — no frozen verifier or production Unity scene is modified here.

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

## Unified story contract (proposed; not implemented here)
Extend `shadow-3d-scene-v1` (already authored in the spatial-UX-v2 work) so the explainers and the 3D
renderers share **the same step IDs and the same semantic statuses**:
```
Shadow explainer story (fixtures/animations/*.json + shadow-3d-scene-v1)
   ├─ HTML explainer (self-contained, offline)   ← done
   ├─ Three.js adapter  (demos/replay/3d)         ← reuse, not rebuild
   └─ Unity adapter     (ShadowSceneAdapter)      ← later phase, NOT this slice
        → same node/step IDs · same VERIFIED/WARNING/NOT_EVALUATED vocabulary · positions may differ
```
Parity rule (a later cross-engine test): step IDs, statuses, first-warning/first-failure, evidence IDs,
and provenance are identical across HTML / Three.js / Unity; only positions differ.

**Do not implement the Unity adapter in this slice.** This document is the plan; execution is a later
bounded phase, gated on the spatial-UX-v2 prototype review.
