# HANDOFF — Step 4: shared story contract → HTML/Three.js/Unity adapters

**STATUS: commit-plan steps 1–10 COMPLETE.** All non-device-blocked work is implemented, tested,
browser-rendered, and Unity-compiled/tested. Only Android build + on-device validation remain (no
headset in this slice; the stable APK is untouched). Details in "Completion" below; the original
resume notes are kept underneath for provenance.

## Completion (2026-07-21)
Commits on `feat/shadow-shared-story-adapters` after the merge (`ec5406f`):
- `9e6d651` step 2–3 — semantic vocabulary + guided-story contract + 3 canonical fixtures
- `22cccfc` step 4 — deterministic compiler (cross-target semantic hash, fail-closed) · 16 tests
- `5f655e8` step 5 — HTML adapter + semantic-convergence parity (no redesign) · 4 tests
- `087b211` step 6 — Three.js adapter + player + browser acceptance (Chromium 149) · 6 tests
- `7df192f` steps 7–9 — Unity native adapter + Unity tests + cross-engine parity · 5 Node tests + Unity
- `dd72dbf` / `d95e538` step 10 — architecture + parity + adapter docs

Node suite: **1900 tests · 1897 pass · 3 skip · 0 fail** (+31 from the 1866 baseline).
forbidden-phrases: clean (1299 files). Frozen APK unchanged: `93f2a81a…`.

### Honest status ladder (verified)
SHARED-STORY-CONTRACT-AUTHORED ✅ · STORY-COMPILER-HOST-TESTED ✅ (16) · HTML-ADAPTER-INTEGRATED ✅ (4) ·
THREEJS-ADAPTER-INTEGRATED ✅ (6) · THREEJS-BROWSER-RENDERED ✅ (Chromium 149; 0 external/CSP/error/overflow) ·
UNITY-ADAPTER-AUTHORED ✅ · UNITY-COMPILED ✅ (ShadowLens.dll, 0 CS errors, Unity 6000.0.23f1) ·
UNITY-EDITMODE-TESTED ✅ (11/11) · UNITY-PLAYMODE-TESTED ✅ (3/3) · CROSS-ENGINE-PARITY ✅ (one semantic hash) ·
ANDROID-BUILT ❌ (not attempted; APK untouched) · DEVICE-VALIDATED ❌ (no headset).
Unity result XMLs: `media/story-adapters/unity-tests/`. Three.js media: `media/story-adapters/threejs/`.

### Remaining (device-blocked only)
Android build of the guided-story demo scene + on-device legibility/position validation on hardware.
Positions ship as `DEVICE VALIDATION PENDING`. Do NOT rebuild/overwrite the stable APK to do this.

---

Context was cleared mid-Step-4. This file is the resume point.

## Current position
- **Worktree:** `~/Desktop/AI-Projects/shadow-mentor-story-adapters` (isolated; `node_modules` is a symlink to the main tree).
- **Branch:** `feat/shadow-shared-story-adapters`
- **Commit (HEAD):** `ec5406f` — the `--no-ff` merge of `research/unity-threejs-spatial-ux-v2` into this branch (Commit-plan step 1 DONE). Pushed to origin.
- **Base:** branched from `feat/shadow-lens-explainers @ 19f52f0`, then merged spatial-ux-v2 → now has BOTH the 3 explainers AND `shadow-3d-scene-v1` + the Three.js prototype + spatial tokens.

## Completed so far (this Step 4)
- **Commit-plan step 1 — merge** (`ec5406f`): merged spatial-ux-v2. No conflicts. Verified 4/4 key files present (`lib/claim-evidence-graph.mjs`, `schemas/shadow-3d-scene-v1.schema.json`, `demos/animations/persona-deliberation.html`, `prototypes/shadow-3d-v2/index.html`).
- **Test results after merge:** Node suite **1869 tests · 1866 pass · 3 skip · 0 fail**. Pushed.

