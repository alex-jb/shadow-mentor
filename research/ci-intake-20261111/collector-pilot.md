# Pilot: can a real workflow produce reviewable evidence?

Protocol proposed November 11, 2026. The [offline adapter](./README.md) has no trusted collector. A caller can supply internally consistent fields for a job that never produced the claimed observation. The next test should measure collection reliability before a claim about release safety or customer value.

Use one isolated workflow with an inert integer fixture. Freeze the expected fixture outcome, workflow revision and allowed signer before the first run. Keep the pilot report-only, with a separate record of both producer and review results. Run cases in an order set before testing; label ground truth from fixture configuration and execution rather than from Shadow's verdicts. A pilot with a single workflow cannot estimate real-world error rates.

| Source | Capture and cross-check | Unresolved question |
| --- | --- | --- |
| Pre-run plan | Record fixture digest, criteria, job/matrix role and workflow revision. After dispatch resolve the provider's run, attempt and job IDs; retain the link back to the pre-run obligations. | How often is the job role ambiguous? |
| Measurement | Capture the actual tested checkout and typed fixture result. Give measured steps explicit IDs and fixed unique display names. Retain outcome and conclusion from a later step in the same job using the [step context](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#steps-context). Treat a skipped capture as missing evidence. | Can the capture finish when the measured step fails? |
| Provider records | Independently collect the [attempt-specific job list](https://docs.github.com/en/rest/actions/workflow-jobs#list-jobs-for-a-workflow-run-attempt) including all pages. Join the capture's check run ID to one provider job, then resolve the required step names to their provider step numbers. | Which missing fields still make review impossible? |
| Receipt and report | Use a receipt manifest that commits to the exact report and frozen plan bytes, plus the canonical form of the attempt-specific expectation. If the pilot signs it, verify the manifest subject and the preselected signer workflow before reading its claims. | Can the verifier distinguish a valid signature on a different attempt from current evidence? |

[GitHub attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations) can establish provenance and artifact integrity. If the pilot enables signing, check repository support and use a CLI version whose [verifier](https://cli.github.com/manual/gh_attestation_verify) can constrain the repository, signer workflow, signer revision and predicate type. Match the **verified** manifest fields against the plan and provider records, then review the same bytes that passed verification. The [local signing smoke test](./portable-review.mjs) only composes two checks over controlled fixtures; it does not enforce this requirement for live inputs. A signer match cannot tell whether a fixture was measured correctly, which checkout the job actually tested, or whether the reviewer received every needed observation. Store the verification result separately from the manifest and treat unavailable verification as a collection failure when required. Do not publish sensitive observations or general logs as attestations.

The [GitHub-hosted job context](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#job-context) exposes `job.check_run_id` and `job.workflow_sha` during execution. The five saved public Conftest job rows each had a `check_run_url` whose trailing ID matched that row's numeric job ID. The proposed join should match the check run ID against the API's `check_run_url`, then use the selected row's `id`; it should not assume that the two IDs are interchangeable. This checks the read side of the join on one public attempt. We did not capture the in-job fields live. Keep the workflow-definition SHA separate from the checkout used for the measurement.

| Planned case | Ground truth / expected scoped review |
| --- | --- |
| Fresh, correct attempt and complete passing fixture | Accept. |
| Fresh and complete, observed integer differs | Reject. |
| Policy-tolerated failure and absent required observation | Withhold even if the provider step conclusion is successful. |
| Saved receipt from a prior attempt of the same run | Withhold even if the old receipt's signature verifies. |
| Current attempt but wrong job or tested fixture revision | Withhold the result for the planned subject. |
| One required provider response page or receipt omitted | Withhold even if the available report and its hash agree. |

Record which source caused each unresolved case, bytes collected, setup effort and time from job completion to review. The first pass is successful only if both complete control cases are decided correctly, the other four do not become accepts, and another reviewer can independently reconstruct the source identities. Record every failed or unavailable run. Then compare a plain script and Shadow on the *same collected inputs* and compare human review time with and without the report. If the same-input script is just as clear and reliable, the evidence reader has not yet shown a product advantage.
