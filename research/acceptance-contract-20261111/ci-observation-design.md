# CI observation adapter: design, not an implemented integration

Checked November 11, 2026. This note turns the replay's wrong-run control into a specific next experiment. No workflow was created or rerun. A read-only query for GitHub Actions runs on the Shadow research branch returned zero visible runs, so there is no real CI result to report.

## Why a workflow run ID alone is insufficient

[GitHub's contexts reference](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#github-context) states that a rerun keeps the run ID and increments the attempt number. The [rerun documentation](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs) also states that a partial rerun can reuse outputs of jobs it did not execute again. A preserved output can be legitimate under the workflow's policy without proving that a check ran in the new attempt.

The same distinction appears within a job: [GitHub's step context](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#steps-context) separates the step's outcome from its conclusion after the workflow applies `continue-on-error`. The collector should preserve both; it must not translate a successful conclusion directly into a proven application assertion.

## Proposed capture boundary

| Field group | What to retain | What it can support |
| --- | --- | --- |
| Run instance | Provider host, stable repository ID, workflow run ID, attempt, verified job instance | Locate the exact producer rather than a different attempt with the same run ID |
| Planned coverage | Workflow definition revision, logical job and declared matrix dimensions, tested checkout and fixture digests | Confirm the expected checks were supposed to apply to this subject and environment |
| Observations | Step outcome and conclusion, check ID, typed observation, explicit skip/error, artifact ID plus archive and report-member hashes when applicable | Distinguish execution from policy handling; locate the bytes supporting a specific assertion |
| Decision | Frozen plan digest, per-check reasons and source pointers | Reproduce the decision from admitted observations; expose missing evidence without inventing a failure |

Use the [attempt-specific jobs listing](https://docs.github.com/en/rest/actions/workflow-jobs#list-jobs-for-a-workflow-run-attempt) to resolve a job instance. A workflow's logical job key or a zero-based matrix index is insufficient by itself. A trigger SHA is not necessarily the exact code selected by the checkout, so the adapter needs the tested subject separately. The documented [artifact metadata](https://docs.github.com/en/rest/actions/artifacts#get-an-artifact) example links the artifact to a run and SHA, but does not name the producing job and attempt. A trusted collector would need to preserve that association; an artifact name, timestamp or matching archive hash does not supply it.

[OpenTelemetry's CI/CD conventions](https://opentelemetry.io/docs/specs/semconv/cicd/cicd-spans/) already distinguish execution results and error classes; their relevant task attributes are marked release candidate in the checked version. Treat a span as an observation pointer, not proof of acceptance. The community [SLSA workflow build type](https://github.com/slsa-framework/github-actions-buildtypes/blob/main/workflow/v1/README.md#metadata) already recommends using run ID and attempt in its invocation identity. The proposed adapter is an application of that distinction, not a new provenance protocol.

## Smallest test worth running

Begin with a harmless, isolated workflow and report-only mode, with no merge gate or deployment action. Freeze current-attempt obligations before execution. Use the same report reader and normalized fields for the plain-rule and prototype comparators. Include these planned cases:

1. Fresh passing assertion, correct matrix cell and current attempt: accept the scoped check.
2. Same run ID and trigger SHA, prior attempt's result: withhold a current-attempt requirement.
3. Partial rerun legitimately reuses a prior result: keep it labeled as prior evidence; the initial strict profile still withholds where a fresh observation was required.
4. A policy-tolerated step error has successful final conclusion: preserve the outcome and any application observation, and withhold if the required check did not run.
5. Correct attempt but wrong job or tested subject: withhold that evidence.
6. Fresh, matching source and definite mismatch in the required value: reject, even if the runner succeeded.

If a future policy permits reuse, record the source attempt and separately verify unchanged criteria and inputs. The current evaluator binds a whole plan, including its run ID; it does not implement carry-forward or verify the collector. Provider records, hashes and any future provenance checks have separate meanings from permission, measurement truth and business correctness. Missing job identity or incomplete provenance remains unresolved.
