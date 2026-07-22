# img2threejs asset spike (hoainho/img2threejs)

Research-only. The tool was **NOT installed / NOT run** (installing it means `git clone` into
`~/.claude/skills/` and running its agent skill — not done, per the constraints). This spike documents
what the three experimental props would be, the provenance rules, and the mobile-suitability gate that
any generated asset must pass before it could touch a Shadow scene. 2026-07-22.

## Verified facts (real, via GitHub API)
- `github.com/hoainho/img2threejs`, commit `e8ff28a` (2026-07-22), release **v1.0**, **MIT**,
  **~1,870 stars**, 11 open issues.
- Output: a TypeScript factory `createXModel(spec, options) → THREE.Group`, with
  `root.userData.sculptRuntime` exposing **nodes / sockets / colliders / destruction groups**.
- "Scripts enforce, the model judges" — deterministic Python enforces structure; an LLM (Claude vision
  by default, via whatever agent host) only judges renders. Python 3.10+ stdlib, zero deps.
- Runtime output is **plain Three.js TS, no LLM at runtime, no heavy deps** → runs wherever Three.js runs,
  including mobile/ARM64. **Three.js version NOT specified; polygon budget NOT documented.**
- Stated strength: hard-surface objects (weak on characters).

## Why it fits Shadow (and where the red line is)
Shadow needs a small set of **hard-surface** 3D icons: document stack · signed seal · camera frame ·
evidence bundle · model artifact · commit node · human-review checkpoint. These are exactly the tool's
strength. Critically, the tool only produces **dumb visual geometry** — it has NO say over the guided-story
contract. Shadow's `shadow-guided-story-v1` semantics (statuses, first-failure, provenance, verification)
stay authoritative; an icon is an attachment anchored via sockets, never a source of meaning. So the red
line — "generation tool cannot change canonical story semantics" — is structurally satisfied.

## The three experimental props (spec only — generation gated on a second authorization)
Per the constraint "generate only three experimental visual props", the candidates are:
1. **signed-seal** — the Ed25519 seal node (audit-chain `signature` entity). Hard-surface, small.
2. **evidence-bundle** — the sealed audit record (audit-chain `audit_record`). Hard-surface.
3. **camera-frame** — the RGB frame placeholder (evidence pipeline). Hard-surface.
Each would be committed as a static `THREE.Group` factory under `prototypes/shadow-3d-v2/props/`, mapped
to an existing entity `kind` — it does NOT introduce a new semantic kind.

## Mandatory gates before any generated asset ships
- **Provenance recorded per asset:** tool + version (img2threejs v1.0, MIT), generation date, the source
  reference image's own license/origin, the emitted-code hash. Geometry is procedurally authored (not a
  scraped mesh), so there is no third-party-mesh copyright entanglement — but the reference image's
  license must be clean.
- **Mobile-suitability measured (Beam Pro ARM64):** polygon count per prop, draw calls, and a target
  budget (the tool documents neither — so we set explicit budgets and measure before shipping). A prop
  that exceeds the budget is rejected or simplified.
- **Pin the Three.js version** the emitted code targets and confirm it matches the vendored r160 in
  `prototypes/shadow-3d-v2/vendor/` (or adapt).
- **Visual consistency** with the existing status-shape + token system (`design/shadow-spatial-tokens.json`):
  status is still carried by shape+icon+label, never colour alone; a prettier icon may not weaken that.

## Constraints observed
Not installed · not run · no props generated · canonical story semantics untouched · nothing merged.

## Verdict
**ADAPT / ADOPT (as an authoring tool, gated).** Best fit of the seven: MIT, mobile-safe static Three.js
output with sockets/colliders, exactly Shadow's hard-surface icon set, and structurally unable to change
canonical semantics. Proceed only with a second authorization to generate the three props, and only after
setting explicit poly/draw-call budgets, pinning the Three.js version, recording per-asset provenance, and
keeping the status-shape system intact. Generated icons are attachments; the story contract stays the
source of meaning.
