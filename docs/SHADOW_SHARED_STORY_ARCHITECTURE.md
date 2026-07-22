# Shadow shared story architecture

One guided story, one meaning, three renderers. A Shadow decision is authored once as a
`shadow-guided-story-v1` fixture, compiled to a target-independent semantic block, and rendered by
the HTML/SVG explainers, the Three.js spatial player, and the Unity native adapter. The three
engines choose shapes and positions; none of them chooses meaning.

```
fixtures/guided-stories/<id>.guided-story.json        (authored once; references scenes + bundles)
        │  tools/compile-shadow-guided-story.mjs  (validate untrusted → canonical semantic → SHA-256)
        ▼
   compiled { semantic (target-independent), render (advisory), semantic_hash }
   ├─ HTML/SVG adapter      demos/animations/src/shadow-guided-story-html-adapter.mjs   → the 3 explainers
   ├─ Three.js adapter      prototypes/shadow-3d-v2/src/*.mjs                            → story-player.html
   └─ Unity native adapter  apps/shadow-lens/unity/Assets/ShadowLens/GuidedStory/*.cs   → Guided Story Demo scene
```

## The layers

1. **Vocabulary** — `lib/shadow-semantic-vocabulary.mjs` (13 statuses, 15 trust dimensions,
   forbidden mappings). The Unity side mirrors it in `ShadowGuidedStoryStatus.cs`; a parity test
   parses the C# and asserts the sets + the status→shape mapping are identical.
2. **Contract** — `schemas/shadow-guided-story-v1.schema.json` (+ `shadow-semantic-status-v1`). A
   story references (never duplicates) a `shadow-3d-scene-v1` scene and evidence bundles.
3. **Fixtures** — three canonical stories (`audit-chain`, `reason-code-attestation`,
   `persona-deliberation`) generated deterministically from the existing explainer + 3D fixtures,
   with zero semantic drift (same ids, first-failure, downstream, statuses).
4. **Compiler** — `tools/compile-shadow-guided-story.mjs`. Validates a story as untrusted input,
   emits a canonical semantic block + a stable `semantic_hash`, fail-closed, no live model.
5. **Adapters** — HTML (convergence, no redesign), Three.js (browser player), Unity (native).

## What is authoritative vs advisory

- **Authoritative** (identical across engines, hashed): story id, entity ids/kind/sequence/labels/
  a11y, relations, trust dimensions, and every scenario's first-failure / downstream / per-entity /
  per-dimension statuses, plus step narration + focus sets.
- **Advisory** (per engine/device, not hashed): layout intent, positions, camera, panel geometry,
  animation timing.

Because the semantic block is target-independent, the compiler produces the **same `semantic_hash`
for html, threejs, unity, and snapshot** — the mechanical guarantee that the three engines cannot
tell three different stories. See `SHADOW_CROSS_ENGINE_PARITY.md`.

## Honest status ladder (this slice)

| Rung | State | Evidence |
|---|---|---|
| Shared-story contract authored | ✅ | schemas + vocabulary + 3 fixtures |
| Compiler host-tested | ✅ | 16 Node tests |
| HTML adapter integrated | ✅ | 4 Node parity tests vs deployed explainers |
| Three.js adapter integrated | ✅ | 6 Node host tests |
| Three.js browser-rendered | ✅ | Chromium 149, 0 external / 0 CSP / 0 console error / 0 overflow |
| Unity adapter authored | ✅ | 10 C# files |
| Unity compiled | ✅ | ShadowLens.dll built, 0 CS errors (Unity 6000.0.23f1) |
| Unity EditMode tested | ✅ | 11/11 passed (result XML in media/story-adapters/unity-tests) |
| Unity PlayMode tested | ✅ | 3/3 passed |
| Android built | ❌ | not attempted; the stable APK is untouched |
| Device-validated | ❌ | no headset in this slice |

Positions on device are `DEVICE VALIDATION PENDING` until measured on hardware; the demo scene banner
says so.

## Related docs

`SHADOW_GUIDED_STORY_CONTRACT.md` · `SHADOW_SEMANTIC_VOCABULARY.md` ·
`SHADOW_CROSS_ENGINE_PARITY.md` · `SHADOW_THREEJS_GUIDED_STORY_ADAPTER.md` ·
`SHADOW_UNITY_GUIDED_STORY_ADAPTER.md` · `SHADOW_3D_VISUALIZATION_CONTRACT.md`.
