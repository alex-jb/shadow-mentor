# Field dictionary — Shadow → Flow demo package

Package contents (all deterministic, offline, sanitized; regenerate with
`node scripts/gen-flow-presentation-package.mjs`, drift-check with `--check`):

| File | What it is |
|---|---|
| `shadow-flow-demo-export.json` | The canonical `shadow-flow-export/1.0` export of `case-2026-Q3-0042` (rows + embedded CSV) |
| `shadow-flow-demo-export.csv` | Same rows as CSV (header = the closed 20-column set) |
| `shadow-flow-presentation-nodes.csv` | One row per presentation node (spatial layer) |
| `shadow-flow-presentation-edges.csv` | One row per presentation edge |
| `../shadow-flow-presentation-mapping.json` | Full node/edge mapping incl. per-scenario statuses |
| `../shadow-flow-demo-manifest.json` | Provenance + verification summary + capability/disclaimer record |

## `shadow-flow-export/1.0` row columns (existing contract — unchanged)

| Column | Meaning |
|---|---|
| `schema_version` | Always `shadow-flow-export/1.0` |
| `case_id` | Stable case identifier (`case-2026-Q3-0042`) |
| `generated_at` | Deterministic fixture timestamp — never wall-clock |
| `row_type` | `council` \| `metric` \| `evidence` \| `relationship` |
| `council_voice` / `stance` / `confidence` | Council rows: voice name, stance, 0–1 confidence |
| `risk_category` / `metric_name` / `metric_value` | Metric rows (e.g. DTI 0.41, category `warn`) |
| `evidence_id` / `evidence_label` | Evidence rows (stable IDs `B0L0`–`B0L2`) |
| `relationship_from` / `relationship_to` / `relationship_type` | Relationship rows (`cites`, `disagrees`) |
| `recommendation` | Council outcome — `REVIEW` (routed to a human; not approve/decline) |
| `compliance_status` | `clear` (from the fixture decision) |
| `signed_result_status` | `sealed-verified` (Ed25519 acceptance proven Node-side) |
| `audit_reference` | `hash-chain:demo` |
| `mode_label` | `FIXTURE MODEL` — honesty label; Flow must not present this as live production AI |

## Presentation node columns (`shadow-flow-presentation-nodes.csv`)

| Column | Meaning |
|---|---|
| `id` | Stable node ID. Lineage nodes keep their guided-story IDs (`banking-v1:nN:kind`); evidence keeps `evidence:B0LN`; council uses `council:<slug>`; presentation-layer nodes use `presentation:*` |
| `type` | `case`, `evidence_item`, `council_voice`, lineage kinds (`source`…`audit_record`), `recommendation`, `human_review`, `human_approval`, `verification`, `attestation`, `capability_disclaimer` |
| `sequence` | Lineage order 0–6 (empty for non-lineage nodes) |
| `label_en` / `label_zh` | Bilingual labels; status vocabulary strings come from `lib/shadow-semantic-vocabulary.mjs` |
| `status` | Literal Shadow status. Lineage/verification nodes use SEMANTIC_STATUS IDs (`FIRST_FAILURE`, `AFFECTED_DOWNSTREAM`, `VERIFIED`, `FAILED`, `NOT_EVALUATED`, `REQUIRES_HUMAN_REVIEW`, `NOT_PRESENT`, `PRESENT`); council nodes carry their fixture stance verbatim |
| `status_family` | Severity bucket: `pass` / `fail` / `warn` / `neutral` / `abstain` / `info` (from the vocabulary; council rows derive from vote: agree→pass, challenge→warn, abstain→abstain) |
| `group` | Spatial group: `center` / `left-case` / `ring-council` / `right-downstream` / `path-lineage` / `verification-area` |
| `source_ref` | Repo-relative provenance of the fact (never an absolute path) |
| `is_first_failure` / `is_affected_downstream` | Booleans for immediate visual emphasis |

## Presentation edge columns (`shadow-flow-presentation-edges.csv`)

| Column | Meaning |
|---|---|
| `id` | Stable edge ID |
| `from` / `to` | Node IDs (no dangling refs — tested) |
| `type` | Semantic relation: fixture verbatim (`cites`, `disagrees`) or shared RELATION_TYPES (`DERIVED_FROM`, `SEALED_BY`, `BINDS`, `ATTESTS`) |
| `category` | Presentation role: `council` / `lineage` / `downstream` / `human_review` / `approval` / `verification` |

## Localization mapping

Every node carries `label_en` + `label_zh`. Status display strings and accessible descriptions
(EN + ZH) live in `lib/shadow-semantic-vocabulary.mjs` (`SEMANTIC_STATUS[*].text_en/text_zh/a11y_*`)
— the single source for status wording in ANY renderer, Flow included. Bilingual completeness is
asserted by test.

## Invariants Flow must respect

1. Display, never recompute — statuses are Shadow's conclusions.
2. `FIXTURE MODEL` stays visible — this is a demonstration fixture, not live production AI.
3. `VERIFIED` ≠ trusted/compliant; majority ≠ correct (FORBIDDEN_MAPPINGS — do not collapse).
4. Verification area stays visually separate from the business conclusion.
5. Human Review and Approval are different things; the fixture contains no granted approval.
6. No physical Shadow Lens capability is implied (`physical_device_validated: false`).
