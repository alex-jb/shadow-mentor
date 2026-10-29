# Evidence interpretation research component — 2026-10-29

This directory adds a research-only interpreter. It preserves a tool's reported
verdict separately from whether the recorded checks support that verdict.
It does not change the Shadow product or provide a new safety guarantee.

## Executed work

- Re-analysis of **7 check commands** from the previous published CLI probe:
  2 completed healthy checks and 5 discovery-error checks, from **one known
  historical defect**. Six snapshot commands are excluded from this denominator.
- **22 synthetic unittest controls** for the interpreter, including valid empty
  discovery, missing/mismatched responses, pagination, null versus absent cursors,
  opaque empty-string cursors, initialization order, malformed reports and skips.
- A new native **conformance 0.1.16 empty-suite control**: filtering the draft
  suite to 2025-11-25 selects 0 scenarios, returns exit 0, and never executes the
  sentinel client. A separate positive control verifies that the sentinel works.
  This is expected selection behavior, not a conformance bug or an explicit
  per-scenario SKIP. It is not included in the seven-record comparison.

## Re-analysis result

| Interpreter | False accept count | Healthy accept withheld | Infrastructure error called product FAIL |
| --- | ---: | ---: | ---: |
| Exit code only | 2 | 0 | 1 |
| Ordinary strict stdout/stderr parser | 0 | 0 | 0 |
| Strict parsing plus recorded discovery receipts | 0 | 0 | 0 |

There is **no measured advantage over the strict parser** on these development
records. Two healthy examples cannot establish general false-positive rates.
The corpus has no real completed FAIL, explicit SKIP, or INCOMPLETE examples;
those interpreter paths currently have synthetic controls only.

`reanalyze.py` has manually fixed labels, but passes only process/raw evidence
to the interpretation functions. Case IDs, fixture modes, expected exits and
gold labels are not interpretation inputs. The original bytes and source
pointer are retained, along with code/source hashes, in `reanalysis-results.json`.

## Interpretation contract

The supported receipt profile is one recorded MCP connection requiring a
successful `initialize`, complete advertised-tools discovery, and a consistent
mcpdiff summary/changes report. This is not full JSON Schema or MCP conformance.
Request IDs must be unique in this profile; unsupported or ambiguous captures
remain UNKNOWN. Pagination cursors are opaque strings: an empty string is not
absence, while explicit null is rejected.

The output retains `reported_verdict`, `execution_state`, `supported_verdict`,
`acceptance`, a reason and JSON pointers into the input evidence. For example,
a reported PASS with a required RPC error is retained as reported PASS, with
execution ERROR, supported verdict UNKNOWN, and acceptance WITHHOLD.

A digest binds bytes; it does not prove completeness, truthful capture, actor
identity or substantive review. `capture_complete` is an explicit study premise,
not an independently verified receipt. These traces came from our local fixture.
The stderr parser is version-specific and can over-withhold when an error phrase
is quoted in otherwise valid diagnostics. No general zero-error claim is made.

## Re-run

From the repository root, using Python's standard library:

```sh
python3 -m unittest discover -s research/evidence-acceptance-20261029 -v
python3 research/evidence-acceptance-20261029/reanalyze.py
```

The native empty-suite control uses the exact npm lock with lifecycle scripts
disabled. Dependency installation needs registry access; the control itself
requires no external server, provider credentials or model call:

```sh
npm ci --prefix research/evidence-acceptance-20261029/locks/conformance --ignore-scripts --no-audit --no-fund
python3 research/evidence-acceptance-20261029/conformance_empty_suite_probe.py --prefix research/evidence-acceptance-20261029/locks/conformance
```

Tested on Python 3.12.14 and Node v24.22.1. Connection guards are research aids,
not a general security sandbox. No paid model experiments or held-out discovery
evaluation were run. See the [IEEE route review](../../docs/research/2026-10-29-ieee-paper-route.md)
and [paper proposal](../../docs/research/2026-10-29-paper-proposal.md).
