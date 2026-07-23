# Flow ↔ Shadow responsibility boundary

**Status: DESIGN BOUNDARY. No Flow integration, partnership, or API use is claimed or implemented.**

This document draws the line between presentation responsibilities (the kind of thing Flow Immersive
does well, and that a future Flow adapter or any other presentation surface could own) and Shadow's
evidence responsibilities (which must never move into a presentation layer).

## Flow-like PRESENTATION responsibilities
A presentation surface (Flow, Unity Audit Workspace, Three.js Audit Room, or a 2D replay) owns:
- dense data visualization
- category exploration
- spatial composition / layout
- story steps
- camera choreography
- legends
- annotations
- presentation authoring

These are **display** concerns. Editing any of them produces a new *presentation* artifact and must
not touch canonical evidence.

## Shadow EVIDENCE responsibilities
Shadow — and only Shadow — owns:
- canonical claims
- source references
- transformation provenance
- evidence commitments
- cryptographic integrity
- trust posture
- human-review state
- human-approval state
- first-failure localization
- downstream-impact analysis
- independent, offline verification

These are **evidence** concerns. They are produced and verified by Shadow, carried in the evidence
bundle, and are independently checkable with the frozen verifier — with or without any presentation
layer.

## The five invariants
1. **Presentation is not evidence.** A rendered scene, however convincing, asserts nothing until its
   visual claims resolve to Shadow `claim_id`s backed by evidence.
2. **Visualization is not analytical correctness.** A beautiful chart can be integrity-verified and
   still be analytically `NOT_EVALUATED`. Integrity ≠ correctness.
3. **Layout edits do not mutate canonical evidence.** Moving a panel, changing a camera, resizing a
   label → new presentation manifest, identical evidence.
4. **Analytical edits require a new presentation snapshot** (new semantic hash, revalidated claim
   bindings, new attestation where applicable) — they are never silent layout edits.
5. **Shadow must remain independently usable without Flow.** Every capability above is reachable
   through Shadow's own surfaces and the offline verifier; a presentation adapter is additive, never
   load-bearing.

## What this means for the SCP opportunity
Flow's "AI generates a 3D data narrative in 60 seconds" creates exactly the problem Shadow answers:
*why should an auditor trust an AI-generated 3D chart?* The answer is a per-claim evidence link + a
Trust Capsule, not a prettier chart. So the integration surface is: Shadow signs the claims inside a
narrative and exposes an open verifier; the presentation layer displays a Trust Capsule that resolves
to those claims. The presentation layer is never the source of truth. See
`design/SHADOW_FLOW_PRESENTATION_ADAPTER.md` (design only).
