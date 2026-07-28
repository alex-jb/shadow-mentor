# Token conflicts — resolved / documented

- **Ambient Council approve = verification-green** → RESOLVED (blue #3B82F6 + ✓ stamp; commit 37ea94f).
  Business approval no longer reads as cryptographic verification.
- **APPROVAL vs VERIFICATION conflation** (canonical) → SEPARATED: APPROVAL_PRESENT is blue+stamp, VERIFIED
  is green; tests forbid green for approval.
- **SCANNING shown only as generic LIMITED** → canonical SCANNING has its own amber state + explicit
  "SCANNING FOR POSITION / hold still" copy; distinct from LIMITED and LOST.
- **FIRST_FAILURE vs DOWNSTREAM_AFFECTED** → distinct colour (red vs neutral) + glyph (broken-seal-first vs
  chain-arrow-dashed); downstream is not an independent first failure.

## Documented intentional deviations (NOT bugs)
- **Three.js Audit Room uses GRAY (#E8E8E8) for "verified/intact"**, not green — a deliberate
  bright-content-on-black design (its own principle). The SEMANTIC meaning (verified) is consistent; only the
  shade differs. Parity rule is "meaning unified, layout not," so this is allowed + documented.
- **Three.js "healed" is GREEN (#3DDC97) but TRANSIENT** (reset-replay animation), which the canonical
  permits (green may briefly animate for healed; it must not be a *persistent* verification-green for a
  non-verification concept). Confirmed transient by its constants.js comment.
