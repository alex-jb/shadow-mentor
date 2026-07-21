# Shadow — remaining-work deep research (2026-07-21)

Source-cited audit of what remains, with the **actual repository** as implementation truth and
**official/primary sources** for external facts. Accessed date for all external URLs: **2026-07-21**.
Prefer primary sources over blogs. Nothing here claims device validation.

## D1 · Repository truth audit (status ladder)

| Capability | Status | Evidence |
|---|---|---|
| Evidence verifier (canonicalize + hash-chain + Ed25519) | **HOST-TESTED + BROWSER-RENDERED** | `verify/verify-bundle.mjs` + `verify.html`; Chromium-149 acceptance |
| Signed release manifest self-trust | **HOST-TESTED + BROWSER-RENDERED (FIXTURE-SIGNED)** | `verify/verify-manifest.mjs`; ASSETS MATCH / ASSET MISMATCH validated |
| Claim–Evidence Graph (CEG v1.0) | **HOST-TESTED** | `lib/claim-evidence-graph.mjs`; deterministic `exportGraph`, missing-evidence failure |
| Ingested-output audit (third-party) | **HOST-TESTED** | `lib/audit-ingested.mjs`; 5-status matrix |
| Deterministic 5-voice council | **HOST-TESTED** | `lib/run-loan-council.js` (rules, not LLM) |
| Ed25519 attestation + hash-chain | **HOST-TESTED** | `lib/attestation*.js` |
| MCP server (11 tools) | **HOST-TESTED** | `mcp/server.js` |
| Unity guided stage + 3D audit arc + council labels + head-directed focus | **UNITY-AUTHORED / DEVICE-VALIDATION-PENDING** | `apps/shadow-lens/unity/…/Narrative/*`, `Spatial/ShadowHeadDirectedFocus.cs`; Node static contracts pass, Unity PlayMode authored-not-run-here |
| XR legibility profiles + perf baseline | **UNITY-AUTHORED** (perf = NOT_BEAM_PRO) | `Spatial/ShadowLegibilityProfiles.cs`, `ShadowPerfBaseline.cs` |
| **Three.js spatial replay** | **THREEJS-RENDERED (browser), actively present** | `demos/replay/3d/` (scene/webxr/labels/beats/voice/gamepad/stereo + study/) + `demos/spatial-replay/index.html` (three@0.160.0, WebGLRenderer, OrbitControls) |
| Android APK | **ANDROID-BUILT (desktop mock)** | frozen `mock-stable-5168b07.apk` sha `93f2a81a…`, commit 5168b07 |
| Conformal / abstain | **NOT IMPLEMENTED** (manifest labels it research-pilot) | grep: no `conformal` in `lib/` |
| Production signing | **NOT IMPLEMENTED** | FIXTURE key only |

**Contradiction found (flag, not fixed during research):** `product-facts.json` → `regulatory_references.scope_honesty`
and brain memory state that **SR 26-2 scopes GenAI/agentic AI out (a "Tier 3 exemption")**. The competitive-research
agent fetched the official SR 26-2 letter (federalreserve.gov/supervisionreg/srletters/SR2602.htm, 2026-04-17,
supersedes SR 11-7 + SR 21-8) and **found no GenAI/agentic exemption or three-tier framing in the text**. → The
"SR 26-2 Tier 3 companion" positioning lacks primary-source support. **Recommended action: soften that copy to a
verifiable statement, or locate the real Tier source before reuse.** Not a Wednesday-demo blocker (the demo is the
verifier), so per instruction not modified during this research pass.

## D2 · Wednesday device path (XREAL Beam Pro) — official

