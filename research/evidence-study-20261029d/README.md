# Runner state and recorder scope controls

Development follow-up, 2026-10-29. This adds an ordinary parser revision and
original-module applicability controls. It does not add a historical defect,
held-out result, new verification algorithm or production safety measurement.

## Parser revision

`policy_parser_v2.py` wraps the frozen policy parser from `../evidence-study-20261029b/`.
The older source and its SHA-bound results are unchanged. V2 preserves all twelve
saved native-check outputs' decisions and fixes an authored retained-output case:
`runner_state=SKIPPED` can no longer promote an otherwise healthy stdout to PASS.
An explicit invalid/noncomplete runner state withholds acceptance. Missing runner
state retains legacy exit/timeout behavior, not proof of a fresh completed run.

The supported profile is the unfiltered mcpdiff CLI reports used in the saved
0.8.3/0.9.0 development cohort. Two source anchors establish that equal content
hashes take the empty-diff shortcut in these versions:

- [0.8.3 check.ts](https://github.com/mcp-contracts/mcp-contracts/blob/b4c87a1ed1dc194ccdf387211b0aa89afcecc325/packages/cli/src/commands/check.ts)
- [0.9.0 check.ts](https://github.com/mcp-contracts/mcp-contracts/blob/2b758c625854ebbc017791ab618f9f5b3928f893/packages/cli/src/commands/check.ts)
- [0.9.0 hash.ts](https://github.com/mcp-contracts/mcp-contracts/blob/2b758c625854ebbc017791ab618f9f5b3928f893/packages/core/src/hash.ts)

An equal-hash/nonempty-change input is therefore withheld as inconsistent with
this profile, rather than interpreted as PASS or product FAIL. These corrupted
report inputs were authored here; they are not new observations from native CLI
commands. No content hash is recomputed or authenticated by the parser.

Duplicate JSON members and the nonstandard NaN/Infinity literals are rejected
by an explicit strict-input policy. Both Python and JavaScript normally resolve
duplicate members by retaining the last value; no cross-language discrepancy is
claimed. Valid JSON numeric text such as `1e999` can still decode to infinity in
an unused field. This revision does not claim full native-schema validation or
rejection of all nonfinite decoded values.

Eight unittest methods pass, including retained-output, ambiguous report inputs,
unchanged valid policy behavior and parity on the twelve saved native checks.
Subtests do not create independent defects/tasks. `analyze_parser_boundaries.py`
saves seven authored controls separately from re-analysis of native observations.
It passes no labels, case names or expected outcomes to the interpretation API.

Two explicit costs remain: the earlier allowed warning-only change can still be
withheld, and the inherited stderr regex still withholds a healthy control that
only quotes `Failed to list tools`. The parser is not an authenticated runner,
receipt checker, report freshness guarantee or business-state verifier.

## Third family

[recorder/](./recorder/README.md) executes unmodified original recorder modules
at a pinned Git revision with API-supplied fake transports. Eleven authored cases
comprise ten verifier calls and one validation rejection. Three lifecycle variants
produce identical full native result objects despite different observed exercise
or status. This adds a third family **only as an applicability control**; the
repaired-defect corpus is still three historical defects across two families.

The previous `study-plan.json` and source-only screening remain snapshots written
before this execution, not current mutable completion trackers. No independently
blinded human labels or held-out cohort have been completed.

## Re-run

From the repository root:

```sh
python3 -m unittest discover -s research/evidence-study-20261029d -p 'test_policy_parser_v2.py' -v
python3 research/evidence-study-20261029d/analyze_parser_boundaries.py
python3 research/evidence-study-20261029d/recorder/probe.py
```

The recorder's imported-lane dependency pins and byte-level source bindings are
documented in its README. Parser analysis uses only the already saved outputs;
it does not rerun the native CLI. All findings remain development controls.
