# Visual acceptance — evidence-guide internal layout (UX-14)

Every artifact:

```
EDITOR_SIMULATION_ONLY
NOT_BEAM_PRO_EVIDENCE
NOT_OST_PHYSICAL_EVIDENCE
NOT_PHYSICAL_XR_VALIDATION
```

Captures regenerated with the existing harness in a **fresh Unity process**, separate from the full
PlayMode suite (UX-15 unfixed). PNG output is non-byte-deterministic (dynamic OS font atlas), so
acceptance is the deterministic geometry tests plus human review.

## Human review

| check | result |
|---|---|
| sequence numbers clearly readable | **yes** — `#1..#4` sit on their own row, none touching a node or label |
| each label associated with the correct node | yes — top label, node and index share one x per step |
| any internal overlap remains | **no** — the four rows are cleanly separated |
| connector crosses text | n/a — the rail uses discrete nodes, no connector lines cross labels |
| first-failure evidence visible | yes — `#3` red with the `FIRST` marker above it |
| guide subordinate to the primary conclusion | yes — the `◆ FIRST FAILURE` conclusion (0.046) still dominates; the rail is small and lower |
| column-layout regression | none — `d7feb01` columns unchanged |
| Trust Strip regression | none |
| tracking-banner regression | none |
| profile-colour regression | none — the `d664873` palettes render unchanged |
| new bottom-edge clipping | none — the action legend clears the viewport with 0.185 to spare |
| English and Chinese clean | yes — the Chinese rail (`首失` / `↓下游` / `#1..#4` / `上一步 下一步 …`) is equally clean |
| guide excessively dense | no — it is less dense than before; the rows have room |

## States reviewed

`DesktopDark`, `XrealOstBright`, `AccessibilityHighContrast` × English and Chinese ×
normal evidence chain, first failure, missing-source, first-failure + tracking-degraded.

The `first-failure__en__DesktopDark.png` that evidenced UX-14 now shows four clearly separated rows:
top labels (`FIRST` / `↓dep`), the node squares, the `#n` indices, and the action legend — none
touching.

## Step counts

The 6-step case (the maximum the fixtures produce) was verified geometrically: one node and one index
per step, the rightmost node at world x 0.70 well inside the safe width, no overlap with any other
region. It is not in the committed capture fixture, which is 4-step —
`NOT_CAPTURED_WITH_EXISTING_FIXTURES` for a PNG, proven by the geometry test instead.

## Not claimed

No physical guide readability, waveguide contrast, field-of-view occupation, head-motion scanning
burden or comfort. `SHADOW_EVIDENCE_GUIDE_DEVICE_PASSED` remains **false**.
