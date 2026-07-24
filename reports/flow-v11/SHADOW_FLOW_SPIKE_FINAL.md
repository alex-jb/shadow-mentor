# Shadow → Flow presentation spike — final report

**Result: `SHADOW_FLOW_PRESENTATION_READY_PENDING_VENDOR_IMPORT`**

A sanitized, deterministic, offline Flow demo package for one completed Shadow banking audit is
built, tested, and committed. No live Flow import was attempted (no credentials — by design). No
native Shadow Lens claim is made or implied. Native Lens (Terminal 1) and Web Audit Room
(Terminal 2) were not touched.

## 1 · Baseline

- Reference repo: `shadow-mentor` (story-adapters checkout untouched at `e14e264`)
- Spike worktree: `feat/shadow-flow-presentation-spike` based exactly on `84561eb`
  ("V11 offline exit gate — READY FOR DEVICE A/B")
- Protected artifacts unchanged (verified before + after):
  - `apps/shadow-lens/unity/Packages/manifest.json` — sha256 `3120f9bf…c4355`
  - `apps/shadow-lens/unity/Packages/packages-lock.json` — sha256 `26e2d12d…c6915`

## 2 · Existing Flow assets (full audit: `SHADOW_FLOW_EXISTING_ASSET_AUDIT.md`)

The repo already had a versioned export contract, an offline presenter boundary with a flag-gated
(inert) live path, a canonical banking narrative fixture, a bilingual audit-chain guided story with
first-failure/downstream semantics, a shared bilingual semantic vocabulary, design docs drawing the
Flow/Shadow responsibility boundary, and 9 passing Flow-boundary tests.

## 3 · Export contract

**`shadow-flow-export/1.0` confirmed sufficient — no new schema created.** The spike adds a
versioned presentation *extension* (`shadow-flow-presentation/1.0`: nodes/edges/groups/bilingual
labels) that references the 1.0 rows. (A second, older root exporter `lib/flow-export.js`
(`shadow-flow-export-v1.0`) serves the loan-council path; flagged as a consolidation candidate,
untouched.)

## 4 · Video review

`VIDEO_CONTENT_NOT_DIRECTLY_INSPECTED` — video playback is unavailable to this environment. Only
public metadata was retrieved (YouTube oEmbed): mejHs4MS7h8 = "Flow Demo: AI + AR Data in a Shared
Space on XREAL"; bjST6Hiuv3o = "Bitcoin MVRV Analysis in 30 Seconds — AI Builds a Full 3D
Walkthrough"; both by the Flow Immersive channel, matching Bill's descriptions. No hidden technical
behavior was inferred; the static adapter analysis proceeded independently, and vendor question 10
asks for the closest starter template instead of guessing.

## 5 · Presentation mapping

`SHADOW_TO_FLOW_PRESENTATION_MAPPING.md` + `shadow-flow-presentation-mapping.json` — 22 nodes /
19 edges preserving CASE → COUNCIL → FIRST FAILURE → EVIDENCE LINEAGE → DOWNSTREAM IMPACT → HUMAN
REVIEW → APPROVAL → VERIFICATION. First Failure is the only `center` node; review and approval are
distinct; verification (incl. ANALYTICAL CORRECTNESS: NOT EVALUATED) is a separate area; every
status is a byte-copy of the Shadow fixtures (tested) — Flow never recomputes Shadow conclusions.

## 6 · Demo package

`reports/flow-v11/demo-package/` — audit JSON + CSV (1.0 contract, 16 rows), node/edge CSVs, field
dictionary, plus manifest with provenance, verification summary, capability/disclaimer record.
Metadata: source commit `84561eb`, fixture `case-2026-Q3-0042`, EN+ZH, deterministic
`generated_at`, `network_used: false`, `physical_device_validated: false`, `FIXTURE MODEL`.

## 7–10 · Companion documents

- `SHADOW_FLOW_SCP_PROMPT.md` — short + expanded SCP prompt, input files, acceptance checklist
- `SHADOW_FLOW_DEMO_STORYBOARD.md` — 9 steps, 3–5 min, per-step narration/data/fallback
- `FLOW_SUPPORT_QUESTIONS_FOR_BILL_AND_JASON.md` — 10 unresolved technical questions (+1 optional)
- `SHADOW_PRESENTATION_ROUTE_MATRIX.md` — routes A–D compared; complementary, not exclusive

## 11 · Tests

- New: `test/shadow-flow-presentation-spike.test.js` — 12 deterministic non-network tests (schema,
  JSON/CSV parity, stable IDs, deterministic ordering, no dangling refs, first-failure/downstream
  validity, bilingual completeness, prohibited-field scan, physical/network flags false, no silent
  network push, committed-package parity).
- Full suite in the spike worktree: **2072 tests — 2069 pass / 0 fail / 3 skipped (pre-existing
  skips)**, including `bash scripts/beampro-device-test.selftest.sh` (34/34) and
  `node scripts/generate-tokens.mjs --check` (up to date).

## 12 · Privacy

Prohibited-pattern scan over all new artifacts: no usernames, absolute paths, IPs, serials,
credentials, tokens, pairing codes, or PII. The only regex hits are the scanner's own pattern list
and a descriptive sentence in this report set.

## 13–15 · Boundary verification

- Candidates 01–04, stable APK, frozen verifier, Unity `Packages/*` — untouched (hashes above;
  `git status` shows only the 4 new spike paths; `package-lock.json` churn from `npm install` was
  reverted, not committed).
- candidate-05 gate intact; no APK built; no ADB, no Beam Pro test, no Unity run.
- Main V11 worktree (`shadow-mentor-story-adapters`) still at `e14e264` with its pre-existing
  local state; Terminal 1 and Terminal 2 repositories unmodified.

## Next action (Bill / Jason)

Send `FLOW_SUPPORT_QUESTIONS_FOR_BILL_AND_JASON.md` with the demo package attached (or offer it).
The decisive unknowns are Q1–Q2 (ingestion path for the CSV/JSON + node/edge shape) and Q4–Q6
(supported launch route on Beam Pro + XREAL One Pro without a custom APK). A yes on those converts
this package to `SHADOW_FLOW_PRESENTATION_PACKAGE_READY` after one supervised import attempt with
official credentials — which is out of scope for this spike.
