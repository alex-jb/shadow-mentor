# Token profile-override policy

**Status: DESIGN POLICY — NOT DEVICE VALIDATED.** Governs how a surface may re-shade a semantic
state without breaking the canonical meaning.

## The distinction: semantic identity vs visual profile

The canonical source `design/shadow-spatial-tokens.json` (`shadow-spatial-tokens/2`) fixes each
state's **semantic identity**: its meaning, EN/ZH text, icon, shape, and *reference* colour. A
**visual profile** is allowed to pick a different exact shade for a given surface (OST optics, high
contrast, projector, grayscale review) — but it may NOT change the meaning, the text/icon/shape, or
the **semantic hue family** of an affirmative status cue.

- `status.VERIFIED` = green is the reference. A profile may brighten/darken green for OST legibility.
- A profile may NOT make VERIFIED red, or reuse green for a non-verification concept.

Codegen enforces the identity side: `scripts/generate-tokens.mjs` refuses to build if verification
green leaks onto a non-verification state (`greenAllowed` set), if approval shares verification
green, or if a distinctness pair aliases. Unity's `ShadowTokenParityTests` assert the hue families
hold across all five `ShadowVisualProfile`s.

## The one deliberate deviation: `AuditRoomProvenance` (Three.js Audit Room)

`demos/replay/3d/constants.js` `STATUS.intact = #E8E8E8` (neutral paper), **not** the semantic
VERIFIED green. This is intentional and is named the **`AuditRoomProvenance`** profile.

**Why it is correct, not an exception:**

1. In the Audit Room *every card is intact by default* — it is a provenance replay of a whole,
   verified chain. If the resting surface were painted verification green, green would become the
   room's background and lose all signal value. Green must mark a verification **event**, never a
   resting fill (design Rule 15 restraint; Severment two-colour discipline).
2. Verification is instead carried by **deviation**: `tampered #FF4A4A` (red) marks a break, and
   `healed #3DDC97` (green) is the transient verify/reset **pulse** — the affirmative verification
   moment. So green still means verification here; it is a confirmation cue, not a surface colour.
3. The verified *status* of an intact card is still legible without colour: text + glyph + the
   absence of the red tamper mark + trust badges (surface ≠ status — colour on the card **body**
   carries no state per this scene's principle 5; edges/text/badges do).

**This is surface-vs-status, not colour drift.** The card *surface* is neutral; the *status* is
expressed by cues that obey the canonical hues.

## Machine-enforced so "intentional" can't become "arbitrary"

`test/threejs-profile-override.test.js` pins:
- `STATUS.intact` is neutral (not green, not red) AND ≠ the flat `status.VERIFIED` colour.
- `healed` stays green (verification event cue) and `tampered` stays red (chain break).
- the profile is **named in-source** (`AuditRoomProvenance`) and points at this policy doc.

If someone later paints an intact card green, or drops the green heal pulse, or renames/removes the
in-source marker, this test fails.

## Adding a NEW profile (the rule)

A new visual profile (e.g. a projector or partner-brand palette) is allowed only if:

1. It re-shades **surfaces or exact shades**, never meanings, text, icons, or shapes.
2. Affirmative status cues keep their canonical hue family (verification stays green, failure red,
   caution amber, selection/approval blue, not-evaluated neutral).
3. It is **named** (a string identifier), documented in this file, and covered by a parity test.
4. It goes through a PR — no silent per-file hex edits.

Anything that fails (1)–(4) is drift, and the codegen/parity guards are expected to reject it.
