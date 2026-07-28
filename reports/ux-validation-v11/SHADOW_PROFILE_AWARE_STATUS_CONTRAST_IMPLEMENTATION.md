# Profile-aware semantic status contrast — implementation (UX-01 P0 · UX-05 · UX-09)

```
PROFILE_AWARE_STATUS_CONTRAST_OFFLINE_PASSED = true
PROFILE_AWARE_STATUS_CONTRAST_DEVICE_PASSED  = false
```

## The defect

`ShadowStatusGlyph.Resolve(string status)` took only a status. The canonical token file gave each
state a single `color`. Meanwhile `ShadowDesignTokens.Resolve(profile)` already varied theme text and
background per profile. So the surface changed for the bright and high-contrast profiles and the
semantic layer never did — and status is the entire semantic payload of an audit workspace.

Measured against the OST capture surface `#C7CCD4`: `#4ade80` 1.08 · `#fbbf24` 1.03 · `#8a92a0` 1.94 ·
`#ef4444` 2.33. The `SIMULATED — NOT DEVICE VALIDATED` disclaimer used a hardcoded `#961418` and
scored 2.20 / 2.41 in the dark profiles.

## What changed

### 1. Token source — `design/shadow-spatial-tokens.json`, schema `/2` → `/3`

- Every coloured entry now carries an explicit **`color_family`** (47 entries). The family is the
  meaning; the hex is only a rendition.
- A new **`visual_profiles`** block defines, per profile, the `surface`, the `capture_surface` where
  the capture rig clears to a different colour, the `text_contrast_floor` and `graphic_contrast_floor`,
  an explicit hand-reviewed hex for **every family**, and the **`disclaimer`** colour.
- **All five** `ShadowVisualProfile` enum members are covered — `DesktopDark`, `BrowserDark`,
  `XrealOstBright`, `ProjectorPresentation`, `AccessibilityHighContrast`. A profile the enum can select
  but the tokens do not define would throw at render time; a test now pins that.

Values were **not invented where the repository already had reviewed ones**. `ShadowDesignTokens.Resolve`
already carried per-profile `Verified` / `Warning` / `Tampered` / `Information` / `Neutral` roles; the
bright, projector and high-contrast palettes are built from those, with two evidence-backed
strengthenings recorded below. `DesktopDark` and `BrowserDark` keep the existing canonical palette so
the accepted captures stay visually stable.

### 2. Exactly three canonical colours moved — each because it failed a floor

| Entry | Before | After | Evidence |
|---|---|---|---|
| `governance.HUMAN_REVIEW_RECORDED` | `#6b7280` | `#b6bec9` | 3.97 : 1 on `#0B0F16`, below the 4.5 text floor |
| `edge_type.SUPPORTS` | `#556` | `#7c8899` | 2.63 : 1 on `#0B0F16`, below the 3.0 non-text floor |
| `edge_type.DERIVED_FROM` | `#556` | `#7c8899` | same |

Two further strengthenings apply only to non-DesktopDark renditions: the `XrealOstBright` roles were
darkened so they clear 4.5 against **both** their own surface `#F4F6F8` **and** the capture surface
`#C7CCD4` (the existing theme values cleared the former at 4.62–5.71 but only reached 3.10–3.83 on the
latter), and `AccessibilityHighContrast` `Tampered` moved `#FF1744` → `#ff6180` to clear that profile's
7.0 floor (it scored 5.46).

### 3. Generator — `scripts/generate-tokens.mjs`

- Validates `color_family` on every coloured entry, every family in every profile, both floors, both
  colour formats, and that **a state's canonical colour equals its family's `DesktopDark` rendition** —
  so a state can never silently drift out of its own family.
- Emits the profile palette into all three adapters: C# `ShadowSemanticTokens.Profiles` /
  `ColorFor(category, key, profile)` / `PaletteFor(profile)`; JS `SHADOW_VISUAL_PROFILES` /
  `shadowColorFor(category, key, profile)`; CSS `[data-shadow-profile="…"]` custom-property blocks.
- **The pre-existing semantic invariants were repaired.** They compared literal hexes
  (`s.color === "#4ade80"`), so the moment a rendition changed they would have stopped matching and
  silently passed. They now compare `color_family`. Verified by deliberately mislabelling
  `governance.APPROVAL_PRESENT` and confirming `verification-green misused by governance.APPROVAL_PRESENT`
  fires.

### 4. Resolver — `ShadowStatusGlyph`

```csharp
public const string DefaultProfile = "DesktopDark";
public static ShadowGlyph Resolve(string status) => Resolve(status, DefaultProfile);
public static ShadowGlyph Resolve(string status, string profile);   // throws on an unknown profile
public static string FamilyColor(string family, string profile);
public static string SurfaceColor(string profile);
public static string DisclaimerColor(string profile);
```

Identity — text, Chinese text, icon, shape, a11y — is profile-invariant; only the rendition changes.
The fail-closed path for an unrecognised status still returns `UNKNOWN STATUS` (never `VERIFIED`) and
now renders its neutral in the **active** profile too. The single-argument overload is retained only
for callers that genuinely mean the DesktopDark rendition, and it is named so that reading it makes
the assumption visible.

### 5. Call sites — `ShadowAuditWorkspace`

A `ProfileId` accessor feeds `Profile.ToString()` into every status colour lookup: `GlyphColor`, the
focus-field rows, the Trust Strip values, the evidence-rail quads and labels, and the degraded-tracking
banner. **There is no hardcoded status hex left in the component** (verified by grep).

### 6. Disclaimer

`Hex("#961418")` became `Hex(ShadowStatusGlyph.DisclaimerColor(ProfileId))`. Wording, geometry,
placement and prominence are unchanged; it remains visually distinct from normal content and is not
rendered in any family that could read as a success signal.

## Proof the rendition actually changed on screen

Pixel histograms of the regenerated captures:

| capture | dominant status colours |
|---|---|
| `first-failure__en__XrealOstBright.png` | `#a12126`, `#1254a0`, `#754c00`, `#4b545d` — the OST palette |
| `first-failure__en__DesktopDark.png` | `#ef4444`, `#3b82f6`, `#fbbf24`, `#8a92a0` — unchanged |

DesktopDark is byte-for-byte the same palette it had before; only the profiles that were broken moved.

## Deferred, untouched

Layout metrics (UX-02, UX-03, UX-04, UX-08, UX-14) · hierarchy (UX-07) · absence encoding (UX-11) ·
Workspace-vs-Flat colour grammar (UX-12) · interaction model (UX-13) · the 8 pre-existing
presenter/spatial-agent-panel PlayMode failures (UX-06) · capture-harness session pollution and PNG
non-determinism (UX-15).
