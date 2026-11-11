# Acceptance plans and run evidence

This development pilot asks what a downstream consumer can infer from a tool's result when the consumer's acceptance criteria are explicit. It is independent of the product runtime.

## Decision model

1. A caller writes a plan with a run ID, execution lane, transport, typed expected values, applicability rules and unresolved questions. `freeze` returns deterministic bytes for this local JSON profile.
2. The caller supplies observations indexed by check ID and identifies the run, scope and plan digest. Values are exact scalars: integer `200`, text `"200"` and boolean values are not interchangeable.
3. The evaluator separates `PASS`, `FAIL`, `NOT_OBSERVED` and `NOT_APPLICABLE`. An admissible mismatch rejects; absent, skipped or errored required checks withhold unless another admissible check already proves a mismatch. A run with no applicable checks cannot pass. A disputed plan, unresolved question or mismatched envelope withholds before interpretation.

This prototype does not infer requirements, authenticate the producer, verify approval or clocks, dereference evidence pointers, or establish the truth of observations. Plan equality is useful only given trustworthy intake. It does not make arbitrary caller-supplied status values true. Repeated observations are outside this one-row-per-check profile; they are not silently coalesced.

## Archived recorder replay

The [prior recorder probe](../evidence-study-20261029d/recorder/README.md) ran original pinned modules with authored transports. It found identical complete result objects for an observed lifecycle 200, an intended unsupported-transport skip, and an observed lifecycle 500. The November replay reads that archive without invoking the upstream tool. The [study plan](./study_plan.json) and outcome labels were authored after examining the archive, before running this replay. Its run IDs, plan IDs and envelope substitutions are study inputs, not upstream provenance. Plan freezing occurs before replay evaluation, not before October's archived runs.

| Reader | Agrees with authored decisions | Unsupported acceptance | Unsupported rejection | Expected passes withheld |
| --- | ---: | ---: | ---: | ---: |
| Native counts only | 5/16 | 10 | 1 | 0 |
| Plain rule without run/plan equality | 14/16 | 2 | 0 | 0 |
| Plain rule with the same information | 16/16 | 0 | 0 | 0 |
| Frozen-plan evaluator | 16/16 | 0 | 0 | 0 |

The 16 rows reuse **seven** archived fixtures. This is not a sample of 16 independent tasks or defects. Native-only counts a nonempty, internally consistent zero-failure report as accepted; its one unsupported rejection is a transport error, not a proven criterion mismatch. The unbound rule makes the two extra accepts on the wrong-run and other-plan substitutions. The same-information rule is a simple independent comparison on known-shaped fixtures; it ties the evaluator. Therefore the study supports retaining these facts, not an algorithmic advantage or production error-rate estimate.

The same status 500 rejects under an authored requirement of 200 and accepts under a deliberately expected 500. The stdio control with a matching RPC and a legitimately excluded HTTP check accepts. An all-inapplicable control withholds. These are consumer requirements for authored controls; they are not protocol conformance claims.

`results.json` records inputs, reasons, source pointers, native result digests and byte bindings for the archive, plan, driver and evaluator. The evaluator receives only the frozen plan and normalized observations. The comparisons use the authored expectations afterward.

## Local SQLite transfer control

`sqlite_control.py` freezes a plan before launching a fresh local Python subprocess over stdin/stdout. The worker seeds an in-memory SQLite database of three invented accounts, executes a fixed read-only query from a small catalog and returns operation status and the actual scalar observation separately. Seven fresh attempts and two separate post-run substitutions are retained in [sqlite-results.json](./sqlite-results.json).

- The paid, uncanceled count is 1. The unrestricted count is 3 and fails a count-of-1 plan despite SQL completion; the same query passes an explicitly different count-of-3 plan.
- A paid, canceled query also returns 1. The count-only plan accepts this result within its stated scope. It has no evidence of correct membership. When the plan instead expects ordered IDs `[1]`, the active selection passes and the canceled selection `[2]` rejects.
- An invalid fixed query with a missing column withholds rather than establishing a wrong count. Reusing a response under another frozen plan, and omitting a captured observation, are two post-run substitutions with no new query.

This measures local fixture behavior, not general SQL correctness, authentic capture, customer approval, or agent delivery. Neither the seven attempts nor the two substitutions add historical defects. Report and replay results are separate rather than pooled.

## Reproduce

From the repository root, with Python 3.11+:

```sh
python3 -m unittest discover -s research/acceptance-contract-20261111 -v
python3 research/acceptance-contract-20261111/replay.py --output /tmp/shadow-acceptance-replay.json
cmp research/acceptance-contract-20261111/results.json /tmp/shadow-acceptance-replay.json
python3 research/acceptance-contract-20261111/sqlite_control.py --output /tmp/shadow-sqlite-control.json
cmp research/acceptance-contract-20261111/sqlite-results.json /tmp/shadow-sqlite-control.json
```

Both experiments and the 14 unit tests use the standard library. The offline replay invokes no upstream tool. The SQLite control starts local child processes but uses no network, model, or external database. Byte comparison of the SQLite file assumes the same Python/SQLite versions, recorded in the artifact.
