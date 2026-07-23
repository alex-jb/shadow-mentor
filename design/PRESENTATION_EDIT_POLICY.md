# Presentation edit policy

**Status: DESIGN POLICY. Enforced by `lib/presentation-snapshot.js::classifyEdit` +
`test/presentation-snapshot.test.js`.**

Every edit to a presentation is classified into exactly one of three classes. The class determines
what must be regenerated and whether canonical evidence is involved. Presentation code may never
silently promote a canonical change into a "layout tweak".

## VISUAL_ONLY
Layout/display changes that do not touch analytical content.

Examples: camera position, label position, font size, animation timing, panel layout, colour
*profile* selection (DesktopDark ↔ OST), collapse/expand of a Trust Capsule.

Required result:
- a **new presentation manifest** (new `presentation_snapshot_hash` only if serialized bytes moved);
- **canonical evidence unchanged**;
- **semantic_hash unchanged** (the analytical content is identical).

## SEMANTIC_PRESENTATION_CHANGE
The *analytical* content of the view changed, but not the underlying canonical evidence.

Examples: changed metric, changed value, changed filter, changed time window, added claim, removed a
source *from the view*, changed a data mapping (e.g. an axis from sequence → time or a field remap).

Required result:
- a **new presentation snapshot** with a **new `semantic_hash`**;
- **claim bindings revalidated** (`validateClaimBindings`);
- a **new attestation where applicable** (if the snapshot is attested).

## CANONICAL_EVIDENCE_CHANGE
A change to canonical evidence itself — never a presentation edit.

Examples: changed source, changed approval, changed evidence record, changed reason-code binding,
changed evidence bundle hash, changed a claim's attestation reference.

Required result:
- a **new canonical evidence process** (re-run the evidence/attestation pipeline);
- **never** treated as a simple presentation edit; the presentation layer must reject the attempt
  and route it back to the evidence pipeline.

## How `classifyEdit` decides (in order)
1. If `evidence_bundle_id`/`evidence_bundle_hash` changed, or any claim's
   source/evidence/approval/attestation binding changed → **CANONICAL_EVIDENCE_CHANGE**.
2. Else if the `semantic_hash` over analytical content changed → **SEMANTIC_PRESENTATION_CHANGE**.
3. Else → **VISUAL_ONLY**.

This ordering guarantees a canonical change can never be mislabelled as visual, and an analytical
change can never be mislabelled as a harmless metadata edit. Tests pin one example of each class,
including the traps: a camera-hint edit stays VISUAL_ONLY; an axis remap becomes SEMANTIC; an
approval flip becomes CANONICAL.
