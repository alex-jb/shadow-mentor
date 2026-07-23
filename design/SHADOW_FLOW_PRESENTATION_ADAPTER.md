# Shadow → Flow presentation adapter

## DESIGN ONLY · NO FLOW INTEGRATION CLAIMED · NO PARTNERSHIP CLAIMED

This document describes a *possible future* adapter. Nothing here is implemented. There are no
external Flow API calls, no Flow proprietary content, no reverse engineering, and no claim of any
Flow relationship. It exists to record the design so a later, consented integration can be built
correctly.

## The chain (one direction only)
```
Shadow evidence bundle
  → Shadow Presentation Snapshot (shadow-presentation-snapshot/v1, a DERIVED VIEW)
  → Flow adapter mapping (adapter extension; NON-AUTHORITATIVE)
  → Flow story / steps
  → claim-level evidence links (every visual claim → a Shadow claim_id)
  → Shadow Trust Capsule (rendered in the Flow scene, resolves to the claims)
  → open Shadow verifier (independent, offline)
```

Flow's own strength — dense visualization, spatial composition, story steps, camera choreography —
maps onto the snapshot's `scene_elements` + `story.acts[].steps` + `camera_hint`. Shadow contributes
the one thing Flow cannot: a per-claim evidence link and an independent verifier.

## Rules (non-negotiable for any future implementation)
- **Flow is not the source of truth.** The evidence bundle + offline verifier are.
- **Flow edits cannot silently modify evidence.** A layout edit in Flow is VISUAL_ONLY; an
  analytical edit requires a new snapshot; an evidence change is impossible from the presentation
  layer (see `PRESENTATION_EDIT_POLICY.md`).
- **External data transfer requires consent.** Nothing leaves Shadow to an external presentation
  host without an explicit, logged opt-in.
- **Sensitive fields require redaction** before any external transfer (PII, raw source excerpts).
- **Adapter failure must not affect evidence verification.** The verifier works with the adapter
  absent, offline, or broken.
- **Shadow remains usable without Flow.** The adapter is additive.
- **External scene IDs are non-authoritative metadata** — they live in
  `external_presentation_ref` on the manifest, never in canonical evidence.
- **Every visual claim resolves to a Shadow `claim_id`.** An unbound visual claim MUST be labelled
  `UNVERIFIED PRESENTATION CONTENT`, never shown as if evidence-backed.

## The minimal viable integration (when consented)
Add `attestation_ref` (already a claim field) resolution + a Trust Capsule element to the scene the
adapter emits. `api/spatial-render.js` already emits an engine-neutral scene; the Flow-specific
mapping lives in an **adapter extension**, and the "Shadow verified ✓" pill in the Flow scene links
to the open verifier. That is the whole surface — no Flow field is ever added to canonical evidence.

## The strategic point (why this is Shadow's opportunity, not a threat)
Flow's "AI generates a 3D data narrative in 60 seconds" makes AI-generated charts *less* trustworthy
in a regulated setting, not more. Shadow signs the claims inside the narrative and exposes an open
verifier, so the presentation layer can carry a Trust Capsule that an auditor can actually check.
That is a market-unique "auditable AI data visualization" story for the presentation host and a
distribution path for Shadow — achieved without Shadow ever ceding the source of truth.

## Related work (for the paper)
Flow Immersive has published prior art on multi-dimensional immersive data visualization (Frontiers,
2021 — COVID multi-dimensional visualization); cite it in the related-work section as presentation
prior art distinct from Shadow's evidence-integrity contribution.
