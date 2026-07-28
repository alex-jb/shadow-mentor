# Token codegen implementation

**Status: IMPLEMENTED (build-time). NOT DEVICE VALIDATED.** Turns the canonical JSON into a real
single runtime source instead of hand-mirrored surfaces.

## Before / after

Before: `design/shadow-spatial-tokens.json` existed but Unity C#, Three.js/JS, and CSS mirrored it
**by hand**, kept honest only by parity tests. A human could edit one surface and forget the others.

After: `scripts/generate-tokens.mjs` reads the canonical JSON and **generates** all three adapters.
The generated files are committed; a `--check` mode + test fails CI if they drift from the source.

## Generator: `scripts/generate-tokens.mjs`

```
node scripts/generate-tokens.mjs          # regenerate the 3 adapters
node scripts/generate-tokens.mjs --check   # exit 1 if any generated file is stale
```

Reads the 6 categories (`status, governance, trust_posture, tracking, interaction, capability`),
validates, then emits:

| Output | Consumer |
|---|---|
| `apps/shadow-lens/unity/Assets/ShadowLens/Generated/ShadowSemanticTokens.Generated.cs` | Unity C# — `ShadowSemanticTokens.All` / `Get(cat,key)` |
| `generated/shadow-semantic-tokens.generated.js` | browser + Three.js — frozen `SHADOW_SEMANTIC_TOKENS` / `shadowToken()` |
| `generated/shadow-semantic-tokens.generated.css` | browser CSS — `--shadow-{cat}-{key}-color` custom properties |

### Validation (exit non-zero on any violation)
- every state has non-empty `text, text_zh, icon, shape, color, a11y, a11y_zh` (never colour alone; EN+ZH required)
- `color` is `#rrggbb`; `text_zh` contains CJK
- no duplicate `category.key`
- verification green (`#4ade80`) only on the allow-listed verification states
- approval does not share verification green; review ≠ approval (distinct icon)
- first-failure ≠ downstream (not both same colour+icon); scanning ≠ lost

### Determinism
Category order is fixed; keys are sorted within each category; strings are escaped. **No timestamp,
username, or absolute path** is emitted. Running twice produces byte-identical output — proven by
`test/token-codegen.test.js` (CODEGEN-DETERMINISTIC).

## Generated-file contract
Each output carries the header `AUTO-GENERATED — DO NOT EDIT.`, the canonical source path, and the
schema version (`shadow-spatial-tokens/2`). Do not hand-edit; change the JSON and regenerate.

## Tests: `test/token-codegen.test.js` (6, all pass)
STALE-GENERATED-FILES-DETECTED (`--check` exits 0), CODEGEN-DETERMINISTIC (byte-identical re-run),
generated-warning + no leak (no abs-path/timestamp), JS covers every canonical key with no extras +
values round-trip, C#+CSS represent every key, EN/ZH parity.

## Not done in this increment (see TOKEN_CODEGEN_REMAINING_GAPS.md)
Runtime consumers are **validated against** the generated JS but most are not yet rewritten to
*import* it; the Unity `ShadowDesignTokens.Resolve` profile shading is still hand-authored (the
generated C# is the semantic-identity table, not the profile resolver).
