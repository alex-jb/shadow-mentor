# Visual acceptance — degraded-tracking banner (UX-04)

Every artifact:

```
EDITOR_SIMULATION_ONLY
NOT_BEAM_PRO_EVIDENCE
NOT_OST_PHYSICAL_EVIDENCE
NOT_PHYSICAL_XR_VALIDATION
```

Captures regenerated with the existing harness in a **fresh Unity process**, separate from the full
PlayMode suite, so its known session pollution (UX-15, not fixed here) could not contaminate the
regression. Byte-identical PNG output was neither required nor achievable — the dynamic OS font atlas
makes this harness's output non-byte-deterministic — so acceptance is the deterministic geometry
tests plus human review.

## Human review

| check | result |
|---|---|
| right-edge clipping | **gone** — the LOST banner now wraps to three lines entirely inside the frame |
| left-edge clipping | none |
| accidental ellipsis | none in any state, either language |
| mid-word / mid-sentence cutoff | none — the sentence completes on the third line |
| fallback meaning clear | yes — `TRACKING LOST — switched to / session-relative layout; audit / state preserved` reads as one warning |
| banner visually associated with tracking | yes — same amber warning family, same top-right position, directly across from the `tracking:` header |
| competes with first-failure content | no — it sits above the columns and clears them |
| overlaps the header | no — the short header keeps its own row; asserted by test |
| `d664873` colour regression | none — status palettes render unchanged |
| `d7feb01` layout regression | none — column widths, gaps, spacing and the evidence guide are asserted unchanged |
| English clean | yes |
| Chinese clean | yes — `SCANNING` keeps its three authored lines with no re-wrap; `LOST` wraps to two |

## States reviewed

`DesktopDark`, `XrealOstBright`, `AccessibilityHighContrast` × English and Chinese ×
tracking known (no banner), `SCANNING`, `LIMITED`, `LOST`, `RECOVERING`.

The `tracking-lost__en__AccessibilityHighContrast.png` capture that originally evidenced UX-04 now
shows the banner complete and contained — same fixture, same state, same profile.

## One thing the tests initially got wrong

The completeness assertion first compared whitespace-separated words, which fails for Chinese: with no
spaces the whole message is one token, so **any** legitimate CJK wrap looked like data loss. It now
compares the rendered text with line breaks removed against the committed copy, and separately
forbids a line starting with stranded closing punctuation. That is the correct test — the meaning must
survive the layout, not the layout survive the meaning.

## Not claimed

No physical optical readability, no waveguide behaviour, no environmental-light readability, no real
field-of-view placement, no head-motion readability, no physical tracking transitions, no controller
interaction, no viewing comfort. `SHADOW_TRACKING_BANNER_DEVICE_PASSED` remains **false**.
