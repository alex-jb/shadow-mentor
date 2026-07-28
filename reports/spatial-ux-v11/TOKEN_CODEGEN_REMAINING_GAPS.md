# Token codegen — remaining gaps

**Status: honest gap ledger for the token-codegen increment. NOT DEVICE VALIDATED.**

What this increment did NOT finish. None of these are claimed as done.

## 1. Runtime consumers validated, not yet fully migrated to import
The canonical JSON now generates `.cs` / `.js` / `.css` adapters, and the generated JS is the source
of truth for the codegen tests. But most runtime surfaces still carry their own hand-authored colour
constants (e.g. `demos/replay/3d/constants.js` STATUS/INK, Unity `ShadowDesignTokens` profile
resolver, `demo/xreal.html` inline palette). They are kept honest by **parity tests against the
generated table**, not by importing it. Full migration (delete the hand copies, import the generated
adapter) is the next step and was left out to avoid touching frozen/behavioural code in this pass.

## 2. Unity profile resolver is not generated
`ShadowSemanticTokens.Generated.cs` is the **semantic-identity** table (meaning + reference colour +
text/icon/shape). The per-profile *shading* (`ShadowDesignTokens.Resolve(profile)`) is still
hand-authored, because profile overrides are a design decision, not a mechanical transform of the
JSON. Generating a profile matrix would need the JSON to carry per-profile shades first.

## 3. CSS variables emitted, not yet wired into a stylesheet consumer
`generated/shadow-semantic-tokens.generated.css` defines the custom properties but no shipped page
`@import`s it yet. Wiring `demo/xreal.html` and the token-review page to consume the vars (instead of
inline hex) is deferred.

## 4. Icons/shapes are names, not assets
The tokens carry icon + shape *names* (`stamp-signed`, `octahedron`, …). There is no generated icon
sprite / mesh binding; each surface still maps the name to its own asset. A generated icon manifest
is out of scope here.

## 5. No device validation
Everything in this increment is build-time and screen-only. The token-review page and any contact
sheets are design reviews, not OST/glasses captures. Device-validated colour legibility on the
XREAL One Pro remains a separate, hardware-gated task.

## Explicitly NOT started
Audit Workspace primary UI, tracking-health auto-fallback wiring, graphics-context PlayMode lane,
CJK wrapping + OST Positive/Negative device capture — all remain future increments.
