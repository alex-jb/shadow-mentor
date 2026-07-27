# Shadow → Flow import runbook

**Status: NOT YET EXECUTED.** Every step below is a *prepared* procedure. No import has been
attempted, no Flow scene has rendered, and no XR device has displayed this dataset. Do not cite
this runbook as evidence that any of those happened.

**Vendor guidance** — Bill Morton, VP Customer Success, Flow Immersive, 2026-07-27:
a Flow can be prepared on Mac or PC; it opens through `a.flow.gl` on supported XR devices including
XREAL One Pro paired with Beam Pro; the normal entry path is
**browser → a.flow.gl → Flow Lister → select Flow**; collaborative Flow meetings can be joined from
web, phone or supported XR devices; existing Featured Flows may be copied and customized.

**SCP note.** SCP is in the final stages of production release. Nothing in this runbook depends on
it, and it must not be described as currently production-available.

---

## Stage 0 — Prepare (Mac or PC, offline)

Everything here is offline and requires no Flow account.

```sh
cd <repo>                       # this Flow worktree
node scripts/gen-flow-presentation-package.mjs --check   # confirm no drift
node scripts/validate-flow-vendor-csv.mjs                # expect VENDOR_CSV_VALID
node --test test/shadow-flow-vendor-csv.test.js          # expect 20/20 pass
```

The file to upload:

```
reports/flow-v11/demo-package/shadow-flow-vendor-graph.csv
```

Expected shape (all pinned by the validator):

| Property | Value |
|---|---|
| rows (one per node) | 25 + header |
| `id` | integers 1..25, ascending, no gaps |
| `idList` | pipe-delimited outgoing targets, 18 adjacency entries total |
| unconnected rows | 6 — **expected**, see `VENDOR_CSV_TRANSFORMATION.md` §5 |
| bilingual labels | present on all 25 rows |
| case-scope columns | `REQUIRES_HUMAN_REVIEW` / `NOT_PRESENT` / `FAILED` |

**Do not hand-edit the CSV.** It is generated and drift-gated; an edit will fail
`gen-flow-presentation-package.mjs --check` and the drift test.

## Stage 1 — Flow account and workspace (operator, manual)

1. Sign in to Flow on a Mac or PC browser.
2. Decide the starting point:
   - **new Flow from CSV** — the direct path for this dataset; or
   - **copy a Featured Flow and customize** — per vendor guidance, existing Featured Flows may be
     copied; useful if a graph/network Featured Flow already has a layout close to the intended
     spatial narrative (centre = first failure, ring = council, path = lineage).
3. Record which path was taken. If a Featured Flow was copied, record its name — the resulting
   scene is then partly vendor-authored, which matters for any later screenshot or claim.

## Stage 2 — Ingest the CSV (operator, manual)

1. Upload `shadow-flow-vendor-graph.csv` as the dataset.
2. Map the graph columns in Flow's importer:
   - node identifier → **`id`**
   - connections / edges → **`idList`** (pipe-delimited)
3. Suggested display bindings (all optional; Flow may auto-detect):
   - primary label → `label_en` (secondary/localized → `label_zh`)
   - colour → `status_family` (`pass` / `warn` / `fail` / `neutral` / `info` / `abstain`)
   - grouping / layout hint → `presentation_group`
   - emphasis → `is_first_failure`, then `is_affected_downstream`
   - path ordering → `lineage_order`
4. **Verify before believing:** confirm Flow reports **25 nodes**. If it reports fewer, the
   importer merged or dropped rows — stop and record the discrepancy rather than adjusting the CSV
   to please the importer.

## Stage 3 — Open on the XR device (operator, manual)

Per vendor guidance, the normal entry path:

```
browser  ->  a.flow.gl  ->  Flow Lister  ->  select the Shadow Flow
```

On XREAL One Pro paired with Beam Pro:

1. Open the browser on Beam Pro.
2. Navigate to `a.flow.gl`.
3. Sign in; the **Flow Lister** appears.
4. Select the Shadow Flow.
5. Confirm the glasses display the scene.

For a collaborative review, the same Flow can be joined from web, phone, or a supported XR device.

## Stage 4 — Record the outcome honestly

Whatever happens, write it down verbatim in `SHADOW_FLOW_SPIKE_FINAL.md`. In particular:

- If the import **succeeded**: record node/edge counts *as Flow reports them*, plus any column Flow
  ignored. Only then may `import_tested` move from `false` in
  `shadow-flow-vendor-graph-stats.json`.
- If the device **rendered** the scene: that is the first evidence of Flow-on-XR for Shadow. It is
  still **not** evidence of native Shadow Lens capability, and it earns **no** physical XR flag —
  every flag in `reports/device-validation-v11/v11-pre-device-state.json` stays `false`, and
  `CANDIDATE_05_BLOCKED` stays `true`.
- If the import **failed or partially loaded**: record the exact importer message. Do not reshape
  Shadow's findings, lineage, review state, approval state or provenance to make the import
  succeed. If a column must change, change the *transformer* and regenerate, so the change is
  reviewable and drift-gated.

## Reviewer talking points (what the scene shows — and does not)

- The **centre** node is the first failure (`banking-v1:n3:claim`); three rows carry
  `is_affected_downstream` — the tamper cascade.
- The **ring** is the five council voices. Two of them (`Fair Lending Compliance`,
  `Macro Contrarian`) are deliberately unconnected: in this case they reached a finding without
  citing an evidence item. That absence is the audit record, not a data gap.
- **Human review is required; approval is `NOT_PRESENT`.** Review is not approval. Nothing in the
  scene should be read as a granted approval.
- **`verification_status = FAILED`** refers to hash-chain integrity for the presented scenario.
  `ANALYTICAL_CORRECTNESS` remains `NOT_EVALUATED` on its own node: Shadow verified integrity, not
  whether the analysis was *right*.
- Flow **displays**; Shadow **decides**. Every value came from a Shadow fixture.

## Open vendor questions still unanswered

The unresolved items in `FLOW_SUPPORT_QUESTIONS_FOR_BILL_AND_JASON.md` that this runbook cannot
close on its own:

1. Whether Flow's importer accepts the 17 Shadow payload columns alongside `id` / `idList`, or
   requires a narrower set.
2. Whether `idList` is interpreted as directed or undirected.
3. Whether stable IDs survive a re-import, so an offline-verifier cross-check stays possible.
4. Whether XREAL One Pro on Beam Pro is a supported target for this scene specifically (vendor
   guidance names it as supported; unverified by us on that hardware).
