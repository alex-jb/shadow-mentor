# Shadow → Flow presentation spike — final report

**Result: `SHADOW_FLOW_PRESENTATION_BROWSER_IMPORT_VALIDATED`**

A sanitized, deterministic, offline Flow demo package for one completed Shadow banking audit is
built, tested, and committed. On 2026-07-27 the operator imported the vendor CSV into Flow on a
desktop browser at `a.flow.gl`: 25 rows accepted, Network Graph rendered, links and labels
visible, Present Flow mode opened. No XR device validation has been performed. No native Shadow
Lens claim is made or implied. Native Lens (Terminal 1) and Web Audit Room (Terminal 2) were not
touched.

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

## 12 · Real browser import validation (2026-07-27)

Operator-observed evidence is recorded in `FLOW_BROWSER_IMPORT_EVIDENCE_2026-07-27.md` and the
runbook status is updated in `SHADOW_FLOW_IMPORT_RUNBOOK.md`.

- CSV upload: `reports/flow-v11/demo-package/shadow-flow-vendor-graph.csv`
- Flow Data Preview: **25 rows**
- Accepted columns: 19 Shadow payload columns + `id` / `idList`
- Network Graph: created with `id` identifier and pipe-delimited `idList` connections
- Rendered scene: Shadow labels visible, links between nodes visible
- Present Flow mode: opened successfully in desktop browser
- Disclaimer: remained visible

Honest status register:

- `flow_csv_import_tested`: `true`
- `flow_csv_import_passed`: `true`
- `flow_rows_imported`: `25`
- `flow_network_graph_rendered`: `true`
- `flow_browser_present_mode_validated`: `true`
- `flow_save_reopen_validated`: `pending`
- `flow_beam_pro_browser_validated`: `false`
- `flow_xreal_display_validated`: `false`
- `device_validated`: `false`
- `production_ready`: `false`

No physical XR flag was promoted. `CANDIDATE_05_BLOCKED` remains `true`.

## Next action (Bill / Jason)

The CSV ingestion-path questions (Q1–Q2) are now closed for the desktop browser case. The remaining
open items are save/reopen persistence and the Beam Pro + XREAL One Pro device path (Q4–Q6). See
`FLOW_BEAM_PRO_XREAL_CHECKLIST.md` for the exact device checks. Continue to treat SCP as not
production-available.
