# Shadow → Flow integration contract

Flow is a **separate presentation layer**, not a runtime dependency of the deterministic Mock demo.
The integration is an **offline-safe boundary** (`IFlowPresenter`), not a hard-coded live call.

## Data schema (`shadow-flow-export/1.0`, `flow-export-contract.mjs`)
A flat row table — each row is one FACT carrying the shared case + decision fields. Closed column
set (the CSV header never drifts):

`schema_version · case_id · generated_at · row_type · council_voice · stance · confidence ·
risk_category · metric_name · metric_value · evidence_id · evidence_label · relationship_from ·
relationship_to · relationship_type · recommendation · compliance_status · signed_result_status ·
audit_reference · mode_label`

`row_type ∈ {council, metric, evidence, relationship}`. `generated_at` is the **deterministic fixture
timestamp** (never wall-clock). `mode_label` is always `FIXTURE MODEL` for the demo — Flow must not
present it as live production AI. JSON + CSV are both produced.

## Offline behavior (the only behavior in the Mock demo)
`OfflineMockFlowPresenter.prepare(narrative)` → `{ state: PREPARED, title, case_id, export,
network_used: false, explanation }`. It **prepares + references** the export locally and displays a
handoff card. It **never** makes a network request and needs **no credentials**. The full Flow spatial
story is launched separately (outside the demo).

## Future live / API behavior (feature-flagged, NOT in the Mock APK)
`WebOrApiFlowPresenter({ enabled })` — disabled by default; with the explicit flag it would POST the
export to a Flow workspace API. Even the class returns `NOT_AVAILABLE` + `network_used: false` when the
flag is off. `resolveFlowPresenter({ live })` defaults to offline — **no silent network**.

## Security boundaries
- The export contains **non-secret demo data only** — no credentials, API keys, customer PII, or SSNs
  (a test asserts this).
- No key is ever embedded in the export or the APK. A live presenter's key (if ever used) is server/
  env-side, never in Unity or the browser.

## Failure behavior
- Flow unavailable/offline → the stage shows the **audit chain** fallback and a "prepared offline"
  card. Never a network error on stage.
- A malformed/absent narrative → `NOT_AVAILABLE` with an honest explanation, no crash.