## Remaining task (Step 4 commit-plan steps 2–10 — NOT started)
Implement, don't just plan. In order:
2. **Semantic vocabulary + guided-story schema** — `lib/shadow-semantic-vocabulary.mjs`, `schemas/shadow-semantic-status-v1.schema.json`, `schemas/shadow-guided-story-v1.schema.json`, `docs/SHADOW_SEMANTIC_VOCABULARY.md`, `docs/SHADOW_GUIDED_STORY_CONTRACT.md`. Statuses: VERIFIED/FAILED/PRESENT/NOT_PRESENT/NOT_CHECKED/NOT_EVALUATED/WARNING/UNSUPPORTED/MALFORMED/ABSTAINED/REQUIRES_HUMAN_REVIEW/AFFECTED_DOWNSTREAM/FIRST_FAILURE. Trust dims: RECORD_INTEGRITY/DIGITAL_SIGNATURE/HASH_CHAIN/PROFILE/SOURCE_RESOLUTION/EXTERNAL_ANCHOR/CLAIM_EVIDENCE_BINDING/DICTIONARY_HASH/DICTIONARY_VERSION/PERSONA_OUTPUT_INTEGRITY/SYNTHESIS_PROVENANCE/ANALYTICAL_CORRECTNESS/POLICY_ADEQUACY/LEGAL_FAIRNESS_REVIEW/HUMAN_APPROVAL. **One vocabulary, imported by all adapters.** Forbidden mappings: VERIFIED→TRUSTED, VERIFIED→COMPLIANT, MAJORITY→CORRECT, COMPLIANCE_PERSONA→LEGAL_REVIEW_COMPLETE.
3. **Canonical guided-story fixtures** — `fixtures/guided-stories/{audit-chain,reason-code-attestation,persona-deliberation}.guided-story.json`. Contract `shadow-guided-story-v1` REFERENCES (not duplicates) `shadow-3d-scene-v1` + evidence bundles. **Reuse existing fixture content — no semantic drift** (same IDs/first-failure/downstream/statuses as `fixtures/animations/*.json` + `fixtures/shadow-3d/*.json` + `apps/shadow-lens/fixtures/*`). Step fields per §2 of the task prompt.
4. **Deterministic compiler** — `tools/compile-shadow-guided-story.mjs` with `--target html|threejs|unity|snapshot --validate-only --input --output`. Validate schema, reject dup IDs / bad refs / executable HTML / proto-pollution / unknown status; deterministic serialize; stable SHA-256 **semantic hash**; fail closed; NO live model.
5. **HTML adapter** — semantic convergence only (do NOT visually redesign; keep browser acceptance). Prove existing explainers' computed state == compiler snapshot via a parity test. Optional light adapter modules under `demos/animations/src/`.
6. **Three.js adapter** — `prototypes/shadow-3d-v2/src/{shadow-guided-story-three-adapter,shadow-guided-story-player,shadow-status-materials}.mjs` loading compiler snapshots; add all 3 stories; layouts arc/dag/timeline/hybrid (audit=timeline/arc, reason-code=hybrid, persona=radial/DAG). Shared tokens (`design/shadow-spatial-tokens.json`). Playwright browser acceptance + media → `media/story-adapters/threejs/` (see §13).
7. **Unity adapter** — `apps/shadow-lens/unity/Assets/ShadowLens/GuidedStory/*.cs` (Contract/Loader/State/Player/UnityAdapter/StatusMapper/Localization/Input) + `Editor/GuidedStory/{Importer,DemoSceneBuilder}.cs`. Native (no WebView/iframe). No XREAL SDK. Reuse existing panels/matrix/timeline/label-manager. Menu `Shadow Lens → Guided Story Demo` (3 stories; FIXTURE + DESKTOP MOCK / DEVICE VALIDATION PENDING labels).
8. **Unity tests** — EditMode (parse/reject/hash/locale/first-failure/persona invariants) + PlayMode (load 3 stories/step/restart/scenario/focus/2D-fallback/EN-zh/reduced-motion/recenter/hover≠select/select≠approve/reset). **Attempt batch mode:** `/Applications/Unity/Hub/Editor/6000.0.23f1/Unity.app/Contents/MacOS/Unity -batchmode -projectPath apps/shadow-lens/unity -runTests -testPlatform EditMode -testResults <xml> -logFile -`. If blocked → report `UNITY-ADAPTER-AUTHORED / EXECUTION-PENDING`, **do not fabricate results**.
9. **Cross-engine parity** — `test/shadow-guided-story-parity.test.mjs` + `fixtures/guided-stories/snapshots/{audit-chain,reason-code,persona}/`. HTML/Three.js/Unity compiler outputs must share the **same semantic hash** (layout/transforms may differ; meaning may not).
10. **Media + docs** — §13 media; docs `SHADOW_SHARED_STORY_ARCHITECTURE.md`, `SHADOW_GUIDED_STORY_CONTRACT.md`, `SHADOW_CROSS_ENGINE_PARITY.md`, `SHADOW_UNITY_GUIDED_STORY_ADAPTER.md`, `SHADOW_THREEJS_GUIDED_STORY_ADAPTER.md`; update `EXPLAINER_INTEGRATION_PLAN.md` / `SHADOW_3D_VISUALIZATION_CONTRACT.md` / `SHADOW_SELF_CONTAINED_ANIMATION_SYSTEM.md`.

