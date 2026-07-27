# Shadow → Flow demo package (sanitized, operator-local)

Location: `reports/flow-v11/demo-package/` + the two machine-readable files at `reports/flow-v11/`.
No repository-wide "approved Flow-export output directory" exists; the closest precedent is
`demos/spatial-finance/*.csv` (committed CSVs belonging to a self-contained older demo), so this
package lives in the spike's own report tree rather than mutating that demo. Documented here to
honor the "inspect conventions before creating a directory" rule.

## Contents

| File | Purpose |
|---|---|
| **`demo-package/shadow-flow-vendor-graph.csv`** | **Vendor-compatible graph dataset — one row per node, unique integer `id`, pipe-delimited `idList` (25 rows, 18 adjacency entries). This is the file to import.** |
| **`shadow-flow-vendor-graph-stats.json`** | **Vendor CSV counts + contract metadata (`import_tested: false`, `device_validated: false`)** |
| **`VENDOR_CSV_FIELD_MAPPING.md`** | **Column-by-column field mapping for the vendor CSV** |
| **`VENDOR_CSV_TRANSFORMATION.md`** | **Node/edge transformation rules, multi-edge collapse accounting, isolated-node rationale** |
| **`SHADOW_FLOW_IMPORT_RUNBOOK.md`** | **Mac/PC preparation → a.flow.gl → Flow Lister → supported XR browser (not yet executed)** |
| `demo-package/shadow-flow-demo-export.json` | Canonical audit JSON export (`shadow-flow-export/1.0`, 16 rows) |
| `demo-package/shadow-flow-demo-export.csv` | Corresponding CSV (closed 20-column header) |
| `demo-package/shadow-flow-presentation-nodes.csv` | Node table, string IDs (25 nodes: case, 3 evidence, 5 council, 7 lineage, decision/review/approval, 4 verification, attestation, device boundary) |
| `demo-package/shadow-flow-presentation-edges.csv` | **Authoritative** directed + typed edge table (19 edges across 6 categories) |
| `demo-package/FIELD_DICTIONARY.md` | Field dictionary + localization mapping + invariants |
| `shadow-flow-presentation-mapping.json` | Full node/edge mapping incl. per-scenario statuses |
| `shadow-flow-demo-manifest.json` | Source-provenance manifest + verification summary + capability/disclaimer record |

## Required metadata (all present in the manifest, all tested)

- `export_contract: shadow-flow-export/1.0` + `presentation_version: shadow-flow-presentation/1.0`
- `shadow_source_commit: 84561eb`
- `fixture_id: case-2026-Q3-0042` + `guided_story_id: audit-chain`
- `language_support: ["en", "zh"]`
- `generated_at: 2026-07-22T00:00:00.000Z` — the deterministic fixture timestamp (policy permits no
  wall-clock stamps; regeneration is byte-identical)
- `network_used: false` · `physical_device_validated: false` · `mode_label: FIXTURE MODEL`

## Sanitization (tested by the prohibited-field scan)

Contains none of: usernames, private/absolute paths, private IPs, device serials, credentials,
tokens, pairing codes, real customer data, APKs, Unity assets, XREAL SDK files. All physical
capability flags are false. No live Flow API call was made to produce it.

## How it is used (vendor guidance received 2026-07-27)

Bill Morton (VP Customer Success, Flow Immersive) confirmed that Flow currently ingests CSV
directly, that a graph dataset should be one row per node with a unique ID, and that edges belong
in a column such as `idList` holding pipe-delimited connected node IDs. That closes the Q1–Q2
ingestion-path question for the CSV *shape*, and `shadow-flow-vendor-graph.csv` implements it.

1. Operator prepares on Mac or PC — regenerate + validate offline (no account needed):
   `node scripts/gen-flow-presentation-package.mjs --check`, then
   `node scripts/validate-flow-vendor-csv.mjs`.
2. Signs in to Flow with their own account (credentials never enter this repo) and imports
   `demo-package/shadow-flow-vendor-graph.csv`, mapping node id → `id`, connections → `idList`.
   Optionally starts from a copied Featured Flow, per vendor guidance.
3. Opens it on the device: browser → `a.flow.gl` → Flow Lister → select the Flow. XREAL One Pro
   paired with Beam Pro is a vendor-supported target; **unverified by us on that hardware**.
4. Presents per `SHADOW_FLOW_DEMO_STORYBOARD.md`.

Full procedure, verification steps and honest failure handling: `SHADOW_FLOW_IMPORT_RUNBOOK.md`.

The SCP prompt (`SHADOW_FLOW_SCP_PROMPT.md`) remains available for the arrange-but-never-invent
step. **SCP is in the final stages of production release and is not treated as currently
production-available**; nothing in the import path above depends on it.

Honest status of this package: **prepared, validated offline, and successfully imported into
Flow on a desktop browser (2026-07-27): 25 rows accepted, Network Graph rendered, Present Flow mode
opened. Save/reopen and XR device validation are still pending.**
