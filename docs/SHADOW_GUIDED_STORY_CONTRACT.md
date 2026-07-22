# Shadow guided-story contract (`shadow-guided-story-v1`)

An engine-neutral narrative over one Shadow decision. Schema:
`schemas/shadow-guided-story-v1.schema.json`. It **references** a
`shadow-3d-scene-v1` scene and/or evidence bundles by opaque id — it does not
duplicate them. Every adapter (HTML/SVG, Three.js, Unity) compiles the same
guided story into its own rendering while sharing one semantic core.

## Why a separate contract from `shadow-3d-scene-v1`

`shadow-3d-scene-v1` describes a single spatial snapshot (nodes + edges +
verification at one moment). A guided story adds the *walk*: an ordered set of
**scenarios** (each a full status assignment with an explicit `first_failure` +
`affected_downstream`) and a **narration script** of steps. The story references a
scene for its spatial nodes and never restates the scene's node data.

## Shape

- `story_version` — `"shadow-guided-story-v1"`.
- `story_id` — kebab id (`audit-chain`, `reason-code-attestation`, `persona-deliberation`).
- `provenance_mode` — `FIXTURE` | `LIVE` | `DEVICE`. Fixtures are `FIXTURE`.
- `title`, `fixture_note`, `teaches.proves` / `teaches.does_not_prove` — bilingual.
- `references` — opaque ids for `scene_clean` / `scene_tampered` / `evidence_bundle` / `dictionary`, resolved by the adapter.
- `trust_dimensions` — the subset of `TRUST_DIMENSIONS` this story exercises.
- `entities[]` — semantic nodes: `id`, `kind` (from `ENTITY_KINDS`), `sequence`, bilingual `label` + `a11y`, optional `trust_dimension`, optional opaque `evidence_ref`.
- `relations[]` — `id`, `type` (from `RELATION_TYPES`), `from`, `to`.
- `scenarios[]` — `id`, bilingual `label`, `entity_status` (entity id → status), `dimension_status` (dimension → status), `first_failure` (entity id or dimension, or `null`), `affected_downstream[]`, optional bilingual `note`.
- `steps[]` — the narration walk: `id`, `index`, `kind`, optional `scenario_ref`, bilingual `narration`, `focus_entities[]`, optional `reveal_upto_sequence`, advisory `layout_intent`.

## What is authoritative vs advisory

**Authoritative (must be identical across engines):** `story_id`, entity ids +
kind + sequence + labels + a11y, relations, `trust_dimensions`, and every
scenario's `first_failure` / `affected_downstream` / `entity_status` /
`dimension_status`, plus the step narration + focus sets.

**Advisory (may differ per engine/device):** `layout_intent`, positions, camera,
panel geometry, animation timing.

The compiler's **semantic hash** is computed over exactly the authoritative set,
so HTML / Three.js / Unity that render the same story produce the **same hash**
even though their layouts differ. See `SHADOW_CROSS_ENGINE_PARITY.md`.

## Untrusted-input posture

Guided-story JSON is treated as untrusted. The schema caps size (≤64 entities,
≤256 relations, ≤16 scenarios, ≤32 steps, bounded string lengths) and closes every
enum. The compiler additionally rejects duplicate ids, dangling `from`/`to`/status
keys, unknown statuses/dimensions, prototype-pollution keys, and any executable
HTML/`javascript:`/`data:` payload. Text is rendered text-safe. No live model is
ever contacted. See `tools/compile-shadow-guided-story.mjs`.

## Forbidden mappings

The compiler asserts none of the `FORBIDDEN_MAPPINGS` collapses appear
(`VERIFIED→TRUSTED`, `VERIFIED→COMPLIANT`, `MAJORITY→CORRECT`,
`COMPLIANCE_PERSONA→LEGAL_REVIEW_COMPLETE`) and scans rendered narration for the
concrete equivalence phrases. `ANALYTICAL_CORRECTNESS` is always carried as
`NOT_EVALUATED` — a green verification never implies the decision was correct.
