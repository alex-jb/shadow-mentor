# Audit Workspace — profile review

Captured DesktopDark (all 14 states) + representative states in XrealOstBright (SIMULATED) and
AccessibilityHighContrast. Naming `<state>__<lang>__<profile>.png`.

## DesktopDark — PASS
Current Focus dominates; Source / Trust subordinate + readable; rail compact; first failure obvious
(red + ◆); downstream subordinate (grey `#4 dep` vs red `#3 FIRST`); review ≠ approval; no large
unexplained empty region beyond the intentional lower band; no critical clipping.

## XrealOstBright — SIMULATED, PASS with a noted contrast caveat
Rendered over a bright grey background (see-through OST simulation). The profile supplies dark text,
which stays readable on the bright plate. Critical status colours survive: VERIFIED green, FIRST_FAILURE
red, SELF-SIGNED amber, REQUIRES REVIEW blue. Every OST image carries `SIMULATED — NOT DEVICE VALIDATED`.
**Caveat (honest):** secondary grey text (`NOT EVALUATED`, `APPROVAL ABSENT`) is low-contrast on the
bright plate — critical states are not grey-only, so meaning is not lost, but grey secondary text would
benefit from a backplate on a real device. **No OST-READABILITY-DEVICE-VALIDATED claim is made.**

## AccessibilityHighContrast — PASS
Black background; states remain distinct through text + colour + the rail's shape/position, not subtle
opacity. First failure and downstream stay distinct; review and approval stay distinct.

## No state depends on hue alone
Every status carries text (localized) + a colour + a shape/position cue (rail break, ◆ marker, glyph
name). Removing hue (grayscale review, done earlier in the token-review page) still leaves states
identifiable by text + shape.

## Flags
- XREAL-OST-SIMULATION-CAPTURED ✅ (simulation only) · ACCESSIBILITY-HIGH-CONTRAST-CAPTURED ✅
- OST-READABILITY-DEVICE-VALIDATED ❌ (no device) · DEVICE-PERFORMANCE-MEASURED ❌
