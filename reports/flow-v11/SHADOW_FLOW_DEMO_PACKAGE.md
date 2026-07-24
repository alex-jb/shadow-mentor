# Shadow → Flow demo package (sanitized, operator-local)

Location: `reports/flow-v11/demo-package/` + the two machine-readable files at `reports/flow-v11/`.
No repository-wide "approved Flow-export output directory" exists; the closest precedent is
`demos/spatial-finance/*.csv` (committed CSVs belonging to a self-contained older demo), so this
package lives in the spike's own report tree rather than mutating that demo. Documented here to
honor the "inspect conventions before creating a directory" rule.

## Contents

| File | Purpose |
|---|---|
| `demo-package/shadow-flow-demo-export.json` | Canonical audit JSON export (`shadow-flow-export/1.0`, 16 rows) |
| `demo-package/shadow-flow-demo-export.csv` | Corresponding CSV (closed 20-column header) |
| `demo-package/shadow-flow-presentation-nodes.csv` | Node table (22 nodes: case, 3 evidence, 5 council, 7 lineage, decision/review/approval, 4 verification, attestation, device boundary) |
| `demo-package/shadow-flow-presentation-edges.csv` | Edge table (19 edges across 6 categories) |
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

## How it would be used (pending vendor confirmation)

1. Operator opens a Flow SCP / Flow Editor session with their own account (credentials never enter
   this repo).
2. Imports `shadow-flow-demo-export.csv` (row layer) and/or the node/edge CSVs (spatial layer),
   per whichever import path Bill/Jason confirm (`FLOW_SUPPORT_QUESTIONS_FOR_BILL_AND_JASON.md` Q1–Q2).
3. Pastes the SCP prompt (`SHADOW_FLOW_SCP_PROMPT.md`) so the AI arranges — but does not invent —
   the supplied data.
4. Presents per `SHADOW_FLOW_DEMO_STORYBOARD.md`.

Until a vendor-confirmed import succeeds, the honest status of this package is:
**prepared and validated offline; live Flow ingestion not yet attempted.**
