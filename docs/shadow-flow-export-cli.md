# shadow-flow-export — deterministic Flow export CLI

The supported way to write a `shadow-flow-export/1.0` artifact to disk. A thin
adapter around the existing Core producer
(`apps/shadow-lens/flow/flow-export-contract.mjs` → `exportFlowContract`): it
adds **no new schema, no new council, no network access**.

## Command

```sh
# from the shipped canonical fixture
node bin/shadow-flow-export.mjs --fixture banking --output artifact.json

# from a supported narrative JSON file
node bin/shadow-flow-export.mjs --input narrative.json --output artifact.json

# npm alias
npm run flow:export -- --fixture banking --output artifact.json
```

Flags: `--input <path>` | `--fixture <name>` (exactly one required; supported
fixture names: `banking`), `--output <path>` (required, explicit),
`--force` (replace an existing output; refused otherwise), `--json`
(one-line machine summary on stdout), `--help`.

## Input contract

A narrative in the shape the producer already reads — the shape of
`BANKING_NARRATIVE` (`apps/shadow-lens/fixtures/banking-narrative.mjs`):
`case_id`, `fixture_timestamp`, `council[]`, `metrics[]`, `evidence[]`,
`relationships[]`, and a `decision{}` carrying `recommendation`,
`compliance_status`, `signed_result_status`, `audit_reference`, `mode_label`.
No new narrative schema is defined; unsupported shapes are rejected with named
errors. The source input is deep-frozen before export — it is never mutated.

## Output contract

Exactly `shadow-flow-export/1.0`, byte-for-byte what `exportFlowContract`
returns, serialized as pretty-printed UTF-8 JSON with a trailing newline.
Validated **before** writing:

- schema version on the export and on every row
- required top-level fields, and *only* those fields
- row fields inside the stable closed column set (`FLOW_EXPORT_COLUMNS`)
- row identity uniqueness (voice / metric name / evidence id / relationship triple)
- stable grouped ordering (council → metric → evidence → relationship)
- relationship endpoints resolve to a council voice or evidence id in the export
- status fields present as non-empty strings; `row_count` consistency; CSV header
- no secret/credential patterns, no private filesystem paths

A failed validation exits 4 and writes **nothing**. Writes go through a
temp-file + rename, so a failed run never leaves a partial artifact. Missing
parent directories are created (same convention as
`generate-attestation-keypair.mjs`); an existing output is refused unless
`--force` is passed.

## Exit codes

| code | meaning |
|---|---|
| 0 | artifact written and validated |
| 2 | usage error (bad flags, unknown fixture, both/neither input modes) |
| 3 | input read/parse/shape error, or output I/O error (incl. refuse-to-overwrite) |
| 4 | produced export failed `shadow-flow-export/1.0` self-validation — nothing written |

Errors go to stderr; the success summary goes to stdout.

## Determinism, offline, privacy

Same input → byte-identical output. `generated_at` is the narrative's
`fixture_timestamp` (the contract's own deterministic field), never wall-clock.
The CLI performs no network access, imports no network-capable module, and
requires no Anthropic/OpenAI/Flow credentials — tests run it with a bare
`PATH`-only environment. Nothing in the artifact may reference private
filesystem paths or key material.

## Honest absence — what this export does NOT carry

The flattened `1.0` export does **not** include first-failure analysis,
downstream consequences, approval state, trust posture, or signature/hash
evidence fields. That absence is honest and load-bearing:

- consumers **must not synthesize** the missing fields
- a valid export does **not** prove business correctness of the decision
- a valid export does **not** prove a Flow vendor import will succeed
- a valid export does **not** prove native Shadow Lens behavior on device

Signed evidence lives in the separate evidence-bundle pipeline
(`bin/shadow-verify.mjs`, `spec/evidence-bundle.schema.json`), not here.

## Relationship to consumers

- **Flow import**: the artifact (`rows` + `csv`) is the table the offline
  presenter references; Flow is a presentation layer launched separately, never
  a runtime dependency (see `flow-presenter.mjs`).
- **Web import / future local runner**: the Web local runner should shell out
  to (or spawn) this CLI — `node bin/shadow-flow-export.mjs --input <narrative>
  --output <artifact>` — and treat exit codes 2/3/4 as distinct user-facing
  states rather than re-implementing the producer or validator. The `--json`
  flag exists for exactly that machine consumption. Web integration is
  intentionally not part of this increment.
