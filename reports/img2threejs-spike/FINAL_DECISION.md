# img2threejs Shadow spatial prop spike — final decision

Research-only, isolated. Branch `research/shadow-img2threejs-prop-spike` (from `ada7de2`). No merge,
no Unity package change, no canonical story contract / verification-semantics change, stable APK +
verifier untouched, no global tool/hook install, no production runtime dependency. 2026-07-22.

## What was done
- **Tool verified** (`reports/img2threejs-spike/TOOL_INVENTORY / LICENSE_AND_PROVENANCE / NETWORK_BEHAVIOR`):
  img2threejs commit `e8ff28a`, v1.2.0, **MIT**, stdlib-only, **no network client / no bundled LLM / no
  external URLs emitted**. Cloned into `experiments/` for inspection only — NOT installed as a Claude
  skill, no scripts run. Provenance established → spike proceeded.
- **Three props authored** as repository-owned procedural `THREE.Group` factories in the tool's output
  style (Shadow-authored, MIT-clean, no copyrighted art — only geometric primitives). Raw:
  `experiments/img2threejs/raw/`; reviewed: `experiments/img2threejs/approved/`.
- **Isolated integration** (`experiments/img2threejs/prototype/`): a props layer attaches a prop as an
  optional visual to an existing canonical entity by KIND, keyed off the compiled scene model. Feature
  toggle `SHADOW_EXPERIMENTAL_SPATIAL_PROPS`, **default OFF**. Canonical ids unchanged; selection still
  resolves to the canonical entity; status colour still from the Shadow vocabulary; geometry carries no
  meaning; correct disposal on story switch.
- **Guards** (`test/img2threejs-props-spike.test.js`, 6 tests, green): budget, no baked canonical id,
  four distinct human-review states, bilingual a11y + 2D fallback, decorates only
  signature/audit_record/synthesis, and the seal copy affirms nothing (explicit disclaimer). Full suite
  1,946 / 1,943 / 3 skip / 0 fail.

## Budget (measured, THREE r160)
| Prop | meshes | triangles | materials | textures | draw calls |
|---|---|---|---|---|---|
| Evidence Bundle | 4 | 228 | 2 | 0 | ≤4 (mergeable) |
| Cryptographic Seal | 3 | 332 | 2 | 0 | ≤3 |
| Human Review (4 states) | 4 | 44–228 | 2 | 0 | ≤4 |
All under the target (5,000 tris) and hard max (10,000); ≤2 materials; 0 textures; no
transparency/particles/post-processing; no runtime network. ✅ mobile/XR budget compliant.

## Browser acceptance (Chromium 149, isolated)
0 external requests · 0 CSP violations · 0 console errors · 0 horizontal overflow at 1440×900 /
1280×720 / 390×844. Toggle OFF → 0 props (current visuals preserved). Toggle ON → props added
(audit-chain: 2 seal+bundle; persona: 1 human-review = REQUIRES_HUMAN_REVIEW). Story switch disposes
old props. **Semantic hash identical with props ON vs OFF** (props never touch the semantic block).
Media in `media/img2threejs-spike/` labelled EXPERIMENTAL VISUAL PROP · NOT DEVICE VALIDATED.

## Semantic-safety review (per §6)
- **Evidence Bundle** — a wrapped grouped package (not a DB/server); a11y explicitly says "not a source
  of truth". Does not imply verified source truth / complete evidence / production signing. ✅
- **Cryptographic Seal** — a disc-seal (not a checkmark/badge); a11y explicitly "not a correctness/
  approval claim". Does not imply correct conclusion / compliance / human approval. ✅
- **Human Review Checkpoint** — four DISTINCT geometries: REQUIRES_HUMAN_REVIEW (open ring) ·
  HUMAN_REVIEW_RECORDED (flat plate) · HUMAN_APPROVAL_NOT_PRESENT (hollow cone) · HUMAN_APPROVAL_PRESENT
  (solid octahedron). Never one shape for all four; approval-present is visually separate from
  review-required. ✅

## Per-prop decision
| Prop | Decision |
|---|---|
| Evidence Bundle | **ACCEPT** — budget-compliant, semantically honest, socketed |
| Cryptographic Seal | **ACCEPT** — budget-compliant, disclaims correctness/approval |
| Human Review Checkpoint | **ACCEPT** — four distinct honest states, a11y + 2D fallback |

## Final project decision

**KEEP AS RESEARCH-ONLY TOOL.**

Rationale (against the adoption checklist):
- ✅ clear licensing (MIT) · ✅ clear output provenance (Shadow-authored procedural, no scraped art) ·
  ✅ mobile budget compliance · ✅ semantic parity (hash unchanged) · ✅ no runtime dependency ·
  ✅ no misleading trust implication (reviewed + guarded).
- ⚠️ **"visible improvement over current geometric icons" is not yet proven.** The current status-shape
  system (icosahedron/octahedron/box + colour + label) is already clear and honest; the props add
  decoration, not decisive readability, and were captured small in-frame. That is the one adoption
  criterion not met.
- The tool's real value would be as an **authoring tool**, but running it requires an LLM-in-the-loop
  agent host + a `~/.claude/skills` install (a global install we deliberately did not do). The props we
  need are simple hard-surface primitives we can hand-author (as done here) without the tool.

Therefore: keep img2threejs as a **research-only** reference; keep the three props as an
**experimental, feature-flagged (OFF-by-default), isolated** layer that never ships to production or
device. Do NOT adopt it as a build-time tool yet — revisit only if a future readability study shows the
props decisively beat the current icons, and only with a second explicit authorization. Adoption is not
granted on visual appeal alone.
