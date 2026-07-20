# experiments/office-evidence-spike

A **deletable** spike (OSS radar 2026-07-20, OfficeCLI): treat an Office file
(Excel / Word / PowerPoint) as an evidence source that emits a **Document
Source-Map v1** — and capture BOTH representations the radar flagged:

- **machine-readable structure**: sheet + cell ref + formula + value
- **human-visible render**: the PNG a reviewer would actually see

so evidence can't silently drop hidden columns, formulas, merged cells,
conditional formatting, or charts that a bare extracted value misses.

No OfficeCLI dependency lives here — the demonstrator (`office-source-map.mjs`)
uses a mock extraction so the contract is runnable today. A real OfficeCLI adapter
(read / render / extract / compare **only** — never writes the source in v1) drops
in behind the same contract, and earns core status only via the parser benchmark.

## The finding this spike surfaces

Document Source-Map v1 binds `document_hash` (the RAW bytes). Office evidence needs a
second binding — the **render** — because "what the model extracted" and "what the
human saw" can diverge (a hidden column, a formula vs its cached value, a chart). So
the spike carries an extra top-level **`render_hash`** (+ `render_media_type`)
alongside `document_hash`. That's the clean **v1.1 candidate**: dual binding
`raw bytes` + `rendered image`, both tamper-evident. v1 core is left unchanged.

An Excel evidence entry therefore records, verifiably together:

```
Sheet = Risk Model, Cell = B17
value = 0.74
formula = =SUM(B2:B16)/B1
region = [x0,y0,x1,y1] on the rendered sheet
raw bytes  -> document_hash
rendered   -> render_hash
```

## Run

```
node experiments/office-evidence-spike/office-source-map.mjs
```

Emits a Document Source-Map for the mock spreadsheet extraction, validates it with
`lib/document-source-map.js`, and computes both `document_hash` (raw) and
`render_hash` (the rendered PNG) — showing the dual binding end to end.

## Discipline (unchanged from core)

- `confidence` is the parser's self-report, never correctness.
- v1 is READ / RENDER / EXTRACT / COMPARE only. Any write-back to a user's file must
  be a copy, in a sandbox, behind Human Approval, emitting a before/after diff.
- Office macros / external links / embedded objects are an attack surface — treat the
  file as untrusted input; hash what you received before doing anything with it.
