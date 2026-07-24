# Shadow → Flow existing-asset audit (presentation spike)

Baseline: `84561eb` (`chore/shadow-v11-pre-device-gate` — "V11 offline exit gate — READY FOR DEVICE A/B").
Branch: `feat/shadow-flow-presentation-spike`. This spike is presentation-adapter analysis only; no
Lens worktree, APK, manifest, or MyGlasses code was touched.

## Verdict up front

**The existing versioned contract `shadow-flow-export/1.0` is sufficient. No new row schema was
created.** The spike adds one presentation *extension* (`shadow-flow-presentation/1.0`, node/edge +
bilingual + spatial-group layer) that references — never replaces — the 1.0 row contract.

## Inventory

| Path | Purpose | Kind | Source-of-truth status | Live-Flow assumption | Safe to reuse |
|---|---|---|---|---|---|
| `apps/shadow-lens/flow/flow-export-contract.mjs` | **`shadow-flow-export/1.0`** — versioned narrative → flat row table (JSON + CSV), closed 20-column set | production code | ✅ canonical row contract | none (offline) | ✅ reused as-is |
| `apps/shadow-lens/flow/flow-presenter.mjs` | `IFlowPresenter` boundary: `OfflineMockFlowPresenter` (no network, no creds) + `WebOrApiFlowPresenter` (feature-flagged, off by default) + `resolveFlowPresenter` | production code | ✅ canonical presenter boundary | live path exists but is flag-gated and inert | ✅ reused as-is |
| `apps/shadow-lens/flow/export-session.mjs` | Derives 3 Flow scenes (audit/risk/council) from ONE real signed ShadowLensSession; rows tagged `real_or_fixture` | production code | canonical for *session*-driven exports | none (CSV path; Push API noted as gated) | ✅ (not needed for this fixture-driven spike) |
| `apps/shadow-lens/fixtures/banking-narrative.mjs` | Canonical deterministic banking case `case-2026-Q3-0042` (CASE #SL-2026-014): 5 voices, metrics, evidence, relationships, REVIEW decision, `FIXTURE MODEL` label | fixture | ✅ canonical demo narrative | none | ✅ reused as-is |
| `fixtures/guided-stories/audit-chain.guided-story.json` | 7-node evidence lineage + `pristine` / `tamper_seq_3` scenarios with `first_failure` + `affected_downstream`, bilingual | fixture | ✅ canonical lineage story | none | ✅ reused as-is |
| `lib/shadow-semantic-vocabulary.mjs` | ONE shared vocabulary: bilingual statuses + severity families + trust dimensions + FORBIDDEN_MAPPINGS | production code | ✅ canonical vocabulary | none | ✅ reused as-is |
| `apps/shadow-lens/docs/FLOW_INTEGRATION_CONTRACT.md` | Written contract for `shadow-flow-export/1.0` + offline behavior + security + failure behavior | documentation | ✅ authoritative doc for 1.0 | documents the flag-gated live path | ✅ |
| `design/SHADOW_FLOW_PRESENTATION_ADAPTER.md` | Future-adapter design; "DESIGN ONLY · NO FLOW INTEGRATION CLAIMED"; snapshot → adapter → Trust Capsule chain; non-negotiable rules | design doc | authoritative design intent | explicitly none | ✅ (rules honored by this spike) |
| `design/FLOW_SHADOW_RESPONSIBILITY_BOUNDARY.md` | Presentation vs evidence responsibility split + five invariants + canonical-story ownership | design doc | ✅ authoritative boundary | none | ✅ (spike conforms) |
| `docs/shadow-flow-runbook.md` | Honest runbook: 3 importable CSVs, One Pro support UNCONFIRMED, Push Dataset API gated, tamper-beat open question | documentation | authoritative operational status | documents open vendor questions | ✅ |
| `demos/spatial-finance/flow-adapter.mjs` + `flow-{audit,council,portfolio}.csv` | 10-min governance demo adapter; 1 REAL signed audit-chain CSV + 2 demonstration fixtures | demo + committed CSVs | demo-scoped (not the canonical contract) | none (CSV import path) | ✅ as precedent; not modified |
| `docs/flow-demos/` (A–D suite) | 4 stakeholder demos (Brier / lattice / hash-chain / citation graph); A shipped, B–D scaffolds | documentation | demo-suite plan | assumes a.flow.gl account exists (Alex registered 2026-07-06) | ✅ as context |
| `lib/flow-export.js` (+ `test/flow-export.test.js`) | Older root exporter `shadow-flow-export-v1.0` from `runLoanCouncil()` (voices/thresholds CSVs), Jason-call era | production code (parallel lineage) | ⚠️ *second* exporter with a similar version string — predates the Lens contract; kept for the 7/31 loan-council path | none | left untouched (noted as consolidation candidate, out of spike scope) |
| `apps/shadow-lens/unity/Assets/ShadowLens/Flow/ShadowFlowPresenter.cs` | Unity mirror of `IFlowPresenter` | production (Unity) | mirrors mjs boundary | none | not touched (Lens boundary) |
| `lib/spatial-render.js` / `api/spatial-render.js` | Engine-neutral scene endpoint (design docs point at it as future adapter seam) | production code | canonical for 3D scene JSON | none | not needed for this spike |
| `reports/spatial-ux-v11/FLOW_INSPIRED_INCREMENT_BASELINE.md` | V11 UX baseline referencing Flow-inspired increments | report | historical | none | ✅ as context |

Existing tests already covering the Flow boundary (all green at baseline, rerun in this spike):
`test/shadow-flow-export.test.js` (9 tests: versioning, determinism, honesty labels, closed CSV
header, no-secrets, offline presenter, flag-gated live path, no-credentials operation) and
`test/flow-export.test.js` (root exporter). This spike adds
`test/shadow-flow-presentation-spike.test.js` (12 tests) on top.

## Notes

- **Two export lineages exist** (`apps/shadow-lens/flow/` vs root `lib/flow-export.js`). They serve
  different callers (Lens narrative vs `runLoanCouncil()`), don't conflict at runtime, but the
  near-identical version strings (`shadow-flow-export/1.0` vs `shadow-flow-export-v1.0`) invite
  confusion. Flagged for a future consolidation decision — NOT changed here (hard boundary: no
  second conflicting audit schema; also no modification of existing production files).
- The approved committed-CSV precedent is `demos/spatial-finance/*.csv`. That directory belongs to a
  different, self-contained demo, so this spike's sanitized package lives under
  `reports/flow-v11/demo-package/` (its own report tree) rather than polluting the older demo.
- No file found assumes live Flow access without a feature flag; no Flow credentials exist anywhere
  in the repo (verified by privacy scan).
