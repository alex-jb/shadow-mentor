# Visual acceptance — profile-aware semantic status contrast

Every artifact below is:

```
EDITOR_SIMULATION_ONLY
NOT_BEAM_PRO_EVIDENCE
NOT_OST_PHYSICAL_EVIDENCE
NOT_PHYSICAL_XR_VALIDATION
```

"OST profile" here names an **Editor simulation profile**. It is not validated optical see-through
readability, and this increment makes no claim about one.

## How acceptance was decided

1. **Deterministic token contrast tests** — 266 combinations, 0 failures, lowest ratio 4.65
   (`SHADOW_STATUS_CONTRAST_MATRIX.md`).
2. **Structural tests** — resolver behaviour, per-profile divergence, unknown-profile throw,
   identity invariance, meaning-critical pair separation, enum-vs-token coverage.
3. **Human review of the regenerated captures** (below).

Byte-for-byte PNG equality was **not** used. OS font-atlas generation makes this harness's output
non-byte-deterministic — the same commit regenerates every PNG with different bytes — so an image
diff would produce false failures and prove nothing about colour.

## Captures regenerated (existing fixtures, existing states, no layout change)

Regenerated with the existing harness in a **separate Unity process** from the full PlayMode suite,
so its known session pollution could not contaminate the regression result.

| profile | language | states reviewed |
|---|---|---|
| `DesktopDark` | en, zh-CN | overview · first-failure · downstream-affected · approval-present · tracking-scanning · tracking-lost (+ 8 more en-only) |
| `XrealOstBright` | en | overview · first-failure · downstream-affected · approval-present · tracking-scanning · tracking-lost |
| `AccessibilityHighContrast` | en | same six |

Verified / warning / failure / unknown-or-source-unavailable and the disclaimer are all visible in
`first-failure` and `tracking-lost`.

## Pixel-histogram proof that the profile actually reached the renderer

| capture | dominant status colours found in the PNG |
|---|---|
| `first-failure__en__XrealOstBright.png` | `#a12126` · `#1254a0` · `#754c00` · `#4b545d` — the OST renditions |
| `first-failure__en__DesktopDark.png` | `#ef4444` · `#3b82f6` · `#fbbf24` · `#8a92a0` — unchanged from before |

This is the strongest available offline evidence that the profile propagates: the bright profile now
renders its own palette while the dark profile is untouched.

## Human review

**XrealOstBright — pass.** Every status token reads against the light field. Verification green is a
deep green, first-failure a deep red, self-signed a dark olive, and the absent/unknown states a dark
slate that is legible but still visibly subordinate. Before this change the same frame rendered those
tokens at 1.03–2.33 : 1 and they were effectively invisible.

**AccessibilityHighContrast — pass.** It is now materially different from `DesktopDark` rather than
near-identical: pure green `#00E676`, high-chroma pink-red `#ff6180`, saturated yellow `#FFD600`,
cyan `#40C4FF`. That was the substance of UX-05.

**DesktopDark — unchanged, as intended.** Visual stability was a requirement; the histogram confirms it.

**Disclaimer — pass.** `SIMULATED — NOT DEVICE VALIDATED` is legible in all three reviewed profiles
with wording, geometry and placement untouched. It does not read as a success signal.

## What the captures still show — and were not supposed to fix

The overlapping text, the clipped tracking banner, the collided Trust Strip rows and the empty lower
band are all still present. They are UX-02 / UX-03 / UX-04 / UX-08 / UX-14 and are **deliberately
untouched** by this increment. Colour legibility and layout legibility are separate defects; this one
fixed colour.

## Still required on the Beam Pro

Actual optical see-through readability · glare and environmental-light behaviour · optical colour
appearance through the waveguide · comfortable viewing distance · controller interaction · physical
spatial composition. None of these can be inferred from an Editor capture, and none is claimed.
