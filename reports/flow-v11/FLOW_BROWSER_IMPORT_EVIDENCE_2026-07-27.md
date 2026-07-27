# Shadow → Flow Real Browser Import Evidence

**Date observed:** 2026-07-27
**Operator:** Alex Ji
**Flow environment:** `a.flow.gl` desktop browser (operator account)
**Repository branch:** `docs/shadow-flow-real-import-evidence`
**Baseline commit:** `e842aaced9ec4c50b4c7fa8756c169088688fb8a`

This document records what was actually observed in Flow. It does not invent screenshots, device photos, or exact connection counts that were not captured.

## Dataset uploaded

```text
reports/flow-v11/demo-package/shadow-flow-vendor-graph.csv
```

## Flow Data Preview

| Property | Observed value | Status |
|---|---|---|
| Rows | 25 | PASSED |
| Header columns accepted | 19 Shadow payload columns + `id` / `idList` | PASSED |

## Columns visible and accepted by Flow

The following columns were present in the uploaded CSV and accepted by Flow's importer:

- `id`
- `idList`
- `idListTypes`
- `label_en`
- `label_zh`
- `node_type`
- `status`
- `status_family`
- `presentation_group`
- `shadow_node_id`
- `evidence_ref`
- `council_role`
- `council_finding`
- `is_first_failure`
- `lineage_order`
- `is_affected_downstream`
- `human_review_status`
- `approval_status`
- `verification_status`

Status: **PASSED** — all 19 Shadow payload columns plus the graph keys were accepted.

## Network Graph configuration

| Setting | Value | Status |
|---|---|---|
| identifier column | `id` | PASSED |
| connections column | `idList` | PASSED |
| delimiter | `\|` (pipe) | PASSED |
| label column | `label_en` | PASSED |

## Rendered scene

| Observation | Status |
|---|---|
| Network Graph visualization created | PASSED |
| Shadow labels appeared on nodes | PASSED |
| Links appeared between nodes | PASSED |
| Present Flow mode opened in desktop browser | PASSED |
| Disclaimer remained visible | PASSED |

The exact number of rendered links was not manually counted. The authoritative edge count remains the typed edge list in `shadow-flow-presentation-edges.csv` (19 edges) and the collapsed adjacency pairs in the CSV validator (18 pairs).

## Visible rendered examples

The following labels/statuses were observed in the rendered scene:

- `HASH CHAIN: FAILED`
- `Human approval: NOT PRESENT`
- `REVIEW`
- `ANALYTICAL CORRECTNESS: NOT EVALUATED`
- `Risk Officer`
- `Customer Advocate`
- `Macro Contrarian`

These are all byte-copies of the Shadow fixture; Flow did not recompute any Shadow conclusion.

## Honest status register

| Claim | Value |
|---|---|
| `flow_csv_import_tested` | `true` |
| `flow_csv_import_passed` | `true` |
| `flow_rows_imported` | `25` |
| `flow_payload_columns_accepted` | `true` |
| `flow_network_graph_rendered` | `true` |
| `flow_idlist_connections_rendered` | `true` |
| `flow_browser_present_mode_validated` | `true` |
| `flow_save_reopen_validated` | `PENDING` |
| `flow_beam_pro_browser_validated` | `false` |
| `flow_xreal_display_validated` | `false` |
| `flow_xreal_interaction_validated` | `false` |
| `flow_xreal_label_readability_validated` | `false` |
| `device_validated` | `false` |
| `production_ready` | `false` |

## Boundary statement

This validation covers the **desktop browser import and presentation** of the Shadow fixture in Flow. It is independent of the native Shadow Lens MyGlasses handoff. No physical XR capability is claimed. All physical flags in `reports/device-validation-v11/v11-pre-device-state.json` remain `false`, and `CANDIDATE_05_BLOCKED` remains `true`.

## Operator evidence checklist

Attach the following artifacts when available:

- [ ] Data Preview screenshot showing `Rows: 25`
- [ ] Field-list screenshot showing the accepted columns
- [ ] Network Graph mapping screenshot (`id` + `idList`)
- [ ] Rendered graph screenshot
- [ ] Present Flow mode screenshot
- [ ] Save/reopen screenshot (future)
- [ ] Beam Pro / XREAL photo or video (future)

## Related documents

- `SHADOW_FLOW_IMPORT_RUNBOOK.md` — now contains the observed Stage 2 record
- `SHADOW_FLOW_SPIKE_FINAL.md` — updated with browser-import result
- `FLOW_BEAM_PRO_XREAL_CHECKLIST.md` — remaining device validation steps
