# Shadow → Flow vendor CSV — field mapping

Dataset: `reports/flow-v11/demo-package/shadow-flow-vendor-graph.csv`
Contract: `shadow-flow-vendor-csv/1.0` (`apps/shadow-lens/flow/flow-vendor-csv.mjs`)
Projection of: `shadow-flow-presentation/1.0` → which itself composes the Shadow fixtures.

**Vendor guidance applied** — Bill Morton, VP Customer Success, Flow Immersive, 2026-07-27:
Flow currently ingests CSV directly; a graph dataset should be **one row per node**; every node
needs a **unique ID**; edges live in a column such as **`idList`** holding **pipe-delimited**
connected node IDs (example `2|3|10`).

**Authority boundary.** Shadow is the analysis and evidence authority. Flow is the spatial
visualization layer. Every value below is *copied* from a Shadow fixture through the presentation
mapping — nothing in this dataset is recomputed, re-scored, or re-decided by the exporter, and a
test pins each status against its Shadow source node.

## Column reference

| # | Column | Origin | Meaning | Notes |
|---|---|---|---|---|
| 1 | `id` | assigned | **Vendor-required** stable unique node ID | 1-based integer in deterministic mapping order. Not a Shadow identity — see `shadow_node_id`. |
| 2 | `idList` | derived from `mapping.edges` | **Vendor-required** pipe-delimited connected node IDs | **Outgoing** targets of this row, ascending, deduplicated. |
| 3 | `idListTypes` | `edge.type` | Shadow extension: relation type per `idList` entry | Positionally aligned with `idList`; `+`-joined when one target is reached by several relations. |
| 4 | `label_en` | `node.label_en` | English display label | Required on every row. |
| 5 | `label_zh` | `node.label_zh` | Chinese display label | Required on every row. |
| 6 | `node_type` | `node.type` | Node kind | `case`, `evidence_item`, `council_voice`, `source`, `snapshot`, `evidence`, `claim`, `recommendation`, `signature`, `audit_record`, `human_review`, `human_approval`, `verification`, `attestation`, `capability_disclaimer`. |
| 7 | `status` | `node.status` | **This node's own** Shadow status | The only per-node judgement in the dataset. |
| 8 | `status_family` | `node.status_family` | Severity family for colour mapping | `pass` / `warn` / `fail` / `neutral` / `info` / `abstain`. |
| 9 | `presentation_group` | `node.group` | Spatial grouping hint | `center`, `left-case`, `ring-council`, `right-downstream`, `path-lineage`, `verification-area`. |
| 10 | `shadow_node_id` | `node.id` | **Provenance** — the authoritative Shadow node identifier | Unique; a renumbering of `id` can never detach a row from its evidence. |
| 11 | `evidence_ref` | `node.source_ref` | **Provenance** — fixture/source path this row was copied from | e.g. `fixtures/guided-stories/audit-chain.guided-story.json#banking-v1:n3:claim`. |
| 12 | `council_role` | `node.label_en` (council rows) | Council voice name | Empty on non-council rows. |
| 13 | `council_finding` | `node.label_en` (council rows) | That voice's stance + confidence | Empty on non-council rows. |
| 14 | `is_first_failure` | `node.refs.is_first_failure` | First-failure marker | Exactly one row is `true`. |
| 15 | `lineage_order` | `node.sequence` | Evidence-lineage position | `0..6` on the 7 lineage nodes; empty elsewhere. |
| 16 | `is_affected_downstream` | `node.refs.is_affected_downstream` | Downstream-consequence marker | 3 rows are `true`. Never `true` on the same row as `is_first_failure`. |
| 17 | `human_review_status` | `presentation:human-review`.status | **Case-scope** human-review state | See "Case-scope columns" below. |
| 18 | `approval_status` | `presentation:approval`.status | **Case-scope** approval state | `NOT_PRESENT` — an approval was **not** granted in this fixture. |
| 19 | `verification_status` | `presentation:verify-hash-chain`.status | **Case-scope** verification verdict | Hash-chain dimension for the presented scenario. |

## Case-scope columns (17–19)

`human_review_status`, `approval_status` and `verification_status` describe the **case**, not the
individual node. They are repeated identically on every row so a Flow scene can colour or filter
the whole graph by audit state without joining a second dataset.

They are deliberately **not** per-node judgements. Shadow never recorded a per-node review or
approval; synthesizing one to make the visualization richer would be a fabricated finding. The
validator enforces this: if any of the three columns ever holds more than one distinct value, the
`case_scope` check fails.

Current fixture values (presented scenario `tamper_seq_3`):

- `human_review_status = REQUIRES_HUMAN_REVIEW`
- `approval_status = NOT_PRESENT` — **review is not approval**; no human approved this case
- `verification_status = FAILED` — the hash chain failed at the first-failure node

`ANALYTICAL_CORRECTNESS` is **not** folded into `verification_status`. It stays `NOT_EVALUATED` on
its own row (`presentation:verify-analytical`), because Shadow evaluated integrity, not analytical
correctness, and merging the two would overstate what verification proves.

## What this dataset does NOT contain

- No credentials, tokens, API keys, absolute paths, usernames, serials or PII (scanned by test).
- No wall-clock timestamp — `generated_at` is the fixture timestamp `2026-07-22T00:00:00.000Z`.
- No claim of a successful Flow import, of any rendered scene, or of any XR device validation.
- No SCP availability claim — SCP is in the final stages of production release and is **not**
  described here as currently production-available.

## Companion files

| File | Role |
|---|---|
| `demo-package/shadow-flow-vendor-graph.csv` | the import-ready dataset described here |
| `shadow-flow-vendor-graph-stats.json` | counts + contract metadata, machine-readable |
| `demo-package/shadow-flow-presentation-edges.csv` | **authoritative** directed + typed edge list (19 rows, un-collapsed) |
| `demo-package/shadow-flow-presentation-nodes.csv` | the pre-vendor node table (string IDs) |
| `demo-package/shadow-flow-demo-export.csv` | the `shadow-flow-export/1.0` row contract, unchanged |
| `VENDOR_CSV_TRANSFORMATION.md` | node/edge transformation rules + collapse accounting |
| `SHADOW_FLOW_IMPORT_RUNBOOK.md` | the manual Mac/PC → a.flow.gl → Flow Lister → XR path |
