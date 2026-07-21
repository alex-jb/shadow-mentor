# Wednesday claim guardrails

Claim-safety scan before spatial-UX-v2 work. Rule: a term appearing in a file is not itself an
overclaim — only material that is **spoken or displayed in the Wednesday demo** matters. The
Wednesday demo is the **browser verifier** (frozen `verify-acceptance/wednesday-package/` + its
narration/subtitles/video) plus the **frozen Unity guided-stage** (FIXTURE MODEL / REAL SIGNED /
STANCE STRENGTH labels).

## The guardrails (authoritative)
1. **XREAL One Pro base behavior is native 3DoF, not 6DoF.** Do not describe One Pro as native 6DoF.
2. **6DoF requires the supported XREAL Eye path** and remains **device-validation-pending**.
3. **Plane tracking, image tracking, hand tracking, depth mesh, spatial anchors are NOT available**
   on this target path (One series). Use session-relative placement + frozen document plane.
4. **Head-directed focus is NOT eye tracking.** UI copy: "HEAD-DIRECTED FOCUS" / "XR GAZE INTERACTION".
5. **SR 26-2 "GenAI/agentic Tier-3 exemption / footnote-3 carve-out" is NOT supported by the reviewed
   primary source** (federalreserve.gov/supervisionreg/srletters/SR2602.htm) and must not be presented
   as a regulatory fact. Say at most "an independent evidence layer for a governance gap", not "SR 26-2
   exempts / carves out GenAI".
6. **FIXTURE, DESKTOP MOCK, ANDROID-BUILT, DEVICE-VALIDATED are distinct** and never conflated.

## Scan result — Wednesday-spoken/displayed material: CLEAN
- `media/wednesday/narration/*` + `*.srt` + `media/wednesday/README.md`: only match was "profile" (a
  status-matrix row) — **no 6DoF / eye-tracking / plane / anchor / SR 26-2 claim is spoken or shown.**
- Frozen browser verifier (`verify.html`, wednesday-package): evidence/verifier semantics only; no XR
  or regulatory claim.
- Frozen Unity guided stage labels: FIXTURE MODEL / REAL SIGNED / STANCE STRENGTH / HEAD-DIRECTED FOCUS
  — no 6DoF or eye-tracking claim.
- **Conclusion: no material false claim is spoken or displayed in the Wednesday demo → no media, video,
  subtitle, or APK change is required.** (Per instruction, terms appearing elsewhere do not trigger a
  frozen-media rebuild.)

## Flagged (NOT Wednesday demo; fix in a later copy pass, not this phase, not frozen media)
These are stale / non-demo docs that DO overclaim and should be corrected when their copy is next
touched — they are **not** part of the Wednesday demo:
- `docs/shadow-product-proposal*.{md,html}`, `docs/shadow-personas-matrix.md`: "eye tracking",
  "gaze-dwell timeline", "XReal eye tracker" HUD copy → reframe to head-directed focus (Air 2 Ultra
  6DoF is officially real, but eye-tracking gaze-dwell on One is not the target path).
- `product-facts.json` `scope_honesty` + `docs/citation-map.json:378` ("GenAI/agentic AI carved out by
  footnote 3") + `docs/VENDOR_VIABILITY.md` ("gap the guidance explicitly leaves open"): the **SR 26-2
  Tier-3/footnote-3 carve-out** claim — unsupported by the primary source; soften to "independent
  evidence layer for a governance gap", drop "carved out by footnote 3".
- Correct-as-written (no fix): `docs/roadmap/SHADOW_XR_DEMO_BRIEF.md` ("6DoF anchoring handled BY THE
  GLASSES via XREAL Eye, not by our app") and `docs/xreal-one-pro-test-protocol` (6DoF attributed to the
  Eye add-on).

No frozen artifact modified. This document is the standing guardrail for all spatial-UX-v2 copy.
