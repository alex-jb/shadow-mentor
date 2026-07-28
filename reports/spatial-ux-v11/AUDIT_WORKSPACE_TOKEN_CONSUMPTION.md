# Audit Workspace — generated-token consumption

Every new Audit Workspace component takes status identity from the GENERATED Unity token table
(`ShadowLens.Generated.ShadowSemanticTokens`, produced by `scripts/generate-tokens.mjs`). No new
status colour literals, duplicate labels, duplicate Chinese, or duplicate glyph tables are
introduced.

- `ShadowStatusGlyph.Resolve(status)` maps a canonical status → `ShadowSemanticTokens.Get(category,
  key)` and reads Text/TextZh/Icon/Shape/ColorHex/A11y/A11yZh from there.
- The renderer maps the generated `Icon` name → a coarse procedural glyph (a renderer responsibility);
  the *semantic identity* still comes from the generated token.
- **Unknown status/glyph fails closed** to `UNKNOWN STATUS` (colour `#8a92a0`), never to VERIFIED —
  pinned by `UnknownStatus_FailsClosed_NotVerified`.
- Profile colours (luminance/panel/outline) come from the manually-authored
  `ShadowDesignTokens.Resolve(profile)`; a profile may re-shade but must not change status identity
  (guarded by the existing `ShadowTokenParityTests`).

Tests: `GeneratedTokens_Consumed_ForKnownStatus`, `UnknownStatus_FailsClosed_NotVerified`,
`TrustStrip_FourGroups_NotAllGreen` (EditMode, all pass in the 133/133 run).