SDK baseline **XREAL SDK 3.1.0**. All URLs accessed 2026-07-21.
- Beam Pro uses built-in **MyGlasses** as server; **ControlGlasses not needed** (that's for phone hosts). [docs.xreal.com/Tools/ControlGlasses]
- Deploy: connect Beam Pro to PC → `adb install` (USB or wireless adb) → disconnect → plug glasses into Beam Pro → open MyGlasses, launch app → **grant "Allow to display over other apps"** (hard prerequisite). [docs.xreal.com/Getting Started with XREAL SDK]
- adb is enabled by default on Beam Pro; only Developer options + USB debugging needed (standard Android: Settings→About→tap Build number 7×). [developer.android.com/tools/adb, /studio/debug/dev-options]
- Wireless adb **strongly recommended** (glasses occupy the USB-C port): Android 11+ `adb pair` then `adb connect`. [docs.xreal.com/Getting Started; developer.android.com/tools/adb]
- Logs: SDK `Enable Auto Logcat` → `Android/data/<pkg>/cache/auto_log/…`, plus `adb logcat`. Uninstall/rollback: `adb uninstall [-k]`.
- **Unverified (not in official Getting Started body):** the "tap glasses icon 10× to enter a debug page" step, and the minimum MyGlasses/firmware version number — confirm on-device, do not cite as official.

### Minute-by-minute first-device plan (hard stop conditions)
| T | action | stop condition → fallback |
|---|---|---|
| T+00 | Beam Pro on, WiFi, MyGlasses home | can't boot/connect → swap unit; today use Editor demo |
| T+05 | Developer mode + USB debugging; `adb devices -l` sees it | 5 min no device → try wireless adb once, else stop |
| T+10 | `adb install` the **known-stable** old shadow-lens APK | install error → uninstall+retry once, else stop |
| T+15 | plug glasses, launch stable app from MyGlasses, grant overlay, see image | no image → check overlay permission first; 10 min → fallback to Editor demo |
| T+25 | `adb install` the XREAL **candidate** build | fails → demo with the T+15 stable build |
| T+35 | 6DoF: **confirm Eye is attached first**; with Eye → walk test; no Eye → 3DoF rotation only | expecting 6DoF without Eye = misconfig → downgrade to 3DoF frozen-plane, don't debug |
| T+45 | Eye/RGB: verify 6DoF stability only; **do not test app-layer frame access** (undocumented) | frame-access attempt fails = expected, mark as known limit |
| T+60 | OCR/voice: OCR via **Beam Pro camera or preset image** (not Eye frames); lock demo script | **T+60 hard stop — no more APK changes**, lock the highest stable state |

## D3 · XREAL capability truth (official Compatibility matrix)
[docs.xreal.com/XREALDevices/Compatibility, 2026-07-21] — **XREAL One series**: Head Tracking = **6DoF (with Eye)**;
Plane Tracking = **No**; Image Tracking = **No**; Hand Tracking = **No**; Depth Mesh = **No**; Spatial Anchor = **No**;
Controller = **3DoF**. Only **Air 2 Ultra** has plane/image/hand/depth/anchor. **Critical correction:** the SDK
`Support Devices` classifies One Series as **VISION (3DoF)**, not REALITY (6DoF) — **One/One Pro is native 3DoF; 6DoF
requires the XREAL Eye RGB accessory.** App-layer RGB frame access is documented only for the old XREAL Light (NRSDK
2.4.1 `NRRGBCamTexture`); **One+Eye frame access to third-party apps is not documented** — do not build OCR on it.

**→ Correct spatial model (confirmed by official docs, not a guess):** session-relative workspace + recenter + reset
+ head-directed focus + Beam Pro 3DoF click. **NOT** plane detection, persistent room anchoring, hand gestures, or
eye-gaze approval. This validates the existing `ShadowAuditChainData` frozen-plane / session-relative design.

### Overclaim scan (fix in copy/comments, tracked in CSV)
1. Any "One Pro 6DoF" without the Eye caveat → write "native 3DoF; 6DoF with XREAL Eye".
2. Any plane/desk detection, spatial anchors, persistent placement, hand-gesture, depth/occlusion, or eye-tracking
   language → not supported on One; remove or reframe as session-relative.
3. Any "camera frame OCR from the glasses" → undocumented; reframe to Beam Pro camera / preset image.

## D4 · Native implementation gap (critical path)
`XREAL SDK import → loader config (VISION/3DoF default, REALITY only with Eye) → candidate APK → [Eye]6DoF placement
→ session-relative stability → OCR via Beam Pro camera (NOT Eye frames) → source-map alignment → real sealed bundle →
native voice/TTS → perf/thermal logging`. Dependencies: SDK 3.1 tarball ([developer.xreal.com/download]); Unity LTS
2021.3/2022.3/6000.0, Android API 31+ (min API 29+), IL2CPP + ARM64, OpenGL ES3, Portrait ([docs.xreal.com/Getting
Started]). **App-layer Eye RGB frames are NOT a dependency you can rely on** — route capture through the Beam Pro
camera or preset images.

## D5 · Product-quality thresholds (targets, not measurements)
Device baseline: One Pro FOV **57° diagonal (≈±25° H / ±14° V)**, single-eye 1920×1080, **PPD ≈38** (official PPD
not published; computed), peak ≈700 nit, electrochromic dimming Clear/Shade/Theatre, native anchoring ≈3 ms. Beam Pro
Snapdragon 6 Gen 1 / Adreno 710, spatial UI 90 Hz.

| metric | target | source |
|---|---|---|
| body text x-height | **≥ 0.2° (ideal 0.25–0.3°)** ≈ 8–12 px @38 PPD | arXiv 2604.27203 (Read-AR); ryanhinojosa.com DMM |
| interactive target angular size | **≥ 1.5° (ideal 2–3°)** | Read-AR; DMM 64×64 |
| text-on-plate contrast (additive) | **≥ 5:1**, always use a dark scrim | Read-AR; par.nsf.gov/10344322 |
| placement distance (long-dwell) | **0.75–3.5 m**; primary panel ≈2 m | Oculus BP compilation |
| head comfort | horizontal **±30°** (max ≈55°), vertical **+15°/−20°** | USPTO 10712900 comfort compilation |
| **safe zone = comfort zone (One Pro-specific)** | content in central **±20° H / ±12° V** | derived from 57° FOV + Meta rendering BP |
| motion-to-photon | **< 20 ms** | vrarwiki.com; biorxiv 2022.06.24.497509 |
| Beam Pro frame budget | **≥ 72 fps (ideal 90)**, ≤ 11–13 ms | Adreno 710 90 Hz; thermal thresholds **not published — self-test** |
| capture-to-answer / reset | first feedback < 100 ms, answer < 1–2 s, soft reset < 3 s | **no official — self-test** (Nielsen 0.1/1/10 s) |

## D6 · Evidence/production trust gap (demo vs production)
Demo needs only: **local Ed25519 signing + verifier + fingerprint** (already have). Production critical path:
**KMS/HSM-managed signing** (cosign/KMS; keys off laptop) → **manual signing-key rotation** (⚠️ Cloud KMS does **not**
auto-rotate asymmetric keys; NIST SP 800-57) → **SBOM** (NTIA minimum elements; CycloneDX/SPDX) → **PII redaction +
TTL delete** (NIST SP 800-122) → reproducible build (reproducible-builds.org, strengthens verifier self-trust) →
in-toto DSSE envelope for audit export. **Integrate, don't build:** Sigstore/cosign+Rekor (already integrated in
`packages/attest-core/anchors.js`), in-toto/SLSA, C2PA manifest shape, OpenLineage input.

