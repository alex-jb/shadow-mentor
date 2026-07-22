# Shadow cross-engine parity

The guarantee: HTML, Three.js, and Unity render the **same meaning** from one guided story. This is
enforced mechanically, not by review.

## The semantic hash

`tools/compile-shadow-guided-story.mjs` splits a compiled artifact into:

- `semantic` — the **target-independent** projection: story id, entities (id/kind/sequence/label/
  a11y/trust_dimension/evidence_ref), relations, trust dimensions, scenarios (first_failure,
  affected_downstream, entity_status, dimension_status, label, note), and steps (id/index/kind/
  scenario_ref/narration/focus_entities/reveal_upto_sequence).
- `render` — advisory, per-target hints (layout, camera, world plane). **Not** part of the hash.

`semantic` is canonicalized (sorted keys, sorted collections) and hashed with SHA-256. Because the
`semantic` block does not depend on the target, compiling a story to `html`, `threejs`, `unity`, or
`snapshot` yields the **same `semantic_hash`**.

```
audit-chain              d7a3bf58634a9070…
reason-code-attestation  5b74c569df46aae3…
persona-deliberation     cf2379348fb67e2e…
```

These are pinned in `fixtures/guided-stories/snapshots/<id>/hash.txt`, and the full semantic block in
`<id>/semantic.json`. The Unity project ships a byte-identical copy under
`apps/shadow-lens/unity/Assets/ShadowLens/GuidedStory/Snapshots/`.

## What the parity test checks (`test/shadow-guided-story-parity.test.js`)

1. For each story, all four targets produce one `semantic_hash`, equal to the committed anchor.
2. The committed `semantic.json` equals what the generator produces (no drift).
3. The Unity snapshot copy is byte-identical to the anchor.
4. The Unity C# `Statuses` / `TrustDimensions` arrays (parsed from source) equal the Node
   `SEMANTIC_STATUS_IDS` / `TRUST_DIMENSION_IDS`.
5. The Unity `ShapeOf(status)` switch (parsed from source) equals the Node vocabulary's shape per
   status — so the status→shape mapping cannot diverge between engines.

## What "parity" does NOT mean

Positions differ by design. Layout intent (timeline/arc/dag/radial/hybrid), camera, panel geometry,
and animation timing are advisory and are free to differ per engine and per device. Parity is about
**meaning**: ids, statuses, first-failure, affected-downstream, relations, trust dimensions, and
narration — never layout.

## A meaning change is caught

Flip one status in a fixture and the `semantic_hash` changes, breaking the anchor assertion. Change
`ANALYTICAL_CORRECTNESS` away from `NOT_EVALUATED` and both the compiler and the Unity loader reject
it. Add a forbidden equivalence phrase (`verified means trusted`, `majority means correct`) and the
compiler fails closed. See `SHADOW_SEMANTIC_VOCABULARY.md` for the forbidden mappings.
