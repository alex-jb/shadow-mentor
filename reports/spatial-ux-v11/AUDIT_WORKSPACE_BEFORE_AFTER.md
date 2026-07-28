# Audit Workspace — BEFORE / INTERMEDIATE / AFTER

Failure evidence is preserved, never overwritten. Contact sheet:
`media/spatial-ux-v11/audit-workspace/contact-sheets/01-layout-evolution.png`.

| Stage | Location | State |
|---|---|---|
| **BEFORE — FAILED** | `audit-workspace/BEFORE-overlap/` (7 png) | every region piled on the others — total overlap, no hierarchy, unreadable |
| **INTERMEDIATE — PARTIAL** | `audit-workspace/INTERMEDIATE-partial/` (7 png) | regions separated + readable, but `tracking:` raw enum, residual crowding, English-only labels |
| **AFTER — ACCEPTED** | `audit-workspace/*.png` (32, `<state>__<lang>__<profile>.png`) | localized, spaced, tracking fixed, rail markers short, source/trust fit |

## Corrections applied (bounded, per confirmed defect)
1. **Header title ↔ tracking touch** → increased vertical separation (title 0 / tracking −0.30 /
   simulated −0.46); tracking value now a short localized name (`3DoF tracked` / `3DoF 追踪`), fixing
   a `tracking: UNKNOWN STATUS` bug (tracking value had been wrongly routed through the status-glyph
   map).
2. **Source Card crowding** → row spacing widened (0 / −0.18 / −0.34 / −0.48 / −0.62); missing source
   shows explicit localized `SOURCE NOT PRESENT` / `LOCATION NOT AVAILABLE`.
3. **Trust Strip fourth-group clipping** → strip pulled inward (x 2.55→2.25), labels + status values
   truncated to fit; all four groups (Integrity / Provenance / Decision Support / Human-Policy) now
   fully visible.
4. **Chinese field labels English** → `ShadowWorkspaceLabels` bilingual resource + status values from
   generated tokens; zh capture fully localized (see AUDIT_WORKSPACE_LOCALIZATION.md).
5. **Rail `FIRST FAILURE` marker overlapped `#4`** → shortened to `FIRST` / `首失`.
6. **Center fields overran into Trust Strip** → truncation tightened (14 em) + camera z=−7.2.

## Residual (honest, minor — not claimed clean)
- slight center↔right proximity (verification value near the trust value);
- `role` VALUE not localized (entity Kind);
- OST-sim secondary grey text is low-contrast on the bright background (critical states stay readable).
