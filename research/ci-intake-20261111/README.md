# Review a CI report with its run evidence

This is the offline continuation of the [CI observation design](../acceptance-contract-20261111/ci-observation-design.md). It compares caller-supplied records, preserves native conclusions, and prints a scoped verdict. There is no CI trigger, artifact download, model call, merge gate, or deployment action.

## Local bundle

| File | Purpose |
| --- | --- |
| `plan.json` | Canonical bytes from the [frozen acceptance plan](../acceptance-contract-20261111/README.md). The run ID must be `github:repository_id:run_id:attempt:job_id` and the lane `github-actions`. |
| `expected.json` | Exact expected repository, run, attempt and job; expected tested checkout SHA; mapping from applicable check IDs to required step numbers. The transport in the plan describes the application, not the GitHub API. |
| `jobs.json` | Caller-exported attempt-specific job list and pagination status. Provider step conclusion is retained; it does not replace the raw outcome. |
| `receipt.json` | Caller-supplied report association: job identity, tested checkout SHA, digests for the plan, expectation and report, and original step outcomes. The expectation digest binds the step mapping as well as identity and checkout. |
| `report.json` | Existing acceptance-evidence.v1 object. The reader checks the SHA-256 of the exact bytes it parses. Duplicate JSON keys, nonfinite values, invalid UTF-8 and oversized input are withheld. |

Required steps must be completed with both provider conclusion and raw outcome successful in this initial profile. The job must be complete; failure of a separate, nonrequired step does not decide the scoped application assertion. A skipped step, ambiguous input, wrong attempt, altered bytes or unavailable observation is not evidence of a wrong business value. Once an admissible typed observation contradicts the required value, the assertion rejects. A declared out-of-scope check is distinct from a missing required check.

The adapter trusts the caller's source association, checkout claim, original outcomes and pagination information. It verifies consistency and data completeness under this profile. A hash match cannot authenticate the collector, validate the actual checkout, prove the observation is true, or make a weak acceptance requirement stronger. This version does not accept previous-attempt results under a reuse policy.

## Executed results

| Reader | Agreement with authored labels | Unsupported accepts | Unsupported rejects |
| --- | ---: | ---: | ---: |
| Native job conclusion | 4/22 | 17 | 1 |
| Typed report and plan only | 10/22 | 12 | 0 |
| Bound intake and Python decision | 22/22 | 0 | 0 |

The [22 cases](./case-catalog.json) are authored controls, not 22 independent CI runs. The first two comparisons intentionally omit information; the difference is not evidence of algorithmic superiority. The one unsupported native rejection is an unrelated failed step outside the declared scope. Four expected accepts, one expected rejection and 17 expected holds are represented. Open [casebook.html](./casebook.html) in a browser to inspect the saved case results without a server.

The [OPA comparator](./opa-reference/results.json) holds 13 cases at the **same** admission gate and actually invokes OPA for nine admitted cases. The independent Rego rule agrees with Python on all nine decisions, including their reported reasons and check rows. Both complete paths agree on 22/22. This tests policy-engine interchange after admission only.

Three additional, separately reported numeric controls use correct receipts with an expected integer of `1`. Both rules accept an observed `1` and withhold `1.25`; OPA accepts `1.0`, while Python withholds it as a float. The Rego rule deliberately uses mathematical integrality; this is a difference in type semantics, not an OPA bug. A cross-engine profile needs to specify or preserve that distinction.

The [Ergo smoke test](./ergo-reference/README.md) ran five other authored observations through exact release bytes using OPA. It verifies overlap in checking values, missing data, types and applicability. It is not a comparison of complete CI systems.

The [portable review smoke test](./portable-review-results.json) reuses four of the 22 cases with the existing [Shadow signing library](../../packages/attest-core/README.md). With a temporary local key, all four signed manifests verify and their member hashes match; scoped reviews still span accept, reject and withhold. Adding one newline to a report leaves the signed manifest valid but causes a member hash mismatch and withholds the review. A different verification key fails signature validation. The demonstration does not authenticate a real collector.

The [public metadata sample](./public-metadata.json) is separately retained from one read-only Conftest workflow attempt: five jobs, with provider attempt fields present. An illustrative after-the-fact plan for one step returns `WITHHOLD` with no caller receipt or report. In the [pagination check](./public-pagination-check.json), projecting three pages (2 + 2 + 1 jobs) matches projecting one complete page. Removing the last page leaves four of five jobs and withholds the bundle. These observations do not judge Conftest's release quality and are not included in the 22 cases. No real CI workflow was started.

## Reproduce

Run from the repository root (Python 3.11+):

```sh
python3 -B -m unittest discover -s research/ci-intake-20261111 -v
python3 -B research/ci-intake-20261111/experiment.py --output /tmp/shadow-ci-replay.json
cmp research/ci-intake-20261111/results.json /tmp/shadow-ci-replay.json

work=$(mktemp -d)
python3 -B research/ci-intake-20261111/experiment.py --write-bundle tolerated_step_failure "$work/bundle"
python3 -B research/ci-intake-20261111/review.py "$work/bundle"
```

The example returns exit 2 and `REQUIRED_STEP_NOT_OBSERVED`; its output preserves the green final conclusion and failed raw outcome. The local CLI exit statuses are 0 for accept, 1 for reject, 2 for withhold. The CLI reads the five files without writing to them. No CI job is configured to consume those exit statuses.

To prepare `jobs.json` from a **saved** attempt-specific API export (single response or an array of pages), use the offline projector:

```sh
python3 -B research/ci-intake-20261111/project_jobs.py saved-pages.json \
  --repository-id 178249461 --run-id 43092281393 --attempt 1 > jobs.json
```

It checks declared counts, uniqueness and available run/attempt fields, preserves partial exports as incomplete, and drops unused runner metadata. The caller is still responsible for the API route and trusted collection. The command does not contact GitHub. See the [collector pilot](./collector-pilot.md) for an unexecuted plan to measure whether the adapter's inputs can be collected in a real workflow.

For the optional policy-engine comparison, use a Linux amd64 OPA 1.22.3 binary with the [published release](https://github.com/open-policy-agent/opa/releases/tag/v1.22.3) digest recorded in the result. The comparator checks it before running the local policy:

```sh
python3 -B research/ci-intake-20261111/opa-reference/compare.py --opa /path/to/verified/opa
```

With Node.js 20+ and Python 3.11+, rerun the offline signing demonstration with `node research/ci-intake-20261111/portable-review.mjs`. It generates keys and fixture files for the demonstration only, and prints no key material.
