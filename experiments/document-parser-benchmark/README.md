# experiments/document-parser-benchmark

A **deletable** experiment (per the 2026-07-20 OSS radar): benchmark PDF/Office
parsers as swappable backends behind Shadow's Document Source-Map. No parser
dependency lives in core — a parser earns its way in only by beating the incumbent
on these metrics against a fixed golden set.

## The contract

A parser adapter must emit a **Document Source-Map v1** (`spec/document-source-map-v1.json`)
for each fixture: every extracted value carries `page` + (ideally) `region` +
verbatim `raw_text`, bound to the file's `document_hash`. That format IS the
benchmark input — a parser that can't say *where* a value came from can't score on
traceability, which is the whole point for Shadow.

## Metrics (see `score.mjs`)

| Metric | What it measures | Why Shadow cares |
|---|---|---|
| `field_recall` | fraction of golden fields the parser found | did it extract the decision-relevant numbers? |
| `page_accuracy` | of matched fields, fraction on the correct page | page citations must be right |
| `numeric_mae` | mean abs error on numeric fields | a wrong DTI is worse than a missing one |
| `traceability` | fraction of entries carrying a `region` bbox | can a human jump to the exact spot? |
| `valid` | source-map passes `validateSourceMap` | structural conformance |

**Honesty rule:** a parser's `confidence` is NOT scored as correctness and never
gates. Metrics are computed against human-authored golden truth only.

## Run

```
node experiments/document-parser-benchmark/score.mjs \
  experiments/document-parser-benchmark/golden/example.golden.json \
  experiments/document-parser-benchmark/golden/example.candidate.json
```

With no args it scores the bundled example (a hand-built candidate vs golden) so the
harness is runnable today, before any real parser is wired.

## Adapters

- **`adapters/opendataloader.mjs`** — scaffolded. Pure `mapOpenDataLoaderToSourceMap()`
  (ODL JSON → Source-Map v1, normalizes absolute bboxes to 0..1, maps element types)
  is validated offline against a mock ODL dump. `extractSourceMap(pdf)` shells out to
  OpenDataLoader **out of process** (Java 11+; set `OPENDATALOADER_CMD`) and skips
  gracefully when it's not installed. Verify the JSON field names against a real
  `--format json` dump when wiring — the one thing the skeleton can't confirm offline.

End to end once a parser is installed:
```
node -e "import('./adapters/opendataloader.mjs').then(m=>m.extractSourceMap('golden/loan.pdf')).then(sm=>require('fs').writeFileSync('golden/loan.candidate.json',JSON.stringify(sm)))"
node score.mjs golden/loan.golden.json golden/loan.candidate.json
```

## Adding another parser (in this experiment dir — NOT core)

1. `adapters/<parser>.mjs` → same shape: a pure `map…ToSourceMap()` + an
   `extractSourceMap(file)` runner that degrades gracefully.
2. Point it at 5–10 real financial PDFs in `golden/` (git-ignore if licensing requires).
3. `score.mjs` each parser's output vs the golden; compare.

Candidates flagged by the radar: **OpenDataLoader PDF** (Apache-2.0, ~27k★, Java —
run out-of-process), **MarkItDown** (fast text-first), **OfficeCLI** (Office +
render-to-PNG), **claude-vision** (already wired in `api/scan-analyze`). Only promote
one behind a real `DocumentEvidenceProvider` in core after it wins here.
