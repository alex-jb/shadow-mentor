# Visual acceptance — first-failure hierarchy (UX-07)

Every artifact:

```
EDITOR_SIMULATION_ONLY
NOT_BEAM_PRO_EVIDENCE
NOT_OST_PHYSICAL_EVIDENCE
NOT_PHYSICAL_XR_VALIDATION
```

Captures regenerated with the existing harness in a **fresh Unity process**, separate from the full
PlayMode suite (its session pollution is UX-15, not fixed here). Byte-identical PNGs were neither
required nor achievable — the dynamic OS font atlas makes output non-byte-deterministic — so acceptance
is the deterministic hierarchy tests plus human review.

## The ten review questions

| # | question | answer |
|---|---|---|
| 1 | first failed step identifiable immediately? | **yes** — `◆ FIRST FAILURE` is now the single largest element with a red rule under it |
| 2 | downstream consequence still understandable? | yes — `Downstream affected: 1` and the rail's `↓dep` marker are unchanged |
| 3 | source / provenance still readable? | yes — the left column is untouched |
| 4 | human review and approval still distinct? | yes — both render at body size in their own colours |
| 5 | avoids an alarm-screen effect? | yes — one emphasised conclusion, no glow, no motion, no full-red field |
| 6 | normal state calm and unambiguous? | yes — a verified focus shows no conclusion block and both titles keep full size |
| 7 | survives Chinese expansion? | yes — `◆ 首个失败` is the largest element, one line, with the same rule |
| 8 | OST simulation preserves the `d664873` contrast? | yes — status palettes render unchanged; the conclusion uses the profile's failure-red |
| 9 | `d7feb01` layout intact? | yes — columns, spacing and the evidence guide are asserted unchanged |
| 10 | `01864b4` tracking banner intact? | yes — the `first-failure+tracking-degraded` capture shows both the banner and the emphasised conclusion, neither clipped |

## States reviewed

`DesktopDark`, `XrealOstBright`, `AccessibilityHighContrast` × English and Chinese ×
normal-verified, first-failure, first-failure + approval-present, first-failure + source-missing,
tracking-degraded + first-failure.

The `first-failure__en__DesktopDark.png` that originally evidenced UX-07 now shows the failure as the
dominant conclusion; the story title `Banking Audit` and the entity title `Council Decision` have
stepped down and no longer out-weigh it.

## Normal-state proof

`overview__en__DesktopDark.png` (focus = verified `Income`, no failure in focus) shows the title back
at full size, **no** `◆ FIRST FAILURE` block and **no** accent rule. The emphasis is strictly
state-driven.

## What is deliberately unchanged

The word "FIRST FAILURE" still also appears — smaller — in the `Verification:` field, the Trust Strip
and the evidence rail. Those are the audit facts in their own regions; UX-07 was about which of them
is the *primary* conclusion, not about deduplicating the word. Reducing that repetition further would
be a separate hierarchy change and is not done here.

## Not claimed

No physical first-glance salience, no field-of-view competition, no waveguide colour/contrast, no
head-motion scanning burden, no comfort. `SHADOW_FIRST_FAILURE_HIERARCHY_DEVICE_PASSED` remains
**false**.
