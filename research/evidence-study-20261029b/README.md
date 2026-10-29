# Known-fix cross-tool development studies, 2026-10-29

This extends the earlier evidence-acceptance pilot with two already documented
defects. No new vulnerability discovery, production rate or held-out performance
is claimed. Shadow's product code is unchanged.

## Two execution lanes

1. `contract_change_probe.py`: published mcp-contracts CLI/core/test 0.8.3 and
   0.9.0, controlled local stdio metadata fixture, 2 snapshot commands and
   12 check commands. The SDK and Zod versions match across the installations.
   `--fail-on` and `--severity` are explicit before each check. Tool actions are
   not executed. The frozen prior interpreter is retained as a counterexample.
2. `conformance-pr442/`: pinned upstream Git revision pair, original extracted
   checker statements and helpers with RPC/reporting stubs, 14 checker
   invocations. This is not a full CLI/HTTP/SDK/suite reproduction. See its README.

Together with the earlier discovery-error case, the pilot now has three known
historical defects across two tool families. Execution levels differ. Do not
pool commands or authored variants into an independent defect count or a single
accuracy metric. The earlier empty-suite control remains expected behavior.

## Policy-aware output interpretation

`policy_parser.py` is an ordinary strict parser, a strong baseline and engineering
improvement rather than a new algorithm. It reads the actual runner policy,
checks summary consistency and the metadata hashes needed for one contradiction
rule, and preserves UNKNOWN. It does not inspect RPC receipts, authenticate
capture, recompute the native content hashes, or establish business correctness.

Only unfiltered `--severity safe` reports are supported by the contradiction
rule. A filtered report is unsupported, not proof that a tool omitted a change.
`--fail-on warning` legitimately permits a warning report to exit 1; the same
warning legitimately exits 0 under `--fail-on breaking`.

The source-case fixture labels and expected dispositions are outside the parser
inputs. `analyze_policy.py` retains both the apparent improvement and its cost:
one false acceptance is withheld, but one known warning-only change allowed by
the breaking policy is also withheld because the old report cannot classify it.
This is development analysis of a known fix, not a fair superiority claim over
an equivalently configured algorithm. The original seven-record replay remains
unchanged and is not relabeled as a new experiment.

## Re-run

From the repository root:

```sh
npm ci --prefix research/integration-acceptance-20261026/locks/083 --ignore-scripts --no-audit --no-fund
npm ci --prefix research/evidence-study-20261029b/locks/contracts090 --ignore-scripts --no-audit --no-fund
python3 research/evidence-study-20261029b/contract_change_probe.py --old-prefix research/integration-acceptance-20261026/locks/083 --fixed-prefix research/evidence-study-20261029b/locks/contracts090
python3 -m unittest discover -s research/evidence-study-20261029b -v
python3 research/evidence-study-20261029b/analyze_policy.py
node research/evidence-study-20261029b/conformance-pr442/probe.mjs
```

Tested with Python 3.12.14 and Node v24.22.1. Installation needs registry access;
the probes need no credentials, model calls or external services. Connection
guards are research aids, not general security sandboxes. The TypeScript-strip
API emits an experimental warning. The policy parser has 10 synthetic unittest
tests; the extracted checker has authored input controls, not independent tasks.

See the [research update](../../docs/research/2026-10-29-cross-tool-followup.md),
[future study plan](./study-plan.json) and
[paper proposal](../../docs/research/2026-10-29-paper-proposal.md).