## D7 · Live-model gap
Fixture is the **default for stage reliability**. A single sanitized live smoke run (Anthropic) is worth having to
prove the adapter, but live LLM adds no value to the deterministic Wednesday demo and introduces rate-limit / outage
risk. **Recommendation: keep FIXTURE MODEL for Wednesday**; label any live run FIXTURE vs LIVE explicitly.

## D8 · Three-profile differentiation
Banking / Data Science / Coding workspaces exist (`ShadowArtifactWorkspace`, `ShadowDataScienceWorkspace`,
`ShadowCodingWorkspace`) and are tested for **content isolation** (no LOAN APPLICATION in Data Science, etc.). But the
examples are **synthetic fixtures**. Real differentiation needs domain artifacts: Banking = real loan doc + AA codes;
Data Science = dataset lineage + model/metric + reproducibility; Coding = issue → tool calls → diff → test → commit.
Same verification + interaction + trust grammar across all three (keep); real datasets replace fixtures (P3).

## D9 · Research/academic path (see the XR-threshold agent's 8 structured ideas)
Highest-novelty + best fit to Shadow's existing assets: **spatial forensic replay of agent trajectories** (D9-1),
**attestation-bound provenance visualization** (D9-6), **multilingual verification semantics** (D9-8). The *foundation*
experiment is **spatial-vs-flat verification comprehension** (D9-2) — a crowded 3D-vs-2D space (Kraus 2022 CGF; J.Vis
2024 shows 3D can *reduce* accuracy), so any claim must be locked to the audit/verification task family or it won't
pass review. Trust-calibration (D9-4) and abstention UX (D9-7) are the most crowded lanes. **No implementation
started.**

