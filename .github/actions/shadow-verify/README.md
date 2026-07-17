# Shadow evidence bundle verify — GitHub Action

Verifies a Shadow evidence bundle (`spec/EVIDENCE_BUNDLE.md`, `bundle_version: 1`) against a supplied Ed25519 public key. Wraps `bin/shadow-verify.mjs`. Fails the run on any chain break, signature mismatch, or missing input.

## Usage

Vendor this action from your repository (path reference from a workspace checkout of `alex-jb/shadow-mentor`), or reference it once it is published to the GitHub Marketplace:

```yaml
name: Verify agent evidence bundle
on:
  pull_request:
    paths: ["evidence/**/*.bundle.json"]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Verify PR-supplied bundle
        uses: alex-jb/shadow-mentor/.github/actions/shadow-verify@main
        with:
          bundle: evidence/pr-${{ github.event.pull_request.number }}.bundle.json
          public-key: keys/shadow-2026-Q3.pem
```

          public-key: keys/shadow-2026-Q3.pem
```

### Gate on Banking Evidence Profile v1 conformance

Set `profile: banking-v1` to also require that each decision bundle is an
auditable credit-decision record (integrity + the examiner-required evidence,
with a swapped/ungoverned reason-code dictionary failing). The job fails if a
bundle is verified but non-conformant — a bank's CI gate for "is this decision
auditable?":

```yaml
      - uses: alex-jb/shadow-mentor/.github/actions/shadow-verify@main
        with:
          bundle: evidence/decision.bundle.json
          public-key: keys/shadow-2026-Q3.pem
          profile: banking-v1
```

## Inputs

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `bundle` | yes | — | Path to the evidence bundle JSON file, relative to the workspace. |
| `public-key` | yes | — | Path to the Ed25519 public key in PEM format. |
| `fail-on-mismatch` | no | `"true"` | If `"false"`, the action reports result via outputs without failing the job — useful when a follow-up step should post a PR comment before halting. |
| `profile` | no | `""` | Evidence-profile name (e.g. `banking-v1`). When set, also checks conformance; with `fail-on-mismatch=true`, fails on verified-but-non-conformant (exit 4). |

## Outputs

| Name | Description |
| --- | --- |
| `ok` | `"true"` or `"false"` from the verifier. |
| `reason` | Failure reason from the verifier. Empty on success. |
| `failed_seq` | Event sequence number where chain integrity broke. Empty on success. |
| `session_id` | The `session_id` from the bundle header. Present on both ok and non-ok. |
| `event_count` | Number of events in the bundle. |
| `batch_root` | The sha256 batch root. |
| `profile_conforms` | When `profile` is set: `"true"`/`"false"` conformance. Empty otherwise. |
| `profile_coverage` | When `profile` is set: percent of evidence slots present. Empty otherwise. |

## Downstream pattern — comment then fail

```yaml
- name: Verify without failing
  id: verify
  uses: alex-jb/shadow-mentor/.github/actions/shadow-verify@main
  with:
    bundle: evidence/pr-${{ github.event.pull_request.number }}.bundle.json
    public-key: keys/shadow-2026-Q3.pem
    fail-on-mismatch: "false"

- name: Comment on PR when verification fails
  if: steps.verify.outputs.ok != 'true'
  uses: actions/github-script@v7
  with:
    script: |
      const reason = "${{ steps.verify.outputs.reason }}";
      const failedSeq = "${{ steps.verify.outputs.failed_seq }}";
      const body = `❌ Evidence-bundle verification failed.\n\n` +
        `**Reason:** ${reason}\n` +
        (failedSeq ? `**Failed at event seq:** ${failedSeq}\n` : "") +
        `\nThis PR carries an evidence bundle whose signed chain no longer verifies. ` +
        `The likely causes are: (a) the bundle was edited after signing, (b) an event was ` +
        `reordered or removed, (c) the wrong public key was supplied, or (d) the bundle was ` +
        `produced against a different bundle_version. See spec/EVIDENCE_BUNDLE.md.`;
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body,
      });

- name: Fail after commenting
  if: steps.verify.outputs.ok != 'true'
  run: exit 1
```

## Requirements

- Node.js 20+ on the runner (`actions/setup-node@v4` with `node-version: "20"`).
- The action itself has no third-party dependencies — it invokes `bin/shadow-verify.mjs` from the checked-out repo.

## Scope

This action verifies chain integrity + Ed25519 signature. It does NOT verify external time anchors (RFC 3161 TSA tokens or Sigstore Rekor inclusion proofs). Those ship in v3 M3 alongside a dedicated `shadow-verify-anchored` action.

## License

MIT. See the repository root.