## Exact next commands (resume)
```bash
cd ~/Desktop/AI-Projects/shadow-mentor-story-adapters
git status && git log -3 --oneline | cat
[ -e node_modules ] || ln -s ../shadow-mentor/node_modules node_modules   # if missing
npm test 2>&1 | grep -E "^ℹ (tests|pass|fail|skipped)"                     # baseline 1866 pass / 3 skip
# then implement steps 2→10 above, committing coherently; browser acceptance via a temp Playwright profile:
#   (serve repo root) python3 -m http.server 8906 --bind 127.0.0.1 &
#   playwright is installed in ~/…/scratchpad/pw/node_modules (chromium 149) — run capture scripts from there
git push origin feat/shadow-shared-story-adapters   # never merge
```
Playwright harness dir (has playwright + chromium 149): `/private/tmp/claude-501/-Users-alexji-Desktop-vibex/cfb502a3-1a5c-4f60-a390-d756b56a18f1/scratchpad/pw`.

## Safety constraints (unchanged, binding)
- Do **not** merge to main; do **not** publish npm; do **not** modify production secrets; do **not** production-sign.
- Do **not** delete/overwrite any stable APK or the frozen verifier package (`verify.html`, `verify-acceptance/wednesday-package/`).
- Do **not** import the XREAL SDK in this slice; keep Beam Pro input behind an interface; desktop-mock input only.
- Do **not** mark UNITY-COMPILED / UNITY-*-TESTED / UNITY-RECORDED / ANDROID-INSTALLED / BEAM-PRO-TESTED / DEVICE-VALIDATED unless real result/media files exist. Never use Three.js screenshots as Unity screenshots.
- Contract carries NO executable JS/HTML, no Unity/Three.js object names. Treat story JSON as untrusted (size/entity/relation/step/scenario/depth caps; dup-ID + proto-pollution + unknown-status rejection; text-safe rendering).
- Reply to Alex in Chinese.

## Frozen artifact hashes (must stay unchanged)
- **Stable APK** `apps/shadow-lens/demo/wednesday/frozen/mock-stable-5168b07.apk` (source commit 5168b07):
  `93f2a81aa5f965aec540526abe621b152c7507c03c0fea51d381094bd548d0b8`
- Frozen verifier `verify.html` (wednesday-package copy): `c478b46f42d0a9aea407a68a14178ffd638ba608b8972c806bd612c9f7d0d6bc`
- Fixture release-key fingerprint (NOT production): `727d29d3204231f7`
- (Full inventory: `verify-acceptance/WEDNESDAY_DEMO_INVENTORY.md`.)

## Other worktrees (do not disturb)
- `shadow-mentor` @ `5106799` [chore/wednesday-media-and-deep-research] — media + remaining-work research.
- `shadow-mentor-explainers` @ `19f52f0` [feat/shadow-lens-explainers] — 3 explainers + landing + guided + Verify companion.
- `shadow-mentor-spatial-ux-v2` @ `bb33196` [research/unity-threejs-spatial-ux-v2] — shadow-3d-scene-v1 + prototype (already merged here).
- `shadow-mentor-capstone` @ `dc4f25a` — unrelated.

## Honest status ladder (Step 4 so far)
SHARED-STORY-CONTRACT-AUTHORED ❌ · STORY-COMPILER-HOST-TESTED ❌ · HTML-ADAPTER-INTEGRATED ❌ ·
THREEJS-ADAPTER-INTEGRATED ❌ · THREEJS-BROWSER-RENDERED ❌ · UNITY-ADAPTER-AUTHORED ❌ · UNITY-COMPILED ❌ ·
UNITY-*-TESTED ❌ · ANDROID-BUILT ❌ · DEVICE-VALIDATED ❌. Only the **branch merge** (step 1) is done.