## D10 · Competitive / moat (documented capabilities only)
**Commoditized (stop building):** OTel agent tracing (LangSmith/Phoenix/Langfuse/Braintrust), compliance-framework
mapping (Credo/Holistic/IBM/Microsoft), RBAC+event audit logs, runtime interception/kill-switch, **Ed25519 agent
identity signing (Microsoft Agent Governance Toolkit, MIT, 2026-04-02)**, signed-artifact+offline-verify standards
(cosign/in-toto/SLSA), media provenance (C2PA). **Differentiated (deepen):** a **signed, offline-verifiable,
agent-decision claim→evidence provenance graph** — no shipping product, only academic (arXiv 2606.04990); Shadow's
`claim-evidence-graph.mjs` is that category as signable code. **Banking loan-decision semantics × cryptographic
attestation** — Monitaur did insurance, banking is open. **Independent third-party agent audit as a tool** (not
consulting) — FactMR names ~37% share / 44% CAGR; currently KPMG/Schneider-Downs do *process* audits. **Integrate not
build:** Sigstore/Rekor+TSA, in-toto/SLSA, C2PA, OpenLineage. **Honest caveat:** market signal says auditors want
*reconstruction*, not *3D* — 3D's utility over flat replay is unproven; keep 3D as a demo/research layer, not the
production core selling point.

## D11 · Prioritized queues
**BEFORE WEDNESDAY (demo-critical only):** browser demo videos + screenshots (this branch) · Wednesday runbook +
frozen inventory (done) · zero-risk copy fixes for the overclaim scan (D3) *in presentation copy only*.
**FIRST 7 DAYS (device/native blockers):** stable APK on Beam Pro · recenter/reset · Beam Pro 3DoF input · text
readability pass on One Pro · 60/90 fps + XREAL Render Metrics · drift/judder check · true 6DoF **only with Eye** ·
Eye-attached 6DoF stability (not frame access).
**NEXT 30 DAYS (product quality + real data):** shared **Shadow 3D Visualization Contract** (Unity + Three.js render
the same deterministic scene) · interaction state machine (IDLE→…→CONFIRMED, hover≠select≠approve) · Audit Arc V2
(focus+context, timeline, DAG fallback ≥20 nodes, 2D table fallback) · label manager (billboard, min angular size,
P0–P3 priority, bilingual) · Unity↔Three.js parity tests · real-dataset profiles · KMS signing + rotation + SBOM +
PII/TTL.
**RESEARCH / LATER:** spatial-forensic-replay study · trust calibration · abstention UX · production signing +
persistence · reproducible build.

## Unity ↔ Three.js responsibility (foundation for the separate v2 task)
Three.js is **already present and active** (`demos/replay/3d/`, `demos/spatial-replay/`), so the split is real, not
hypothetical: **Unity** = Beam Pro/XREAL native, 6DoF, device input, OCR/voice, device perf. **Three.js** =
browser-shareable audit replay, desktop exploration, no-install audit entry, teaching/presentation. **Shared** = one
evidence bundle, CEG node IDs/sequence/status/color/layout semantics — do not write business logic twice. The full
**Shadow 3D Visualization Contract + prototype + parity tests** is a dedicated follow-up (branch
`research/unity-threejs-spatial-ux-v2`), scoped but **not built in this pass**; this document is its evidence base.

## Honest status ladder
REPOSITORY-AUDITED ✅ · UNITY-AUTHORED ✅ · UNITY-PLAYMODE-TESTED ❌ (authored, not run on host) · THREEJS-RENDERED ✅
(pre-existing demos) · DESKTOP-PROFILED ⚠️ (Node/editor only) · ANDROID-PROFILED ❌ · BEAM-PRO-PROFILED ❌ ·
DEVICE-VALIDATED ❌ · USER-STUDIED ❌ · RESEARCH COMPLETE ✅ (this document).
