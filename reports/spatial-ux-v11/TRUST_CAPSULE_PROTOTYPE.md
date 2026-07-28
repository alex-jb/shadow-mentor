# Trust Capsule prototype

**Status: PROTOTYPE — NOT DEVICE VALIDATED.** An honest, compact, expandable trust summary.

## The point
One generic green check is a lie. Integrity can be `VERIFIED` while analytical correctness is
`NOT_EVALUATED`, approval is `APPROVAL_NOT_PRESENT`, and the posture is only `SELF_SIGNED`. The Trust
Capsule shows those eight dimensions **separately**, each resolving to a canonical **generated**
semantic token (text + icon + shape + colour + a11y, EN/ZH) — never colour alone.

## Collapsed
`SHADOW · INTEGRITY VERIFIED` (reflects integrity only — never implies correctness/approval).

## Expanded — eight independent dimensions
1. Evidence integrity
2. Source links
3. Analytical correctness
4. Human review
5. Human approval
6. Trust posture
7. External anchoring
8. Open independent verifier (an action → the offline verifier)

Required explicit distinctions, pinned by tests:
- `VERIFIED` integrity ≠ `NOT_EVALUATED` correctness (different colour + text)
- `APPROVAL_NOT_PRESENT` (not green, not "approved")
- `SELF_SIGNED` ≠ `TIME_ANCHORED` (different colour + text)
- not one generic green check for everything (`assertNotAllGreen`)

## Three surfaces
| Surface | Artifact | Status |
|---|---|---|
| Model (source of truth) | `lib/trust-capsule.js` + `test/trust-capsule.test.js` (6 tests) | **verified** in this environment |
| Browser | `reports/spatial-ux-v11/trust-capsule/index.html` (offline, self-contained, deterministic — `scripts/generate-trust-capsule.mjs`) | **generated + checked** offline |
| Unity | `apps/shadow-lens/unity/Assets/ShadowLens/Design/ShadowTrustCapsule.cs` (consumes generated `ShadowSemanticTokens`; no hardcoded status table) | **authored** — not compiled here; Unity EditMode not claimed |
| Three.js conceptual | documented below | conceptual — not rendered here |

### Three.js conceptual review
In the Audit Room the Trust Capsule is a single anchored panel (reusing the leader-line annotation
system from this increment) whose eight rows use the same generated token colours/glyphs as the
browser prototype. The capsule is a *summary* surface; exact hashes/signatures stay in the 2D
verifier (`OPEN VERIFIER`). It is not rendered in this environment (no browser) — the browser
prototype is the reviewable stand-in and the JS model is the shared contract.

## Boundaries held
Does not modify the frozen `verify.html`. The `OPEN VERIFIER` action points to the offline
independent verifier; it does not embed or alter it.
