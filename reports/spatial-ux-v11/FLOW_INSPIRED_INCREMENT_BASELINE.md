# Flow-inspired increment — baseline

**Status: baseline snapshot before the Flow-inspired spatial-forensics + presentation-contract
increment. NOT DEVICE VALIDATED.**

## Scope (bounded)
Borrow two *validated* spatial-design patterns from Flow Immersive's public visual grammar and add a
Shadow-owned presentation contract. This is NOT a Flow integration, NOT a visualization editor, NOT
a copy of Flow assets. See `design/FLOW_SHADOW_RESPONSIBILITY_BOUNDARY.md`.

Borrowed (patterns only, re-implemented from scratch):
1. selected-object annotation with a **leader line** (fixes the Audit Room inspector pinned at a
   fixed world position);
2. explicit **sequence / time axes** with in-scene labels (pays down spec X2 "time ruler" debt).

New Shadow-owned contract:
3. `shadow-presentation-snapshot/v1` — a **derived view**, never canonical evidence;
4. claim-level presentation bindings;
5. `shadow-presentation-manifest/v1`;
6. presentation edit-classification policy;
7. an honest Trust Capsule prototype (browser + Three.js-conceptual);
8. a **design-only** future Flow adapter doc (no integration claimed).

Explicitly NOT copied from Flow: rainbow multi-colour category encoding (violates the Severance
two-colour / colour=status discipline), dense wireframe terrain, a GUI editor.

## Verified baseline
| Item | Value |
|---|---|
| Branch | `feat/shadow-spatial-ux-asset-audit-v11` |
| HEAD | `4275eff` (token codegen bridge) |
| Security ancestry | `9f889dd` is an ancestor ✓ |
| Token codegen | present (`4275eff`); `generate-tokens.mjs --check` clean |
| Frozen verifier | `verify.html` = `c478b46f…` (unchanged) |
| Stable APKs | 5 candidate APKs under `Build/Android/` recorded (hashes in AUDIT_WORKSPACE_BASELINE.md set); none to be overwritten |
| Node suite | 2010 pass / 0 fail / 3 documented skip |
| Unity | **no Unity binary in this environment** — Unity C# is authored, not compiled here; EditMode is NOT claimed passing by this increment |
| git state | clean at HEAD (token-codegen committed) |

## Current implementation facts (verified this session)
- **Inspector**: `demos/replay/3d/scene.js` builds an inspector panel at a fixed world placement
  (~`(2.4, y, 0.6)`), not anchored to the selected card — this is the defect the leader-line pattern
  fixes.
- **Event timestamps**: the replay bundle carries per-event `ts_utc` (used for ordering); the scene
  renders connectors but **no time-axis labels** — sequence spacing only, spec X2 debt open.
- **Story steps**: guided-story state exists (`shadow-guided-story-v1` schema + compiler); the
  presenter beats (`demo-beats.json`, beats 1–8) are the Shadow-owned narrative sequence.
- **Flow-shape JSON**: `api/spatial-render.js` + `lib/spatial-render.js` already emit an
  engine-neutral scene (`shadow-3d-scene-v1`); this is where an `attestation_ref` / presentation
  binding attaches — via an **adapter extension**, never by mutating canonical evidence.
- **Canonical status vocabulary**: `schemas/shadow-semantic-status-v1.schema.json` already defines
  VERIFIED / FAILED / NOT_EVALUATED / FIRST_FAILURE / AFFECTED_DOWNSTREAM / REQUIRES_HUMAN_REVIEW /
  HUMAN_APPROVAL / SOURCE_RESOLUTION / ANALYTICAL_CORRECTNESS / EXTERNAL_ANCHOR / etc. The new
  presentation schemas **reference** these; they do not invent a parallel status set.

## Guardrails held by this increment
Frozen `verify.html` untouched · stable APKs untouched · V1/V2 attestation semantics untouched ·
no Flow proprietary content · no Flow external API call · no Flow partnership/integration claim ·
no Beam Pro / device validation claim · presentation is a derived view, never canonical evidence.
